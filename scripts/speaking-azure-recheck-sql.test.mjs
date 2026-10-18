// Isolated PostgreSQL only (PGlite). No credentials, remote SQL or Azure calls.
// Runs the real ledger, daily-session, monthly-budget and alphabet migrations, then the new
// re-check / letter-cap migration, and checks every limit the owner approved on 2026-10-18.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const scalar = async (query, params = []) => (await db.query(query, params)).rows[0];
const session = n => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

const localAttempt = async ({ student = 1, question = 100, matched = false, minutesAgo = 0 } = {}) =>
    (await scalar(`insert into public.speaking_pronunciation_attempts(student_id,question_set_id,question_id,completeness_score,answer_match,challenge_mode,client_session_id,created_at)
        values($1,10,$2,67,$3,'easy',$4,now() - make_interval(mins => $5)) returning id`, [student, question, matched, session(1), minutesAgo])).id;
const recheck = async (attemptId, { student = 1, question = 100, seconds = 5, staff = false } = {}) =>
    (await scalar("select public.reserve_speaking_azure_recheck_request_v1($1,10,$2,'picture_gap_sentence',$3,$4,$5) result",
        [student, question, seconds, attemptId, staff])).result;
const setMode = mode => db.query("update public.speaking_azure_cost_policy set recheck_mode=$1", [mode]);

