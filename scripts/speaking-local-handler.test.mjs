import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as reference from "../supabase/functions/_shared/speaking-pronunciation-reference.ts";
import * as foundation from "../supabase/functions/_shared/speaking-foundation-answer.ts";
import * as scoring from "../supabase/functions/_shared/speaking-completeness.ts";
import * as access from "../supabase/functions/_shared/speaking-pronunciation-access.ts";
import * as flow from "../supabase/functions/_shared/speaking-pronunciation-flow.ts";
import * as policy from "../supabase/functions/_shared/speaking-recording-policy.ts";
const compiled = ts.transpileModule(readFileSync(new URL("../supabase/functions/pronunciation-coach/index.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness({ authorized = true, entitled = true, active = true, role = "student", hint = false } = {}) {
    let handler; const writes = [], reservations = [];
    const client = {
        rpc: async (name, args) => { reservations.push({ name, args }); return { data: { allowed: true, request_id: "test-request", challenge_usage: { daily_used: 1 } } }; },
        from(table) {
            let columns = "", value;
            const q = {
                select(c) { columns = c; return q; }, eq() { return q; },
                insert(v) { writes.push({ table, value: v }); value = { id: 4 }; return q; },
                update(v) { writes.push({ table, value: v }); value = { id: "test-request" }; return q; },
                single() { return q.maybeSingle(); },
                async maybeSingle() {
                    if (value) return { data: value };
                    if (table === "speaking_questions") return { data: columns.includes("speaking_question_sets")
                        ? { id: 1, question_set_id: 10, speaking_question_sets: { id: 10, version: 1, generation_metadata: {}, books: { id: 2 } } }
                        : { model_answer: "I like apples.", accepted_intents: [] } };
                    if (table === "speaking_challenge_hint_reveals") return { data: hint ? { question_id: 1 } : null };
                    return { data: null };
                }
            }; return q;
        }
    };
    const deps = {
        "npm:@supabase/supabase-js@2": { createClient: () => client },
        "../_shared/firebase-auth.ts": { verifyFirebaseRequest: async () => {
            if (!authorized) throw Object.assign(new Error("unauthorized"), { status: 401 }); return { id: 5, role };
        } },
        "../_shared/effective-access.ts": { loadEffectiveAccess: async () => ({ is_active: active, features: { pronunciation: active } }) },
        "../_shared/book-entitlement.ts": { relationOne: value => value, assertBookEntitled: async () => {
            if (!entitled) throw Object.assign(new Error("forbidden"), { status: 403 });
        } },
        "../_shared/speaking-pronunciation-reference.ts": reference,
        "../_shared/speaking-foundation-answer.ts": foundation,
        "../_shared/speaking-completeness.ts": scoring,
        "../_shared/speaking-pronunciation-access.ts": access,
        "../_shared/speaking-pronunciation-flow.ts": flow,
        "../_shared/speaking-recording-policy.ts": policy,
        "../_shared/speaking-page-question-mode.ts": { pageQuestionMode: () => ({ interactionType: "" }) }
    };
    vm.runInNewContext(compiled, { exports: {}, require: name => { if (!deps[name]) throw new Error(name); return deps[name]; },
        Deno: { env: { get: () => "synthetic-test-value" }, serve: fn => { handler = fn; } },
        Response, Request, console, setTimeout, clearTimeout,
        fetch: () => { throw new Error("Network/provider calls are forbidden in local scoring"); } });
    return { handler, writes, reservations };
}
const request = (patch = {}) => new Request("https://example.invalid", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: 1, challenge_session_id: "00000000-0000-4000-8000-000000000001", assessment_kind: "local_completeness_v1", audio_seconds: 2, recognized_text: "I like apples.", ...patch }) });
test("實際 handler 從後端答案重算，忽略偽造分數與參考答案，不呼叫 provider", async () => {
    const h = harness(); const response = await h.handler(request({ recognized_text: "I apples", scores: { completeness: 100 }, reference_text: "I apples", answer_match: true }));
    assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.scores.completeness, 67); assert.equal(result.answer_match, false);
    assert.equal(h.reservations[0].name, "reserve_speaking_local_request_v1");
    const saved = h.writes.find(row => row.table === "speaking_pronunciation_attempts").value;
    assert.equal(saved.pronunciation_score, null); assert.equal(saved.completeness_score, 67);
});
test("無權限、無教材或失效方案不可儲存", async () => {
    for (const options of [{ authorized: false }, { entitled: false }, { active: false }]) {
        const h = harness(options); const response = await h.handler(request());
        assert.ok([401,403].includes(response.status)); assert.equal(h.writes.length, 0); assert.equal(h.reservations.length, 0);
    }
});
test("空白辨識與錯回合拒絕，舊錄音端點不再呼叫付費評分", async () => {
    for (const patch of [{ recognized_text: "" }, { challenge_session_id: "bad" }, { audio_seconds: 99 }]) {
        const h = harness(); assert.ok((await h.handler(request(patch))).status >= 400); assert.equal(h.writes.length, 0);
    }
    assert.equal((await harness().handler(new Request("https://example.invalid", { method: "POST", body: new FormData() }))).status, 409);
});
test("管理員示範不寫學生進度；提示狀態由伺服器決定", async () => {
    const demo = harness({ role: "admin" }); const result = await (await demo.handler(request())).json();
    assert.equal(result.demo_mode, true); assert.equal(demo.writes.some(row => row.table === "speaking_pronunciation_attempts"), false);
    const h = harness({ hint: true }); const hinted = await (await h.handler(request({ challenge_mode: "challenge", hint_used: false }))).json();
    assert.equal(hinted.hint_used, true);
});
