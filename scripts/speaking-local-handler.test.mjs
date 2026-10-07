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
import * as azure from "../supabase/functions/_shared/speaking-azure-alphabet.ts";
import * as wav from "../supabase/functions/_shared/speaking-pcm-wav.ts";
const compiled = ts.transpileModule(readFileSync(new URL("../supabase/functions/pronunciation-coach/index.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness({ authorized = true, entitled = true, active = true, role = "student", hint = false, alphabet = false, providerFailure = false, denied = null, answerTemplate = "I like apples." } = {}) {
    let handler; const writes = [], reservations = [];
    const client = {
        rpc: async (name, args) => { reservations.push({ name, args });
            if (name.startsWith("claim_")) return {data:{status:"claimed",claim_token:"synthetic-claim"}};
            if (name.startsWith("record_")) return {data:{attempt_id:4,status:"open"}};
            if (name.startsWith("release_")) return {data:true};
            if (denied && name.startsWith("reserve_")) return {data:{allowed:false,code:denied}};
            return { data: { allowed: true, request_id: "test-request", challenge_usage: { daily_used: 1 } } }; },
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
                        ? { id: 1, question_set_id: 10, speaking_question_sets: { id: 10, version: 1, generation_metadata: alphabet ? {interaction_type:"alphabet_round"} : {}, books: { id: 2 } } }
                        : { model_answer: alphabet ? "A" : answerTemplate, accepted_intents: [] } };
                    if (table === "speaking_foundation_rounds") return {data:{id:"00000000-0000-4000-8000-000000000002",student_id:5,question_set_id:10,question_set_version:1,question_order:[1],next_index:0,status:"open",expires_at:new Date(Date.now()+3600000).toISOString()}};
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
        "../_shared/speaking-azure-alphabet.ts": { ...azure, assessAzureAlphabet: async () => {
            assert.equal(denied,null,"拒絕的請求不可呼叫 Azure");
            if (providerFailure) throw Object.assign(new Error("synthetic failure"),{status:502,code:"provider_failed"});
            return {assessment_kind:"azure_pronunciation",answer_match:true,recognized_text:"A",scores:{pronunciation:86,accuracy:88,fluency:85,completeness:100,prosody:null},words:[]};
        } },
        "../_shared/speaking-pcm-wav.ts": wav,
        "../_shared/speaking-pronunciation-access.ts": access,
        "../_shared/speaking-pronunciation-flow.ts": flow,
        "../_shared/speaking-recording-policy.ts": policy,
        "../_shared/speaking-page-question-mode.ts": { pageQuestionMode: () => ({ interactionType: "" }) }
    };
    vm.runInNewContext(compiled, { exports: {}, require: name => { if (!deps[name]) throw new Error(name); return deps[name]; },
        Deno: { env: { get: () => "synthetic-test-value" }, serve: fn => { handler = fn; } },
        Response, Request, File, console, setTimeout, clearTimeout,
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
test("後端以已發布括號答案重算分數，擇一或兩種都唸保存 100 分", async () => {
    for (const ending of ["Yes, it's mine.", "No, it's not.", "Yes, it's mine. No, it's not.", "No, it's not. Yes, it's mine."]) {
        const h = harness({answerTemplate:"What is this? It is a key. Is it yours? Yes, it's mine. (No, it's not.)"});
        const response = await h.handler(request({recognized_text:"What is this? It is a key. Is it yours? " + ending, scores:{completeness:78}}));
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.scores.completeness, 100);
        assert.equal(result.answer_match, true);
        const saved = h.writes.find(row => row.table === "speaking_pronunciation_attempts").value;
        assert.equal(saved.completeness_score, 100);
        assert.equal(saved.answer_match, true);
    }
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
const alphabetRequest=()=>{
 const samples=16000,bytes=new ArrayBuffer(44+samples*2),v=new DataView(bytes);const text=(at,value)=>[...value].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
 text(0,'RIFF');text(8,'WAVE');text(12,'fmt ');text(36,'data');v.setUint32(4,bytes.byteLength-8,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,samples*2,true);for(let i=44;i<bytes.byteLength;i+=2)v.setInt16(i,10000,true);
 const form=new FormData();for(const[k,value]of Object.entries({assessment_kind:'azure_alphabet_v1',question_id:'1',foundation_round_id:'00000000-0000-4000-8000-000000000002',challenge_session_id:'00000000-0000-4000-8000-000000000001',challenge_mode:'easy'}))form.set(k,value);form.set('audio',new Blob([bytes],{type:'audio/wav'}),'alphabet.wav');return new Request('https://example.invalid',{method:'POST',body:form});
};
test('今日通關及字母三次上限在 Azure 前拒絕，釋放 claim 且不寫 attempt',async()=>{
 for(const denied of ['speaking_level_completed_today','alphabet_letter_daily_limit_reached']){
  const h=harness({alphabet:true,denied});const response=await h.handler(alphabetRequest());
  assert.equal(response.status,429);assert.equal((await response.json()).code,denied);
  assert.equal(h.reservations.some(x=>x.name.startsWith('record_')),false);
  assert.ok(h.reservations.some(x=>x.name.startsWith('release_')));assert.equal(h.writes.length,0);
 }
 const local=harness({denied:'speaking_level_completed_today'});
 assert.equal((await local.handler(request())).status,429);assert.equal(local.writes.length,0);
});
test('Azure 僅限 A–Z；一般題 multipart 與 A–Z 本機文字皆拒絕',async()=>{
 const ordinary=harness();assert.equal((await ordinary.handler(alphabetRequest())).status,400);assert.equal(ordinary.reservations.length,0);
 const alpha=harness({alphabet:true});assert.equal((await alpha.handler(request())).status,409);assert.equal(alpha.reservations.length,0);
});
test('A–Z Azure 必須經錄音驗證、claim、十輪 reservation 及原本 round 交易',async()=>{
 const h=harness({alphabet:true});const response=await h.handler(alphabetRequest());assert.equal(response.status,200);const result=await response.json();assert.equal(result.scores.pronunciation,86);assert.equal(result.scores.prosody,null);assert.deepEqual(h.reservations.map(x=>x.name),['claim_speaking_foundation_round_question_v1','reserve_speaking_azure_alphabet_request_v1','record_speaking_foundation_assessment_v3']);assert.equal(h.reservations[1].args.p_audio_seconds,1);assert.equal(h.writes.at(-1).table,'speaking_pronunciation_requests');
 const failed=harness({alphabet:true,providerFailure:true});assert.equal((await failed.handler(alphabetRequest())).status,502);assert.ok(failed.reservations.some(x=>x.name.startsWith('release_')));assert.equal(failed.reservations.some(x=>x.name.startsWith('record_')),false);
});
