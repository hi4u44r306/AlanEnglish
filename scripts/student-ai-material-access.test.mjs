import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the real Edge handler in an isolated environment. No network, real
// credentials, student records, or database writes are used by these tests.
const source = readFileSync(new URL("../supabase/functions/generate-ai-material/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function createHandler({ role = "student", learnerType = "academy_student", validToken = true, found = true } = {}) {
    let handler;
    const calls = { tables: [], writes: [], provider: 0, access: 0 };
    const account = found ? { id: 1, name: "Test account", role, learner_type: learnerType } : null;
    const client = {
        from(table) {
            calls.tables.push(table);
            const result = { data: table === "students" ? account : table === "ai_usage_daily" ? { generation_count: 0 } : [], error: null };
            const query = {
                select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
                maybeSingle() { return Promise.resolve(result); },
                insert() { calls.writes.push(table); return Promise.resolve({ error: null }); },
                then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
            };
            return query;
        }
    };
    const dependencies = {
        "npm:@supabase/supabase-js@2": { createClient: () => client },
        "npm:jose@5": {
            createRemoteJWKSet: () => ({}),
            jwtVerify: async () => {
                if (!validToken) throw new Error("Synthetic invalid token");
                return { payload: { sub: "synthetic-firebase-uid" } };
            }
        },
        "../_shared/effective-access.ts": {
            loadEffectiveAccess: async () => {
                calls.access += 1;
                return { is_active: true, ai_daily_limit: 5, plan_codes: [], features: { ai_materials: true, pronunciation: true } };
            }
        },
        "../_shared/ai-material-quality.ts": { getDifficultyGuide: () => "Test guide", balanceCorrectAnswerPositions: value => value },
        "../_shared/membership-pricing.ts": { isAiAddonPlanCode: () => false }
    };
    vm.runInNewContext(compiled, {
        exports: {}, URL, Request, Response, console,
        require(name) {
            assert.ok(dependencies[name], `Unexpected import: ${name}`);
            return dependencies[name];
        },
        Deno: {
            serve: callback => { handler = callback; },
            env: { get: () => "synthetic-test-only" }
        },
        fetch: async () => {
            calls.provider += 1;
            return new Response(JSON.stringify({ error: { code: "synthetic_provider_error" } }), { status: 503 });
        }
    });
    return { handler, calls };
}

const request = (action, extra = {}) => new Request("https://example.invalid/generate-ai-material", {
    method: "POST",
    headers: { Authorization: "Bearer synthetic-test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra })
});

for (const learnerType of ["academy_student", "textbook_customer", "trial_user"]) {
    test(`${learnerType}: every personal AI operation is rejected before usage or provider calls`, async () => {
        for (const action of ["generate", "status", "history", "attempt", "favorite", "review", "cost_dashboard", "update_cost_budget", "unknown"]) {
            const { handler, calls } = createHandler({ learnerType });
            const response = await handler(request(action, { role: "admin", student_id: 999, topic: "Animals" }));
            assert.equal(response.status, 403);
            assert.equal((await response.json()).code, "student_ai_materials_disabled");
            assert.deepEqual(calls.tables, ["students"]);
            assert.deepEqual(calls.writes, []);
            assert.equal(calls.provider, 0);
            assert.equal(calls.access, 0);
        }
    });
}

test("unknown database roles cannot impersonate staff", async () => {
    const { handler, calls } = createHandler({ role: "Teacher" });
    assert.equal((await handler(request("generate", { role: "admin" }))).status, 403);
    assert.equal(calls.provider, 0);
});

for (const role of ["teacher", "admin"]) {
    test(`${role}: usage and history remain accessible`, async () => {
        for (const action of ["status", "history"]) {
            const { handler } = createHandler({ role });
            assert.equal((await handler(request(action))).status, 200);
        }
    });
    test(`${role}: generation still reaches the provider`, async () => {
        const { handler, calls } = createHandler({ role });
        const response = await handler(request("generate", { topic: "Animals", question_count: 3 }));
        assert.equal(calls.provider, 1);
        assert.equal(response.status, 502); // The isolated provider intentionally fails.
        assert.ok(calls.writes.includes("ai_api_usage_logs"));
    });
}

test("authentication and account lookup are still required", async () => {
    const { handler } = createHandler();
    assert.equal((await handler(new Request("https://example.invalid", { method: "POST" }))).status, 401);
    assert.equal((await createHandler({ validToken: false }).handler(request("generate"))).status, 401);
    assert.equal((await createHandler({ found: false }).handler(request("generate"))).status, 404);
});

test("preflight remains available", async () => {
    const { handler, calls } = createHandler();
    assert.equal((await handler(new Request("https://example.invalid", { method: "OPTIONS" }))).status, 200);
    assert.deepEqual(calls.tables, []);
});

test("actual application route is staff-only while speaking routes remain available to students", () => {
    const app = readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
    const aiRoute = app.split(/\r?\n/).find(line => line.includes('path="/student/ai-generator"'));
    assert.match(aiRoute, /allowedRoles=\{\["teacher", "admin"\]\}/);
    for (const route of ["/student/speaking-challenges", "/student/speaking-challenges/book/:bookKey", "/student/speaking-challenges/:questionSetId"]) {
        const declaration = app.split(/\r?\n/).find(line => line.includes(`path="${route}"`));
        assert.match(declaration, /allowedRoles=\{\["student", "teacher", "admin"\]\}/);
    }
});
