// Shared test support for Edge Function handler tests (not a test file itself).
// Loads a real supabase/functions/*/index.ts with Deno.serve stubbed, and provides an
// in-memory Supabase admin client that really applies filters, ordering, projection and writes,
// so handler tests exercise behaviour rather than source text.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { webcrypto } from "node:crypto";

const functionsRoot = new URL("../supabase/functions/", import.meta.url);

const stripImports = text => text.replace(/^import[\s\S]*?;\r?\n/gm, "");

/** Load a _shared module that imports npm: packages by evaluating it in a sandbox with supplied globals. */
export const loadSharedInSandbox = (relativePath, globals, exportNames) => {
    const raw = readFileSync(new URL(relativePath, functionsRoot), "utf8");
    const body = stripTypeScriptTypes(stripImports(raw)).replace(/^export\s+/gm, "");
    const sandbox = { ...baseGlobals(), ...globals, __exports: {} };
    vm.runInNewContext(`${body}\n;Object.assign(__exports,{${exportNames.join(",")}});`, sandbox);
    return sandbox.__exports;
};

const baseGlobals = () => ({
    Request, Response, URL, Headers, TextEncoder, TextDecoder, crypto: webcrypto, fetch: async () => {
        throw new Error("network disabled in handler tests");
    }, setTimeout, clearTimeout, console: { error() {}, warn() {}, log() {}, info() {} }
});

/** Load a real Edge Function index.ts. `globals` supplies its stripped imports. */
export const loadHandler = (functionName, globals) => {
    const raw = readFileSync(new URL(`${functionName}/index.ts`, functionsRoot), "utf8");
    const source = stripTypeScriptTypes(stripImports(raw));
    let handler;
    vm.runInNewContext(source, {
        ...baseGlobals(),
        createRemoteJWKSet: () => ({}),
        Deno: { env: { get: name => (name.startsWith("SUPABASE_") ? "isolated-placeholder" : "") }, serve: fn => { handler = fn; } },
        ...globals
    });
    if (!handler) throw new Error(`${functionName} did not register Deno.serve`);
    return (body, { token = "fixture-token", method = "POST" } = {}) => handler(new Request("https://isolated.invalid", {
        method,
        headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify(body) : undefined
    }));
};

/**
 * Import the real modules behind every relative (../_shared/*.ts) import of an Edge Function,
 * so newly added shared imports keep working. npm: imports are left to the caller.
 */
export const resolveRelativeImports = async (functionName, { skip = [] } = {}) => {
    const raw = readFileSync(new URL(`${functionName}/index.ts`, functionsRoot), "utf8");
    const bindings = {};
    for (const match of raw.matchAll(/^import\s*\{([^}]*)\}\s*from\s*"(\.[^"]+)";/gm)) {
        if (skip.includes(match[2])) continue;
        const module = await import(new URL(match[2], new URL(`${functionName}/`, functionsRoot)).href);
        for (const spec of match[1].split(",").map(item => item.trim()).filter(Boolean)) {
            if (spec.startsWith("type ")) continue;
            const [name, alias] = spec.split(/\s+as\s+/);
            bindings[alias || name] = module[name];
        }
    }
    return bindings;
};

export const callJson = async responsePromise => {
    const response = await responsePromise;
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body, text };
};

// ---------------------------------------------------------------------------
// In-memory Supabase admin client
// ---------------------------------------------------------------------------