before(async () => {
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create table public.students(id bigint primary key);
        create table public.speaking_question_sets(id bigint primary key, status text not null, generation_metadata jsonb default '{}');
        create table public.speaking_questions(id bigint primary key, question_set_id bigint references public.speaking_question_sets(id), model_answer text);
        create table public.speaking_pronunciation_attempts(id bigint generated always as identity primary key, student_id bigint, question_set_id bigint,
            question_id bigint, pronunciation_score numeric, completeness_score numeric, answer_match boolean, challenge_mode text,
            client_session_id uuid, created_at timestamptz default now());
        insert into public.students values (1),(2);
        insert into public.speaking_question_sets values (10,'published','{}'),(20,'published','{"interaction_type":"alphabet_round"}'),(30,'published','{"interaction_type":"letter_spelling"}');
        insert into public.speaking_questions values (100,10,'It is her mouth.'),(101,10,'It is a cat.'),(200,20,'A'),(300,30,'CAT');
        grant select on public.students, public.speaking_question_sets, public.speaking_questions to service_role;
    `);
    for (const name of ["20260913013037_speaking_pronunciation_request_ledger.sql", "20260918063338_speaking_challenge_daily_sessions.sql",
        "20261003123607_speaking_audio_monthly_budget.sql", "20261004065744_speaking_audio_budget_120_minutes.sql"]) await db.exec(read(name));
    // Columns later migrations added to the ledger (provider, alphabet letter) before the alphabet RPC existed.
    await db.exec(`alter table public.speaking_pronunciation_requests add column if not exists provider text not null default 'azure';
        alter table public.speaking_pronunciation_requests add column if not exists alphabet_letter text;`);
    await db.exec(read("20261018090000_speaking_azure_recheck_and_letter_cap.sql"));
});
beforeEach(async () => {
    await db.exec(`delete from public.speaking_pronunciation_requests; delete from public.speaking_challenge_sessions;
        delete from public.speaking_pronunciation_attempts;
        update public.speaking_azure_cost_policy set recheck_mode='all', recheck_student_daily=5, recheck_per_question_daily=2,
            recheck_student_monthly_seconds=600, letters_student_monthly_seconds=2250;`);
});
after(() => db.close());

test("預設關閉；只開給管理員時學生不能用，管理員示範可不帶本機那筆", async () => {
    await setMode("off");
    assert.equal((await recheck(await localAttempt())).code, "recheck_disabled");
    await setMode("staff");
    assert.equal((await recheck(await localAttempt())).code, "recheck_disabled");
    assert.equal((await recheck(null, { staff: true })).allowed, true);
    await setMode("all");
    assert.equal((await recheck(null)).code, "recheck_not_allowed", "學生一定要指向剛剛那一筆");
});

test("同一筆本機評分只能再確認一次；記錄 provider 與來源", async () => {
    const attempt = await localAttempt();
    const first = await recheck(attempt);
    assert.equal(first.allowed, true);
    const row = await scalar("select provider, recheck_of_attempt_id, audio_seconds from public.speaking_pronunciation_requests where id=$1", [first.request_id]);
    assert.deepEqual(row, { provider: "azure_sentence_recheck", recheck_of_attempt_id: attempt, audio_seconds: 5 });
    assert.equal((await recheck(attempt)).code, "recheck_not_allowed");
});

test("別人的、已通過的、超過 3 分鐘或題目不符的本機評分都拒絕", async () => {
    assert.equal((await recheck(await localAttempt({ student: 2 }))).code, "recheck_not_allowed");
    assert.equal((await recheck(await localAttempt({ matched: true }))).code, "recheck_not_allowed");
    assert.equal((await recheck(await localAttempt({ minutesAgo: 4 }))).code, "recheck_not_allowed");
    assert.equal((await recheck(await localAttempt(), { question: 101 })).code, "recheck_not_allowed");
});

test("每天 5 次、同題每天 2 次", async () => {
    assert.equal((await recheck(await localAttempt())).allowed, true);
    assert.equal((await recheck(await localAttempt())).allowed, true);
    assert.equal((await recheck(await localAttempt())).code, "recheck_limit_reached", "同題第 3 次");
    for (let index = 0; index < 3; index += 1) assert.equal((await recheck(await localAttempt({ question: 101 }), { question: 101 })).allowed, index < 2);
    await db.exec("update public.speaking_azure_cost_policy set recheck_per_question_daily=10");
    assert.equal((await recheck(await localAttempt({ question: 101 }), { question: 101 })).allowed, true, "第 5 次");
    assert.equal((await recheck(await localAttempt({ question: 101 }), { question: 101 })).code, "recheck_limit_reached", "第 6 次");
});

test("每月 600 秒；不占每日 10 輪", async () => {
    await db.exec("update public.speaking_azure_cost_policy set recheck_student_daily=50, recheck_per_question_daily=10");
    await db.exec(`insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,provider,audio_seconds,created_at)
        select 1,10,100,'azure_sentence_recheck',20,now() - interval '2 days' from generate_series(1,29)`);
    assert.equal((await recheck(await localAttempt(), { seconds: 20 })).allowed, true, "580 + 20 = 600");
    assert.equal((await recheck(await localAttempt(), { seconds: 1 })).code, "recheck_limit_reached");
    assert.equal((await scalar("select count(*)::int n from public.speaking_challenge_sessions")).n, 0);
});

test("字母與拼字合計每月 2250 秒，用完回 letter_monthly_budget_exhausted", async () => {
    const alphabet = async seconds => (await scalar("select public.reserve_speaking_azure_alphabet_request_v1(1,20,200,$1,null) result", [seconds])).result;
    const spelling = async seconds => (await scalar("select public.reserve_speaking_azure_spelling_request_v1(1,30,300,$1,null) result", [seconds])).result;
    await db.exec(`insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,provider,audio_seconds,created_at)
        select 1,20,200,'azure_alphabet_basic',10,now() - interval '30 minutes' from generate_series(1,224)`);
    assert.equal((await alphabet(10)).allowed, true, "2240 + 10 = 2250");
    assert.equal((await alphabet(1)).code, "letter_monthly_budget_exhausted");
    assert.equal((await spelling(1)).code, "letter_monthly_budget_exhausted");
    assert.equal((await scalar("select public.speaking_letter_month_seconds_v1(2) s")).s, 0, "另一位學生不受影響");
});

test("權限：學生端角色不能直接呼叫", async () => {
    const granted = await scalar(`select has_function_privilege('authenticated','public.reserve_speaking_azure_recheck_request_v1(bigint,bigint,bigint,text,integer,bigint,boolean)','execute') a,
        has_function_privilege('service_role','public.reserve_speaking_azure_recheck_request_v1(bigint,bigint,bigint,text,integer,bigint,boolean)','execute') s,
        has_table_privilege('authenticated','public.speaking_azure_cost_policy','select') p`);
    assert.deepEqual(granted, { a: false, s: true, p: false });
});
