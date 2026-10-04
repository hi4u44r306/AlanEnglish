// Isolated PostgreSQL only. No credentials, remote SQL or Azure calls.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const scalar = async (query, params = []) => (await db.query(query, params)).rows[0];
const reserve = async (student = 1, seconds = 25, type = "", session = null) =>
    (await scalar("select public.reserve_speaking_pronunciation_request_v2($1,10,100,$2,$3,$4) result", [student, type, seconds, session])).result;
before(async () => {
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create table public.students(id bigint primary key);
        create table public.speaking_question_sets(id bigint primary key, status text not null);
        create table public.speaking_questions(id bigint primary key, question_set_id bigint references public.speaking_question_sets(id));
        insert into public.students values (1),(2);
        insert into public.speaking_question_sets values (10,'published'),(11,'draft');
        insert into public.speaking_questions values (100,10),(101,11);
        grant select on public.students, public.speaking_question_sets, public.speaking_questions to service_role;
    `);
    for (const name of ["20260913013037_speaking_pronunciation_request_ledger.sql", "20260918063338_speaking_challenge_daily_sessions.sql", "20261003123607_speaking_audio_monthly_budget.sql", "20261004065744_speaking_audio_budget_120_minutes.sql"])
        await db.exec(readFileSync(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
    const policy = await scalar("select student_monthly_seconds,global_monthly_seconds from public.speaking_audio_budget_policy");
    assert.deepEqual(policy, { student_monthly_seconds: 7200, global_monthly_seconds: 360000 });
});
beforeEach(async () => {
    await db.exec("delete from public.speaking_pronunciation_requests; delete from public.speaking_challenge_sessions; update public.speaking_audio_budget_policy set student_monthly_seconds=7200,global_monthly_seconds=360000;");
});
after(() => db.close());

test("120 分鐘政策保留已用秒數；超過舊 60 分鐘仍可送評，120 分鐘整筆拒絕", async () => {
    await db.exec(`
        insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,audio_seconds,created_at)
        select 1,10,100,25,now() - interval '11 minutes' from generate_series(1,144);
    `);
    const allowed = await reserve(1, 25);
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.student_monthly_remaining_seconds, 3575);
    await db.exec(`
        insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,audio_seconds,created_at)
        select 1,10,100,25,now() - interval '11 minutes' from generate_series(1,142);
    `);
    assert.equal((await reserve(1, 25)).student_monthly_remaining_seconds, 0);
    assert.equal((await reserve(1, 1)).code, "student_audio_budget_exhausted");
    assert.equal((await scalar("select sum(audio_seconds)::int n from public.speaking_pronunciation_requests")).n, 7200);
});

test("100 小時全站政策於邊界拒絕且不新增送評", async () => {
    await db.exec(`
        insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,audio_seconds,created_at)
        select 2,10,100,25,now() - interval '11 minutes' from generate_series(1,14399);
    `);
    assert.equal((await reserve(1, 25)).allowed, true);
    assert.equal((await reserve(1, 1)).code, "global_audio_budget_exhausted");
    assert.equal((await scalar("select sum(audio_seconds)::int n from public.speaking_pronunciation_requests")).n, 360000);
});
test("沒有額度設定時拒絕，且不建立送評／每日回合紀錄", async () => {
    await db.exec("update public.speaking_audio_budget_policy set student_monthly_seconds=null;");
    assert.equal((await reserve()).code, "audio_budget_not_configured");
    assert.equal((await scalar("select count(*)::int n from public.speaking_pronunciation_requests")).n, 0);
});
test("短音檔只占用自己的秒數；月上限整筆檢查，重試也占用", async () => {
    await db.exec("update public.speaking_audio_budget_policy set student_monthly_seconds=30;");
    const first = await reserve(1, 5);
    assert.equal(first.student_monthly_remaining_seconds, 25);
    assert.equal((await reserve(1, 25)).allowed, true);
    assert.equal((await reserve(1, 1)).code, "student_audio_budget_exhausted");
    assert.equal((await scalar("select sum(audio_seconds)::int n from public.speaking_pronunciation_requests")).n, 30);
});
test("全站共用額度，包括不同學生及管理員無回合示範", async () => {
    await db.exec("update public.speaking_audio_budget_policy set global_monthly_seconds=25;");
    const results = await Promise.all([reserve(1, 25), reserve(2, 25)]);
    assert.equal(results.filter(r => r.allowed).length, 1);
    assert.equal(results.find(r => !r.allowed).code, "global_audio_budget_exhausted");
    assert.equal((await scalar("select sum(audio_seconds)::int n from public.speaking_pronunciation_requests")).n, 25);
});
test("供應商失敗仍保留秒數；不能反覆失敗繞過用量", async () => {
    await db.exec("update public.speaking_audio_budget_policy set student_monthly_seconds=25;");
    const first = await reserve();
    await db.query("update public.speaking_pronunciation_requests set status='provider_failed' where id=$1", [first.request_id]);
    assert.equal((await reserve(1, 1)).code, "student_audio_budget_exhausted");
});
test("歷史未知長度保守估計且不回填；上月不占本月額度", async () => {
    await db.exec(`
        update public.speaking_audio_budget_policy set student_monthly_seconds=50;
        insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,interaction_type)
            values (1,10,100,'letter_spelling'),(1,10,100,null);
        insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,audio_seconds,created_at)
            values(1,10,100,25,(date_trunc('month',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei') - interval '1 second');
    `);
    assert.equal((await reserve(1, 14)).code, "student_audio_budget_exhausted");
    const last = await reserve(1, 13);
    assert.equal(last.allowed, true);
    assert.equal(last.student_monthly_remaining_seconds, 0);
    assert.equal(new Date(last.resets_at).getUTCHours(), 16);
    assert.equal((await scalar("select count(*)::int n from public.speaking_pronunciation_requests where audio_seconds is null")).n, 2);
});
test("既有 10 分鐘送評上限保留；拒絕不建立新每日回合", async () => {
    for (let i = 0; i < 12; i++) assert.equal((await reserve(1, 1)).allowed, true);
    assert.equal((await reserve(1, 1, "", "11111111-1111-4111-8111-111111111111")).code, "rate_limited");
    assert.equal((await scalar("select count(*)::int n from public.speaking_challenge_sessions")).n, 0);
});
test("每日第六輪拒絕時一起回復音訊預留；同輪重試只計一輪", async () => {
    const session = "11111111-1111-4111-8111-000000000001";
    const first = await reserve(1, 1, "", session);
    const retry = await reserve(1, 1, "", session);
    assert.equal(first.challenge_usage.daily_used, 1);
    assert.equal(retry.challenge_usage.daily_used, 1);
    for (let i = 2; i <= 5; i++) await reserve(1, 1, "", "11111111-1111-4111-8111-" + String(i).padStart(12, "0"));
    assert.equal((await reserve(1, 25, "", "11111111-1111-4111-8111-000000000006")).code, "speaking_daily_limit_reached");
    assert.equal((await scalar("select sum(audio_seconds)::int n from public.speaking_pronunciation_requests")).n, 6);
    assert.equal((await scalar("select count(*)::int n from public.speaking_challenge_sessions")).n, 5);
});
test("非法長度／未發布題目拒絕且不占用任何額度", async () => {
    for (const seconds of [null, 0, 26]) await assert.rejects(reserve(1, seconds), /Invalid speaking audio duration/);
    await assert.rejects(reserve(1, 13, "alphabet_round"), /Invalid speaking audio duration/);
    await assert.rejects(scalar("select public.reserve_speaking_pronunciation_request_v2(1,11,101,'',1,null)"), /Published speaking question/);
    assert.equal((await scalar("select count(*)::int n from public.speaking_pronunciation_requests")).n, 0);
});
test("anon／authenticated 不可存取設定與執行用量 RPC；server role 可用", async () => {
    for (const role of ["anon", "authenticated"]) {
        await db.exec("set role " + role);
        try {
            await assert.rejects(reserve(), /permission denied/);
            await assert.rejects(db.exec("select * from public.speaking_audio_budget_policy"), /permission denied/);
        } finally { await db.exec("reset role"); }
    }
    await db.exec("set role service_role");
    try { assert.equal((await reserve(1, 25)).allowed, true); }
    finally { await db.exec("reset role"); }
});
