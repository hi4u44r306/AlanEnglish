// Behaviour tests for the pre-launch access fixes. Each test loads the real Edge Function
// handler (TypeScript stripped by Node), captures it through a stubbed Deno.serve and runs it
// against an in-memory fake Supabase admin client. Nothing touches a network or a database.
//   node --test scripts/security-access-handlers.test.mjs
// SECURITY_TEST_FUNCTIONS_ROOT=<dir>/supabase/functions runs the same tests against another
// copy of the functions (used to confirm the tests fail on the old code).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const FUNCTIONS_ROOT = process.env.SECURITY_TEST_FUNCTIONS_ROOT
    ? pathToFileURL(path.resolve(process.env.SECURITY_TEST_FUNCTIONS_ROOT) + path.sep)
    : new URL("../supabase/functions/", import.meta.url);

const STUB_SOURCE = `
const g = () => globalThis.__securityStubs;
export const createClient = (...args) => g().createClient(...args);
export class SupabaseClient {}
export const createRemoteJWKSet = () => ({});
export const jwtVerify = (...args) => g().jwtVerify(...args);
export const importPKCS8 = async () => ({});
export class SignJWT { setProtectedHeader() { return this; } setIssuer() { return this; } setSubject() { return this; } setAudience() { return this; } setIssuedAt() { return this; } setExpirationTime() { return this; } async sign() { return "signed"; } }
export class AwsClient { async sign(request) { return request; } async fetch(url, init) { return g().r2Fetch(String(url), init || {}); } }
`;

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("npm:")) return { url: `security-stub:${specifier}`, shortCircuit: true };
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url.startsWith("security-stub:")) return { format: "module", source: STUB_SOURCE, shortCircuit: true };
        if (url.startsWith("file:") && new URL(url).pathname.endsWith(".ts")) {
            const source = readFileSync(fileURLToPath(new URL(url).href.split("?")[0]), "utf8");
            return { format: "module", source: stripTypeScriptTypes(source), shortCircuit: true };
        }
        return nextLoad(url, context);
    }
});

