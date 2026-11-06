// Behaviour tests for supabase/functions/speaking-challenge/index.ts: the sequential unlock gate
// (assertStudentChallengeUnlocked) and the server-side completion checks of complete_question.
// Real handler + real _shared modules; firebase-auth.ts runs in a sandbox with jwtVerify stubbed so
// its account_status check is exercised; R2 signing is stubbed.
// Run: node --experimental-strip-types --test scripts/speaking-challenge-gates-handler.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { callJson, createFakeAdmin, loadHandler, loadSharedInSandbox, resolveRelativeImports } from "./edge-handler-harness.mjs";

const shared = await resolveRelativeImports("speaking-challenge", { skip: ["../_shared/r2.ts", "../_shared/firebase-auth.ts"] });
const SESSION = "3f1c2b8a-1d2e-4f5a-9b6c-7d8e9f0a1b2c";
const OTHER_SESSION = "4a2d3c9b-2e3f-4a6b-8c7d-8e9f0a1b2c3d";
const minutesAgo = minutes => new Date(Date.now() - minutes * 60_000).toISOString();

const book = { id: 3, name: "Workbook 3", code: "W3", content_scope: "formal", enabled: true, archived_at: null };
const set = (id, page, questionId) => ({
    id, book_id: 3, title: `P${page} 練習`, status: "published", version: 1, topic: "t", difficulty: "easy",
    intro_zh: "", learning_goal_zh: "", generation_metadata: { source_pages: [page] }, books: book,
    speaking_questions: [{ id: questionId }]
});

const baseTables = () => ({
    students: [
        { id: 7, firebase_uid: "uid-student", name: "S", role: "student", account_status: "active", learner_type: "textbook_customer" },
        { id: 8, firebase_uid: "uid-other", name: "O", role: "student", account_status: "active" },
        { id: 9, firebase_uid: "uid-archived", name: "A", role: "student", account_status: "archived" },
        { id: 20, firebase_uid: "uid-teacher", name: "T", role: "teacher", account_status: "active" }
    ],
    speaking_question_sets: [set(41, 4, 4101), set(42, 5, 4201), set(43, 6, 4301)],
    speaking_questions: [4101, 4201, 4301].map((id, index) => ({
        id, question_set_id: 41 + index, sort_order: 1, question_text: "What is it?", hint_zh: "提示",
        keywords: [], simple_answer: "It is an apple.", model_answer: "It is an apple.", follow_up_question: "",
        pronunciation_notes_zh: "", visual_aid: null
    })),
    speaking_challenge_mode_progress: [{ student_id: 7, question_id: 4101 }],
    speaking_pronunciation_attempts: [],
    speaking_challenge_hint_reveals: []
});

const goodAttempt = (overrides = {}) => ({
    id: 1, student_id: 7, question_set_id: 42, question_id: 4201, challenge_mode: "challenge",
    client_session_id: SESSION, created_at: minutesAgo(1), answer_match: true,
    pronunciation_score: 80, completeness_score: 80, hint_used: false, ...overrides
});

const harness = ({ uid = "uid-student", mutate, access = { is_active: true, features: { pronunciation: true } }, completionError = null } = {}) => {
    const tables = baseTables();
    mutate?.(tables);
    const admin = createFakeAdmin({
        tables,
        rpc: {
            get_student_effective_access: ({ p_student_id }) => ({ data: { student_id: p_student_id, role: "student", plan_codes: [], grants: [], ...access }, error: null }),
            complete_speaking_session_question_v2: args => completionError
                ? { data: null, error: { message: completionError } }
                : { data: { completed: true, question_id: args.p_question_id }, error: null }
        }
    });
    const auth = loadSharedInSandbox("_shared/firebase-auth.ts", {
        createRemoteJWKSet: () => ({}), jwtVerify: async () => ({ payload: { sub: uid } })
    }, ["cleanText", "verifyFirebaseRequest"]);
    const call = loadHandler("speaking-challenge", {
        ...shared, ...auth,
        createClient: () => admin,
        createR2PresignedUrl: async key => `https://r2.invalid/${key}`
    });
    return { admin, tables, call: body => callJson(call(body)) };
};