const splitTopLevel = text => {
    const parts = [];
    let depth = 0, current = "";
    for (const ch of text) {
        if (ch === "(") depth += 1;
        if (ch === ")") depth -= 1;
        if (ch === "," && depth === 0) { parts.push(current.trim()); current = ""; continue; }
        current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
};

const projectRow = (row, columns) => {
    if (!columns || columns.trim() === "*" ) return { ...row };
    const out = {};
    for (const part of splitTopLevel(columns.replace(/\s+/g, ""))) {
        if (part === "*") { Object.assign(out, row); continue; }
        const nested = part.indexOf("(");
        const head = nested >= 0 ? part.slice(0, nested) : part;
        const [aliasOrName, maybeName] = head.split(":");
        const name = (maybeName || aliasOrName).split("!")[0];
        const alias = maybeName ? aliasOrName : name;
        if (name in row) out[alias] = row[name];
    }
    return out;
};

const cmp = (left, right) => {
    if (typeof left === "number" || typeof right === "number") return Number(left) - Number(right);
    return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
};
const parseLiteral = value => value === "null" ? null : value === "true" ? true : value === "false" ? false : value;
const opMatches = (rowValue, op, value) => {
    switch (op) {
        case "eq": return rowValue !== null && rowValue !== undefined && String(rowValue) === String(value);
        case "neq": return rowValue === null || rowValue === undefined || String(rowValue) !== String(value);
        case "is": return value === null ? rowValue === null || rowValue === undefined : rowValue === value;
        case "gt": return rowValue !== null && rowValue !== undefined && cmp(rowValue, value) > 0;
        case "gte": return rowValue !== null && rowValue !== undefined && cmp(rowValue, value) >= 0;
        case "lt": return rowValue !== null && rowValue !== undefined && cmp(rowValue, value) < 0;
        case "lte": return rowValue !== null && rowValue !== undefined && cmp(rowValue, value) <= 0;
        default: throw new Error(`fake supabase: unsupported operator ${op}`);
    }
};
const parseOr = expression => splitTopLevel(expression).map(clause => {
    const first = clause.indexOf(".");
    const second = clause.indexOf(".", first + 1);
    const column = clause.slice(0, first);
    const op = clause.slice(first + 1, second);
    const value = parseLiteral(clause.slice(second + 1));
    return row => opMatches(row[column], op, value);
});

/**
 * tables: { name: rows[] } (mutated in place by writes)
 * rpc: { name: (args, tables) => ({data, error}) }
 * failures: { "table:op": {message} } where op is select|insert|update|upsert|delete
 */
export const createFakeAdmin = ({ tables = {}, rpc = {}, failures = {} } = {}) => {
    const log = [];
    let nextId = 10_000;
    const rowsOf = table => (tables[table] ||= []);

    const from = table => {
        const filters = [];
        let op = "select", columns = "*", payload = null, upsertOptions = {}, countMode = null, head = false;
        let orderBy = [], limitN = null, mode = "many", returning = false;
        const q = {
            select(cols = "*", options = {}) {
                if (op === "select") { columns = cols; countMode = options.count || null; head = options.head === true; }
                else { returning = true; columns = cols; }
                return q;
            },
            insert(values) { op = "insert"; payload = values; return q; },
            update(values) { op = "update"; payload = values; return q; },
            upsert(values, options = {}) { op = "upsert"; payload = values; upsertOptions = options; return q; },
            delete() { op = "delete"; return q; },
            eq(c, v) { filters.push(r => opMatches(r[c], "eq", v)); return q; },
            neq(c, v) { filters.push(r => opMatches(r[c], "neq", v)); return q; },
            gt(c, v) { filters.push(r => opMatches(r[c], "gt", v)); return q; },
            gte(c, v) { filters.push(r => opMatches(r[c], "gte", v)); return q; },
            lt(c, v) { filters.push(r => opMatches(r[c], "lt", v)); return q; },
            lte(c, v) { filters.push(r => opMatches(r[c], "lte", v)); return q; },
            is(c, v) { filters.push(r => opMatches(r[c], "is", v)); return q; },
            in(c, values) { const set = values.map(String); filters.push(r => r[c] !== null && r[c] !== undefined && set.includes(String(r[c]))); return q; },
            ilike(c, v) { const re = new RegExp(`^${String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`, "i"); filters.push(r => re.test(String(r[c] ?? ""))); return q; },
            not(c, o, v) { filters.push(r => !opMatches(r[c], o, v)); return q; },
            or(expression) { const any = parseOr(expression); filters.push(r => any.some(fn => fn(r))); return q; },
            order(c, options = {}) { orderBy.push([c, options.ascending !== false]); return q; },
            limit(n) { limitN = n; return q; },
            range() { return q; },
            maybeSingle() { mode = "maybe"; return q; },
            single() { mode = "single"; return q; },
            then(resolve, reject) { return Promise.resolve().then(execute).then(resolve, reject); }
        };
        const matches = row => filters.every(fn => fn(row));
        const finish = rows => {
            const projected = rows.map(row => projectRow(row, columns));
            if (mode === "maybe") {
                if (projected.length > 1) return { data: null, error: { code: "PGRST116", message: "multiple rows" } };
                return { data: projected[0] || null, error: null };
            }
            if (mode === "single") {
                if (projected.length !== 1) return { data: null, error: { code: "PGRST116", message: "expected one row" } };
                return { data: projected[0], error: null };
            }
            return { data: projected, error: null, count: rows.length };
        };
        const execute = () => {
            const failure = failures[`${table}:${op}`];
            log.push({ table, op, payload, filtersCount: filters.length });
            if (failure) return { data: null, error: failure };
            const rows = rowsOf(table);
            if (op === "select") {
                let selected = rows.filter(matches);
                for (const [c, asc] of [...orderBy].reverse()) selected = [...selected].sort((a, b) => (asc ? 1 : -1) * cmp(a[c], b[c]));
                if (limitN !== null) selected = selected.slice(0, limitN);
                if (head) return { data: null, error: null, count: selected.length };
                const result = finish(selected);
                if (countMode) result.count = selected.length;
                return result;
            }
            if (op === "insert") {
                const inserted = (Array.isArray(payload) ? payload : [payload]).map(value => ({ id: nextId++, ...value }));
                rows.push(...inserted);
                return returning ? finish(inserted) : { data: null, error: null };
            }
            if (op === "update") {
                const updated = rows.filter(matches);
                updated.forEach(row => Object.assign(row, payload));
                return returning ? finish(updated) : { data: null, error: null };
            }
            if (op === "upsert") {
                const keys = String(upsertOptions.onConflict || "id").split(",").map(key => key.trim());
                const written = (Array.isArray(payload) ? payload : [payload]).map(value => {
                    const existing = rows.find(row => keys.every(key => String(row[key]) === String(value[key])));
                    if (existing) {
                        if (!upsertOptions.ignoreDuplicates) Object.assign(existing, value);
                        return existing;
                    }
                    const created = { id: nextId++, ...value };
                    rows.push(created);
                    return created;
                });
                return returning ? finish(written) : { data: null, error: null };
            }
            if (op === "delete") {
                const keep = rows.filter(row => !matches(row));
                tables[table] = keep;
                return { data: null, error: null };
            }
            throw new Error(`fake supabase: unsupported op ${op}`);
        };
        return q;
    };

    return {
        log,
        tables,
        from,
        async rpc(name, args) {
            log.push({ rpc: name, args });
            const fn = rpc[name];
            if (!fn) return { data: null, error: { message: `fake supabase: rpc ${name} not stubbed` } };
            return fn(args, tables);
        },
        writes: (table, op) => log.filter(entry => entry.table === table && (!op || entry.op === op) && entry.op !== "select"),
        reads: table => log.filter(entry => entry.table === table && entry.op === "select"),
        rpcCalls: name => log.filter(entry => entry.rpc === name)
    };
};

export const taipeiDate = (offsetDays = 0) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date(Date.now() + offsetDays * 86_400_000));