// ---------- fake Supabase ----------
const likeToRegExp = pattern => new RegExp(`^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "i");
const cmp = (a, b) => (a === b ? 0 : a === null || a === undefined ? -1 : b === null || b === undefined ? 1 : a < b ? -1 : 1);
const parseOrValue = value => (value === "null" ? null : value);

function fakeDb(tables, options = {}) {
    const log = [];
    let nextId = 10000;
    const unique = options.unique || { students: row => String(row.email || "").trim().toLowerCase() || null };
    const table = name => (tables[name] ||= []);
    const conflict = (name, row, ignore) => {
        const key = unique[name];
        if (!key) return false;
        const value = key(row);
        return value !== null && table(name).some(other => other !== ignore && key(other) === value);
    };
    class Query {
        constructor(name) { Object.assign(this, { name, op: "select", filters: [], orders: [], limitN: null, mode: "many", head: false, count: false, payload: null, upsertKeys: null }); }
        select(columns, opts = {}) { if (this.op === "select") { this.columns = columns; this.head = Boolean(opts.head); this.count = Boolean(opts.count); } return this; }
        insert(payload) { this.op = "insert"; this.payload = payload; return this; }
        update(payload) { this.op = "update"; this.payload = payload; return this; }
        upsert(payload, opts = {}) { this.op = "upsert"; this.payload = payload; this.upsertKeys = String(opts.onConflict || "id").split(","); return this; }
        delete() { this.op = "delete"; return this; }
        filter(key, fn) { if (!key.includes(".") && !key.includes("->")) this.filters.push(row => fn(row[key])); return this; }
        eq(k, v) { return this.filter(k, x => x === v); }
        neq(k, v) { return this.filter(k, x => x !== v); }
        in(k, list) { return this.filter(k, x => list.includes(x)); }
        is(k, v) { return this.filter(k, x => (v === null ? x === null || x === undefined : x === v)); }
        not(k, op, v) { return op === "is" ? this.filter(k, x => !(v === null || v === "null" ? x === null || x === undefined : x === v)) : this; }
        lte(k, v) { return this.filter(k, x => x !== null && x !== undefined && x <= v); }
        lt(k, v) { return this.filter(k, x => x !== null && x !== undefined && x < v); }
        gte(k, v) { return this.filter(k, x => x !== null && x !== undefined && x >= v); }
        gt(k, v) { return this.filter(k, x => x !== null && x !== undefined && x > v); }
        like(k, v) { return this.filter(k, x => likeToRegExp(v).test(String(x ?? ""))); }
        ilike(k, v) { return this.filter(k, x => likeToRegExp(v).test(String(x ?? ""))); }
        or(expression) {
            const parts = String(expression).split(",").map(part => part.split("."));
            this.filters.push(row => parts.some(([col, op, ...rest]) => {
                const value = parseOrValue(rest.join("."));
                const x = row[col];
                if (op === "is") return value === null ? x === null || x === undefined : x === value;
                if (op === "gte") return x !== null && x !== undefined && x >= value;
                if (op === "gt") return x !== null && x !== undefined && x > value;
                if (op === "eq") return String(x) === value;
                return false;
            }));
            return this;
        }
        order(k, opts = {}) { this.orders.push([k, opts.ascending !== false]); return this; }
        limit(n) { this.limitN = n; return this; }
        maybeSingle() { this.mode = "maybe"; return this; }
        single() { this.mode = "single"; return this; }
        run() {
            log.push({ table: this.name, op: this.op, payload: this.payload });
            const rows = table(this.name);
            const matches = rows.filter(row => this.filters.every(fn => fn(row)));
            let out;
            if (this.op === "select") {
                out = [...matches];
                for (const [k, asc] of [...this.orders].reverse()) out.sort((a, b) => (asc ? 1 : -1) * cmp(a[k], b[k]));
                if (this.limitN !== null) out = out.slice(0, this.limitN);
                if (this.head) return { data: null, count: out.length, error: null };
            } else if (this.op === "insert") {
                out = [];
                for (const item of [].concat(this.payload)) {
                    const row = { id: nextId++, ...item };
                    if (conflict(this.name, row)) return { data: null, error: { code: "23505", message: "duplicate" } };
                    rows.push(row); out.push(row);
                }
            } else if (this.op === "update") {
                for (const row of matches) Object.assign(row, this.payload);
                out = matches;
            } else if (this.op === "upsert") {
                out = [];
                for (const item of [].concat(this.payload)) {
                    const existing = rows.find(row => this.upsertKeys.every(k => row[k] === item[k]));
                    if (existing) { Object.assign(existing, item); out.push(existing); } else { const row = { id: nextId++, ...item }; rows.push(row); out.push(row); }
                }
            } else {
                tables[this.name] = rows.filter(row => !matches.includes(row));
                out = matches;
            }
            const copies = out.map(row => ({ ...row }));
            if (this.mode === "many") return { data: copies, error: null, count: copies.length };
            if (this.mode === "single" && copies.length !== 1) return { data: null, error: { code: "PGRST116", message: "not single" } };
            return { data: copies[0] || null, error: null };
        }
        then(resolve, reject) { return Promise.resolve().then(() => this.run()).then(resolve, reject); }
    }
    const storageBucket = () => ({
        createSignedUploadUrl: async p => ({ data: { path: p, token: "upload-token" }, error: null }),
        createSignedUrl: async p => ({ data: { signedUrl: `signed:${p}` }, error: null }),
        createSignedUrls: async paths => ({ data: paths.map(p => ({ path: p, signedUrl: `signed:${p}` })), error: null }),
        remove: async () => ({ data: [], error: null }),
        list: async () => ({ data: [], error: null })
    });
    return {
        log,
        tables,
        from: name => new Query(name),
        rpc: async (name, args) => {
            log.push({ rpc: name, args });
            const handler = options.rpc?.[name];
            return handler ? handler(args) : { data: null, error: null };
        },
        storage: { from: storageBucket }
    };
}

// ---------- loading a real handler ----------
let loadCounter = 0;
const tokenFor = ({ uid, email = "", verified = false }) => `${uid}|${email}|${verified ? 1 : 0}`;
const parseToken = token => {
    const [uid, email, verified] = String(token).split("|");
    if (!uid) throw new Error("bad token");
    return { sub: uid, email: email || undefined, email_verified: verified === "1" };
};

async function loadHandler(functionName, db, { env = {}, r2Objects = new Set(), fetchLog = [] } = {}) {
    let handler = null;
    const environment = {
        SUPABASE_URL: "https://isolated.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "isolated-placeholder",
        FIREBASE_WEB_API_KEY: "isolated-placeholder",
        ...env
    };
    globalThis.Deno = { env: { get: key => environment[key] }, serve: fn => { handler = fn; } };
    globalThis.__securityStubs = {
        createClient: () => db,
        jwtVerify: async token => ({ payload: parseToken(token) }),
        r2Fetch: async (url, init) => {
            const key = decodeURIComponent(new URL(url).pathname.split("/").slice(2).join("/"));
            fetchLog.push({ r2: init.method || "GET", key });
            return new Response(null, { status: r2Objects.has(key) ? 200 : 404 });
        }
    };
    globalThis.fetch = async (url, init = {}) => {
        const text = String(url);
        fetchLog.push({ url: text });
        if (text.includes("accounts:lookup")) {
            const claims = parseToken(JSON.parse(init.body).idToken);
            return Response.json({ users: [{ localId: claims.sub, email: claims.email, emailVerified: claims.email_verified }] });
        }
        if (text.includes("accounts:sendOobCode")) return Response.json({ email: "sent" });
        if (text.includes("api.resend.com")) return Response.json({ id: "resend-fixture" });
        return Response.json({}, { status: 404 });
    };
    await import(`${new URL(`${functionName}/index.ts`, FUNCTIONS_ROOT).href}?load=${++loadCounter}`);
    assert.ok(handler, `${functionName} did not call Deno.serve`);
    return (body, user) => handler(new Request("https://isolated.invalid/fn", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Origin: "https://alanenglish.com.tw",
            ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {})
        },
        body: JSON.stringify(body)
    }));
}
// Handlers log expected failures; keep the test output readable (SECURITY_TEST_DEBUG=1 shows them).
console.error = (...args) => {
    if (process.env.SECURITY_TEST_DEBUG) process.stderr.write(`${args.map(item => item?.stack || JSON.stringify(item)).join(" ")}\n`);
};

// ---------- shared fixtures ----------
const ADMIN = { uid: "uid-admin", email: "boss@school.tw", verified: true };
const TEACHER = { uid: "uid-teacher-e1", email: "teacher@school.tw", verified: true };
const STUDENT_E1 = { uid: "uid-e1", email: "kid1@school.tw", verified: true };
const academyTables = () => ({
    students: [
        { id: 1, firebase_uid: ADMIN.uid, email: ADMIN.email, name: "Admin", role: "admin", account_status: "active" },
        { id: 10, firebase_uid: TEACHER.uid, email: TEACHER.email, name: "Teacher E1", role: "teacher", account_status: "active" },
        { id: 101, firebase_uid: STUDENT_E1.uid, email: STUDENT_E1.email, name: "王小明", english_name: "Amy Wang", class: "E1", role: "student", learner_type: "academy_student", account_status: "active", user_image: "student-101/me.png" },
        { id: 107, firebase_uid: "uid-e7", email: "kid7@school.tw", name: "陳大華", english_name: "Ben Chen", class: "E7", role: "student", learner_type: "academy_student", account_status: "active", user_image: "student-107/me.png" }
    ],
    academy_classes: [{ id: 1, code: "E1", name_zh: "E1 班", is_active: true, sort_order: 1 }, { id: 7, code: "E7", name_zh: "E7 班", is_active: true, sort_order: 4 }],
    teacher_class_permissions: [{ id: 1, teacher_id: 10, class_id: 1, can_publish: true, starts_at: "2026-01-01", ends_at: null, academy_classes: { code: "E1" } }],
    academy_enrollments: [{ id: 1, student_id: 101, class_id: 1, status: "active" }, { id: 2, student_id: 107, class_id: 7, status: "active" }],
    guardian_contacts: [
        { id: 501, student_id: 101, guardian_name: "Parent 1", email: "p1@home.tw", email_verified_at: "2026-10-01T00:00:00Z", notification_enabled: true },
        { id: 507, student_id: 107, guardian_name: "Parent 7", email: "p7@home.tw", email_verified_at: "2026-10-01T00:00:00Z", notification_enabled: true }
    ],
    notification_logs: [{ id: 901, student_id: 101, channel: "email", status: "draft" }, { id: 907, student_id: 107, channel: "email", status: "draft" }],
    guardian_email_settings: [{ id: 1, enabled: true, from_email: "reports@school.tw", from_name: "Alan English" }],
    subscription_plans: [{ id: 3, code: "trial_7_day", trial_days: 7, enabled: true }],
    learning_levels: [{ id: 1, code: "starter", rank: 1 }, { id: 2, code: "pre_intermediate", rank: 2 }],
});

// ---------- 1. impersonation ----------
test("link-manager: a Firebase email with `_` cannot act as the admin whose email it pattern-matches", async () => {
    const db = fakeDb({ students: [{ id: 1, firebase_uid: "uid-real-admin", email: "alan@school.tw", role: "admin" }], links: [{ id: 1, title: "secret" }] });
    const call = await loadHandler("link-manager", db);
    const response = await call({ action: "list" }, { uid: "uid-attacker", email: "al_n@school.tw", verified: false });
    assert.equal(response.status, 404);
    assert.ok(!db.log.some(entry => entry.table === "links"), "links must not be read");
});

test("membership-manager: `_` wildcard email cannot bind or use another student's row", async () => {
    const db = fakeDb({ students: [{ id: 5, firebase_uid: null, email: "alan@school.tw", name: "Victim", role: "student", account_status: "active" }] });
    const call = await loadHandler("membership-manager", db);
    for (const verified of [false, true]) {
        const response = await call({ action: "notifications" }, { uid: "uid-attacker", email: "al_n@school.tw", verified });
        assert.equal(response.status, 404);
    }
    assert.equal(db.tables.students[0].firebase_uid, null);
});

test("membership-manager: an unverified exact email is not bound; a verified one still is", async () => {
    const db = fakeDb({ students: [{ id: 5, firebase_uid: null, email: "pre@school.tw", name: "Pre-created", role: "student", account_status: "active" }] });
    const call = await loadHandler("membership-manager", db);
    const unverified = await call({ action: "notifications" }, { uid: "uid-new", email: "PRE@school.tw", verified: false });
    assert.equal(unverified.status, 404);
    assert.equal(db.tables.students[0].firebase_uid, null);
    const verified = await call({ action: "notifications" }, { uid: "uid-new", email: "PRE@school.tw", verified: true });
    assert.equal(verified.status, 200);
    assert.equal(db.tables.students[0].firebase_uid, "uid-new");
});

// ---------- 2. paid store order claim ----------
const claimDb = () => fakeDb({ students: [], subscription_plans: [{ id: 3, code: "trial_7_day", trial_days: 7, enabled: true }], learning_levels: [{ id: 1, code: "starter", rank: 1 }, { id: 2, code: "pre_intermediate", rank: 2 }], }, {
    rpc: { claim_paid_store_orders_for_student: () => ({ data: { claimed_orders: 0, claimed_books: 0 }, error: null }) }
});
const claimCalls = db => db.log.filter(entry => entry.rpc === "claim_paid_store_orders_for_student");

test("complete_signup with an unverified email creates the account but does not claim paid orders", async () => {
    const db = claimDb();
    const call = await loadHandler("membership-manager", db);
    const buyer = { uid: "uid-buyer", email: "buyer@gmail.com", verified: false };
    const response = await call({ action: "complete_signup", name: "Buyer" }, buyer);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).email_verification_required, true);
    assert.equal(claimCalls(db).length, 0);
    assert.equal(db.tables.students.length, 1);

    // Later profile loads: still unverified -> nothing; verified -> claimed for that email.
    assert.equal((await call({ action: "profile" }, buyer)).status, 200);
    assert.equal(claimCalls(db).length, 0);
    assert.equal((await call({ action: "profile" }, { ...buyer, verified: true })).status, 200);
    assert.equal(claimCalls(db).length, 1);
    assert.deepEqual(claimCalls(db)[0].args, { p_student_id: db.tables.students[0].id, p_email: "buyer@gmail.com" });
});

test("complete_signup with a verified email claims paid orders", async () => {
    const db = claimDb();
    const call = await loadHandler("membership-manager", db);
    const response = await call({ action: "complete_signup", name: "Buyer" }, { uid: "uid-buyer", email: "buyer@gmail.com", verified: true });
    assert.equal(response.status, 200);
    assert.equal(claimCalls(db).length, 1);
});

// ---------- 3. teacher class scope ----------
test("learning-activity: E1 teacher is refused for an E7 student; admin is allowed", async () => {
    const db = fakeDb(academyTables());
    const call = await loadHandler("learning-activity", db);
    const dashboard = await (await call({ action: "teacher_dashboard" }, TEACHER)).json();
    assert.deepEqual(dashboard.students.map(student => student.id), [101]);
    for (const body of [
        { action: "guardian_upsert", student_id: 107, email: "p7@home.tw" },
        { action: "notification_draft", student_id: 107 },
        { action: "notification_mark_sent", notification_id: 907 }
    ]) {
        assert.equal((await call(body, TEACHER)).status, 403, body.action);
        assert.equal((await call(body, ADMIN)).status, 200, `admin ${body.action}`);
    }
    assert.equal((await call({ action: "guardian_upsert", student_id: 101, email: "p1@home.tw" }, TEACHER)).status, 200);
    const adminDashboard = await (await call({ action: "teacher_dashboard" }, ADMIN)).json();
    assert.deepEqual(adminDashboard.students.map(student => student.id).sort(), [101, 107]);
});

test("weekly-report: E1 teacher only lists and reports E1 students; admin can open E7", async () => {
    const db = fakeDb(academyTables());
    const call = await loadHandler("weekly-report", db);
    assert.equal((await call({ action: "report", student_id: 107 }, TEACHER)).status, 403);
    assert.equal((await call({ action: "guardian_draft", student_id: 107 }, TEACHER)).status, 403);
    const own = await call({ action: "report", student_id: 101 }, TEACHER);
    assert.equal(own.status, 200);
    assert.deepEqual((await own.json()).students.map(student => student.id), [101]);
    const adminView = await call({ action: "report", student_id: 107 }, ADMIN);
    assert.equal(adminView.status, 200);
    assert.equal((await adminView.json()).report.student.id, 107);
});

test("membership-manager: list_accounts and update_account are scoped to the teacher's classes", async () => {
    const db = fakeDb(academyTables());
    const call = await loadHandler("membership-manager", db);
    const listed = await (await call({ action: "list_accounts" }, TEACHER)).json();
    assert.deepEqual(listed.accounts.map(account => account.id), [101]);
    assert.equal((await call({ action: "update_account", id: 107, name: "陳大華", role: "student", class: "E7" }, TEACHER)).status, 403);
    assert.equal((await call({ action: "update_account", id: 107, name: "陳大華", role: "student", class: "E7" }, ADMIN)).status, 200);
    assert.equal((await call({ action: "update_account", id: 101, name: "王小明2", role: "student", class: "E1" }, TEACHER)).status, 200);
});

test("guardian-email: E1 teacher cannot send an E7 report or see E7 send logs; admin can send", async () => {
    const db = fakeDb(academyTables());
    const call = await loadHandler("guardian-email", db, { env: { RESEND_API_KEY: "isolated-placeholder" } });
    assert.equal((await call({ action: "send_one", student_id: 107 }, TEACHER)).status, 403);
    const status = await (await call({ action: "status" }, TEACHER)).json();
    assert.ok(status.recent.every(row => row.student_id === 101), "teacher only sees E1 logs");
    const adminSend = await call({ action: "send_one", student_id: 107 }, ADMIN);
    assert.equal(adminSend.status, 200);
    assert.notEqual((await adminSend.json()).results?.[0]?.status, undefined);
});

test("academy-student-manager: E1 teacher cannot create, list or reset outside E1; admin can", async () => {
    const db = fakeDb(academyTables());
    db.tables.academy_account_invitations = [
        { id: 61, class_id: 1, status: "active", invited_email: "a@x.tw", expires_at: "2099-01-01T00:00:00Z", created_at: "2026-11-01", academy_classes: { code: "E1" } },
        { id: 67, class_id: 7, status: "active", invited_email: "b@x.tw", expires_at: "2099-01-01T00:00:00Z", created_at: "2026-11-02", academy_classes: { code: "E7" } }
    ];
    const call = await loadHandler("academy-student-manager", db);
    const invite = { action: "create_invitation", chinese_name: "林同學", english_name: "Lin", class_code: "E7", login_email: "newkid@gmail.com" };
    assert.equal((await call(invite, TEACHER)).status, 403);
    assert.equal((await call({ action: "create_student", chinese_name: "林同學", english_name: "Lin", class_code: "E7", login_username: "linkid" }, TEACHER)).status, 403);
    assert.equal((await call({ action: "send_password_reset", email: "kid7@school.tw" }, TEACHER)).status, 403);
    const listed = await (await call({ action: "list_invitations" }, TEACHER)).json();
    assert.deepEqual(listed.invitations.map(item => item.id), [61]);
    const classes = await (await call({ action: "list_classes" }, TEACHER)).json();
    assert.deepEqual(classes.classes.map(item => item.code), ["E1"]);
    assert.equal((await call({ action: "send_password_reset", email: "kid1@school.tw" }, TEACHER)).status, 200);
    assert.equal((await call(invite, ADMIN)).status, 201);
    assert.equal((await call({ action: "send_password_reset", email: "kid7@school.tw" }, ADMIN)).status, 200);
});

// ---------- 4. update_account keeps learner_type ----------
test("update_account keeps learner_type and blocks teacher class changes", async () => {
    const tables = academyTables();
    tables.students.push(
        { id: 120, firebase_uid: "uid-buyer", email: "buyer@gmail.com", name: "Buyer", role: "student", class: null, learner_type: "textbook_customer", account_status: "active" },
        { id: 130, firebase_uid: "uid-ex-teacher", email: "ex@school.tw", name: "Ex Teacher", role: "teacher", class: null, learner_type: null, account_status: "active" }
    );
    const db = fakeDb(tables);
    const call = await loadHandler("membership-manager", db);
    const byId = id => db.tables.students.find(row => row.id === id);

    assert.equal((await call({ action: "update_account", id: 120, name: "Buyer Renamed", role: "student", class: null }, ADMIN)).status, 200);
    assert.equal(byId(120).learner_type, "textbook_customer");
    assert.equal((await call({ action: "update_account", id: 107, name: "陳大華", role: "student", class: "E5" }, ADMIN)).status, 200);
    assert.equal(byId(107).learner_type, "academy_student");
    assert.equal(byId(107).class, "E5");

    const moved = await call({ action: "update_account", id: 101, name: "王小明", role: "student", class: "E3" }, TEACHER);
    assert.equal(moved.status, 403);
    assert.equal(byId(101).class, "E1");

    assert.equal((await call({ action: "update_account", id: 130, name: "Ex Teacher", role: "student", class: "E3" }, ADMIN)).status, 200);
    assert.equal(byId(130).learner_type, "academy_student");
    assert.equal((await call({ action: "update_account", id: 130, name: "Ex Teacher", role: "student", class: null }, ADMIN)).status, 400);
});

// ---------- 5. music-admin overwrite ----------
const musicTables = () => ({
    students: [
        { id: 1, firebase_uid: ADMIN.uid, role: "admin" },
        { id: 10, firebase_uid: TEACHER.uid, role: "teacher" }
    ],
    books: [{ id: 3, code: "WB1", name: "Workbook 1", enabled: true, archived_at: null }],
    music_tracks: [{ id: 40, book_id: 3, track_key: "p10-main", audio_url: "WB1/P10.mp3", storage_provider: "r2" }],
    audio_storage_settings: [{ singleton: true, upload_provider: "r2", r2_cors_configured_at: "2026-09-01T00:00:00Z" }]
});
const R2_ENV = { R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "isolated-placeholder", R2_SECRET_ACCESS_KEY: "isolated-placeholder", R2_BUCKET_NAME: "music", R2_ENDPOINT: "https://r2.isolated.invalid" };

test("music-admin: a new track_key cannot get a write URL over an existing file", async () => {
    const db = fakeDb(musicTables());
    const r2Objects = new Set(["WB1/P10.mp3", "WB1/orphan.mp3"]);
    const call = await loadHandler("music-admin", db, { env: R2_ENV, r2Objects });
    const reuse = await call({ action: "create_upload", book_id: 3, track_key: "p10-copy", storage_path: "WB1/P10.mp3" }, TEACHER);
    assert.equal(reuse.status, 409);
    assert.equal((await reuse.json()).code, "storage_path_in_use");
    assert.equal((await call({ action: "create_upload", book_id: 3, track_key: "p10-copy", storage_path: "WB1/P10.mp3" }, ADMIN)).status, 409);

    const orphanTeacher = await call({ action: "create_upload", book_id: 3, track_key: "p11", storage_path: "WB1/orphan.mp3" }, TEACHER);
    assert.equal(orphanTeacher.status, 409);
    assert.equal((await orphanTeacher.json()).code, "storage_object_exists");
    assert.equal((await call({ action: "create_upload", book_id: 3, track_key: "p11", storage_path: "WB1/orphan.mp3" }, ADMIN)).status, 200);

    const fresh = await call({ action: "create_upload", book_id: 3, track_key: "p12", storage_path: "WB1/P12.mp3" }, TEACHER);
    assert.equal(fresh.status, 200);
    assert.equal((await fresh.json()).provider, "r2");
});

test("music-admin: only an admin can delete a track; teachers can still rename", async () => {
    const db = fakeDb(musicTables());
    const call = await loadHandler("music-admin", db, { env: R2_ENV, r2Objects: new Set(["WB1/P10.mp3"]) });
    assert.equal((await call({ action: "update_display_name", track_id: 40, display_page: "P10 新名稱" }, TEACHER)).status, 200);
    assert.equal((await call({ action: "delete_track", track_id: 40 }, TEACHER)).status, 403);
    assert.equal(db.tables.music_tracks.length, 1);
    assert.equal((await call({ action: "delete_track", track_id: 40 }, ADMIN)).status, 200);
    assert.equal(db.tables.music_tracks.length, 0);
});

// ---------- 6. leaderboard ----------
test("gamification leaderboard: students only get masked names; staff still get full ones", async () => {
    const tables = academyTables();
    tables.student_social_profiles = [{ student_id: 107, nickname: null }];
    tables.students.push({ id: 108, firebase_uid: "uid-e7b", email: "kid8@school.tw", name: "李小美", chinese_name: "李小美", english_name: "Cathy Lee", class: "E7", role: "student", account_status: "active", user_image: "student-108/me.png" });
    // A web-signup student whose self-typed name is rude, and a student with a rude nickname.
    tables.students.push({ id: 109, firebase_uid: "uid-web", email: "web@school.tw", name: "靠北王", chinese_name: null, english_name: null, class: null, role: "student", account_status: "active", user_image: "/default-avatars/alan-cat.png" });
    tables.student_social_profiles.push({ student_id: 108, nickname: "性愛" });
    for (const row of tables.students) {
        if (row.id === 107) row.chinese_name = "陳大華";
        if (row.id === 101) row.chinese_name = "王小明";
    }
    const rows = [
        { rank_position: 1, student_id: 107, student_name: "Ben Chen", class_name: "E7", avatar_path: "student-107/me.png", period_xp: 90, total_xp: 900, points_balance: 50 },
        { rank_position: 2, student_id: 108, student_name: "Cathy Lee", class_name: "E7", avatar_path: "student-108/me.png", period_xp: 80, total_xp: 800, points_balance: 40 },
        { rank_position: 3, student_id: 109, student_name: "靠北王", class_name: null, avatar_path: "/default-avatars/alan-cat.png", period_xp: 75, total_xp: 750, points_balance: 0 },
        { rank_position: 4, student_id: 101, student_name: "Amy Wang", class_name: "E1", avatar_path: "student-101/me.png", period_xp: 70, total_xp: 700, points_balance: 30 }
    ];
    const db = fakeDb(tables, { rpc: { get_gamification_leaderboard: () => ({ data: rows.map(row => ({ ...row })), error: null }) } });
    const call = await loadHandler("gamification", db);

    const asStudent = await (await call({ action: "leaderboard", scope: "overall" }, STUDENT_E1)).json();
    // The whole response, including the caller's own row, never carries a full real name.
    const text = JSON.stringify(asStudent.leaderboard);
    for (const secret of ["Ben Chen", "Cathy Lee", "Amy Wang", "陳大華", "李小美", "王小明"]) {
        assert.ok(!text.includes(secret), `leaked ${secret}`);
    }
    const othersText = JSON.stringify(asStudent.leaderboard.filter(row => !row.is_current_user));
    for (const secret of ["student-107", "student-108", "\"E7\"", "points_balance"]) {
        assert.ok(!othersText.includes(secret), `leaked ${secret}`);
    }
    const [ben, cathy, web, me] = asStudent.leaderboard;
    assert.equal(ben.display_name, "陳〇華");
    assert.equal(ben.student_name, "陳〇華");
    assert.equal(ben.avatar_url, null, "another student's uploaded photo is never shown");
    assert.equal(ben.class_name, null);
    assert.equal(cathy.display_name, "李〇美");
    assert.equal(web.display_name, "靠〇王");
    assert.equal(web.avatar_url, "/default-avatars/alan-cat.png", "system avatars may be shown");
    assert.equal(me.is_current_user, true);
    assert.equal(me.display_name, "王〇明");
    assert.ok(me.avatar_url);

    const asStaff = await (await call({ action: "leaderboard", scope: "overall" }, TEACHER)).json();
    assert.equal(asStaff.leaderboard[0].display_name, "陳大華");
    assert.equal(asStaff.leaderboard[1].nickname, "性愛");
    assert.equal(asStaff.leaderboard[0].class_name, "E7");
    assert.ok(asStaff.leaderboard[0].avatar_url);
});

test("learning-progress leaderboard is retired (410) so it cannot leak names", async () => {
    const call = await loadHandler("learning-progress", fakeDb(academyTables(), {}));
    const response = await call({ action: "leaderboard" }, STUDENT_E1);
    assert.equal(response.status, 410);
});