const complete = (run, extra = {}) => run.call({
    action: "complete_question", mode: "challenge", question_set_id: 42, question_id: 4201, challenge_session_id: SESSION, ...extra
});
const completionCalls = run => run.admin.rpcCalls("complete_speaking_session_question_v2");

// ---------------------------------------------------------------------------
// Unlock gate
// ---------------------------------------------------------------------------

test("a set whose previous set is not finished is 403 speaking_challenge_locked for question_set and complete_question", async () => {
    const run = harness({ mutate: tables => { tables.speaking_challenge_mode_progress = []; tables.speaking_pronunciation_attempts.push(goodAttempt()); } });
    for (const action of ["question_set", "complete_question", "reveal_hint"]) {
        const { status, body } = await run.call({ action, mode: "challenge", question_set_id: 42, question_id: 4201, challenge_session_id: SESSION });
        assert.equal(status, 403, action);
        assert.equal(body.code, "speaking_challenge_locked", action);
    }
    assert.equal(completionCalls(run).length, 0);
    assert.equal(run.admin.writes("speaking_challenge_hint_reveals").length, 0);
});

test("finishing a later set does not unlock an earlier gap; the first set is always open", async () => {
    const run = harness({ mutate: tables => { tables.speaking_challenge_mode_progress = [{ student_id: 7, question_id: 4201 }]; } });
    assert.equal((await run.call({ action: "complete_question", mode: "challenge", question_set_id: 43, question_id: 4301, challenge_session_id: SESSION })).body.code, "speaking_challenge_locked");
    const first = harness({ mutate: tables => {
        tables.speaking_challenge_mode_progress = [];
        tables.speaking_pronunciation_attempts.push(goodAttempt({ question_set_id: 41, question_id: 4101 }));
    } });
    assert.equal((await complete(first, { question_set_id: 41, question_id: 4101 })).status, 200);
});

test("another student's progress does not unlock the set", async () => {
    const run = harness({ mutate: tables => { tables.speaking_challenge_mode_progress = [{ student_id: 8, question_id: 4101 }]; } });
    assert.equal((await complete(run)).body.code, "speaking_challenge_locked");
});

test("teacher preview is demo mode: not gated by unlock, but cannot write completion", async () => {
    const run = harness({ uid: "uid-teacher", mutate: tables => { tables.speaking_challenge_mode_progress = []; } });
    const { status, body } = await complete(run);
    assert.equal(status, 403);
    assert.equal(body.code, "demo_read_only");
    assert.equal(completionCalls(run).length, 0);
});

test("archived student is refused by the shared Firebase check", async () => {
    const run = harness({ uid: "uid-archived" });
    assert.equal((await complete(run)).status, 403);
    assert.equal(run.admin.log.filter(entry => entry.rpc).length, 0);
});

test("a student without pronunciation access is refused even with a book entitlement", async () => {
    const run = harness({ access: { is_active: false, features: { pronunciation: true } } });
    const { status, body } = await complete(run);
    assert.equal(status, 403);
    assert.equal(body.code, "pronunciation_access_required");
});

// ---------------------------------------------------------------------------
// complete_question server-side evidence
// ---------------------------------------------------------------------------

test("a correct, recent, hint-free attempt in the same session completes the question", async () => {
    const run = harness({ mutate: tables => tables.speaking_pronunciation_attempts.push(goodAttempt()) });
    const { status, body } = await complete(run, { score: 0, completed: false, student_id: 8 });
    assert.equal(status, 200);
    assert.equal(body.success, true);
    const [call] = completionCalls(run);
    assert.deepEqual({ ...call.args }, { p_student_id: 7, p_question_set_id: 42, p_question_id: 4201, p_client_session_id: SESSION, p_challenge_mode: "challenge" });
});

test("score exactly 60 passes; completeness_score is used when pronunciation_score is null", async () => {
    for (const attempt of [goodAttempt({ pronunciation_score: 60 }), goodAttempt({ pronunciation_score: null, completeness_score: 75 })]) {
        const run = harness({ mutate: tables => tables.speaking_pronunciation_attempts.push(attempt) });
        assert.equal((await complete(run)).status, 200);
    }
});

const refusals = [
    ["no saved attempt", null, 409, "correct_assessment_required"],
    ["answer_match false", goodAttempt({ answer_match: false }), 409, "correct_assessment_required"],
    ["answer_match missing", goodAttempt({ answer_match: null }), 409, "correct_assessment_required"],
    ["score 59", goodAttempt({ pronunciation_score: 59 }), 409, "correct_assessment_required"],
    ["both scores null", goodAttempt({ pronunciation_score: null, completeness_score: null }), 409, "correct_assessment_required"],
    ["attempt from another session", goodAttempt({ client_session_id: OTHER_SESSION }), 409, "correct_assessment_required"],
    ["attempt older than 10 minutes", goodAttempt({ created_at: minutesAgo(11) }), 409, "correct_assessment_required"],
    ["attempt saved in easy mode", goodAttempt({ challenge_mode: "easy" }), 409, "correct_assessment_required"],
    ["another student's attempt", goodAttempt({ student_id: 8 }), 409, "correct_assessment_required"],
    ["attempt for another question", goodAttempt({ question_id: 4101 }), 409, "correct_assessment_required"],
    ["hint_used on the attempt", goodAttempt({ hint_used: true }), 409, "challenge_hint_used"]
];

for (const [label, attempt, status, code] of refusals) {
    test(`complete_question refuses: ${label}`, async () => {
        const run = harness({ mutate: tables => { if (attempt) tables.speaking_pronunciation_attempts.push(attempt); } });
        const response = await complete(run, { pronunciation_score: 100, answer_match: true, hint_used: false });
        assert.equal(response.status, status);
        assert.equal(response.body.code, code);
        assert.equal(completionCalls(run).length, 0);
    });
}

test("a hint revealed in this session blocks completion even if the attempt says no hint", async () => {
    const run = harness({ mutate: tables => {
        tables.speaking_pronunciation_attempts.push(goodAttempt());
        tables.speaking_challenge_hint_reveals.push({ student_id: 7, question_set_id: 42, question_id: 4201, client_session_id: SESSION });
    } });
    assert.equal((await complete(run)).body.code, "challenge_hint_used");
    assert.equal(completionCalls(run).length, 0);
});

test("a hint revealed in a different session does not block this session", async () => {
    const run = harness({ mutate: tables => {
        tables.speaking_pronunciation_attempts.push(goodAttempt());
        tables.speaking_challenge_hint_reveals.push({ student_id: 7, question_set_id: 42, question_id: 4201, client_session_id: OTHER_SESSION });
    } });
    assert.equal((await complete(run)).status, 200);
});

test("the latest attempt decides: a newer failed attempt overrides an older passing one", async () => {
    const run = harness({ mutate: tables => tables.speaking_pronunciation_attempts.push(
        goodAttempt({ id: 1, created_at: minutesAgo(5) }),
        goodAttempt({ id: 2, created_at: minutesAgo(1), answer_match: false })
    ) });
    assert.equal((await complete(run)).body.code, "correct_assessment_required");
});

test("malformed session ID is 400 and a question outside the set is 403", async () => {
    const run = harness({ mutate: tables => tables.speaking_pronunciation_attempts.push(goodAttempt()) });
    assert.equal((await complete(run, { challenge_session_id: "not-a-uuid" })).status, 400);
    assert.equal((await complete(run, { question_id: 4101 })).status, 403);
    assert.equal(completionCalls(run).length, 0);
});

test("DAILY_LEVEL_COMPLETED from the completion RPC maps to 409 speaking_level_completed_today", async () => {
    const run = harness({ completionError: "DAILY_LEVEL_COMPLETED", mutate: tables => tables.speaking_pronunciation_attempts.push(goodAttempt()) });
    const { status, body } = await complete(run);
    assert.equal(status, 409);
    assert.equal(body.code, "speaking_level_completed_today");
});
