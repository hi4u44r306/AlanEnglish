// Runs the actual migrations in isolated PostgreSQL/WASM, never production.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const reserve = async (id = 1, seconds = 6, type = "text_qa", session = null) => (await db.query(
    "select public.reserve_speaking_pronunciation_request_v2($1,10,100,$2,$3,$4::uuid) result", [id, type, seconds, session]
)).rows[0].result;
const usage = async (id = 1) => (await db.query("select public.speaking_assessment_usage_v1($1) result", [id])).rows[0].result;
const fill = async (id, seconds, time = "clock_timestamp()", status = "completed") => db.exec(`
    insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,audio_seconds,status,created_at)
    select ${id},10,100,least(12, ${seconds} - (i-1)*12),'${status}',${time}
    from generate_series(1,ceil(${seconds}/12.0)::integer) i;
`);
before(async () => {
    await db.exec(`
        -- Test-only clock freeze: enough elapsed days to exercise monthly and
        -- rolling daily limits independently, even when run on the first day.
        create or replace function pg_catalog.clock_timestamp() returns timestamptz
        language sql as $$ select '2026-10-15T04:00:00Z'::timestamptz $$;
        create role anon; create role authenticated; create role service_role bypassrls;
        create table public.students(id bigint primary key, role text not null);
        create table public.speaking_question_sets(id bigint primary key, status text not null);
        create table public.speaking_questions(id bigint primary key, question_set_id bigint references public.speaking_question_sets(id));
        insert into public.students values(1,'student'),(2,'student'),(3,'admin'),(4,'teacher');
        insert into public.speaking_question_sets values(10,'published'),(11,'draft');
        insert into public.speaking_questions values(100,10),(101,11);
        grant select on public.students,public.speaking_questions,public.speaking_question_sets to service_role;
    `);
    for (const file of ["20260913013037_speaking_pronunciation_request_ledger.sql", "20260918063338_speaking_challenge_daily_sessions.sql", "20261002150738_speaking_monthly_audio_budget.sql"]) {
        await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
});
beforeEach(async () => { await db.exec("reset role; truncate public.speaking_pronunciation_requests,public.speaking_challenge_sessions;"); });
after(() => db.close());

test("uses validated duration, separates students, and resets at Taiwan month boundary", async () => {
    await fill(1, 12, "date_trunc('month', clock_timestamp() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei' - interval '1 second'");
    const result = await reserve(1, 7);
    assert.equal(result.allowed, true);
    assert.equal(result.assessment_usage.monthly_used_seconds, 7);
    assert.equal(result.assessment_usage.monthly_remaining_seconds, 5393);
    assert.equal((await usage(2)).monthly_used_seconds, 0);
    const reset = (await db.query("select ((date_trunc('month', clock_timestamp() at time zone 'Asia/Taipei') + interval '1 month') at time zone 'Asia/Taipei') reset")).rows[0].reset;
    assert.equal(new Date(result.assessment_usage.reset_at).getTime(), new Date(reset).getTime());
});
test("exact 90-minute limit allows last fitting recording then denies all question modes", async () => {
    await fill(1, 5394, "clock_timestamp() - interval '2 days'");
    assert.equal((await reserve(1, 6)).allowed, true);
    for (const type of [null, "", "alphabet_round", "letter_spelling", "text_qa", "standard_sentence"]) {
        const denied = await reserve(1, 1, type);
        assert.equal(denied.code, "speaking_monthly_quota_reached");
    }
    assert.equal((await usage()).monthly_used_seconds, 5400);
});
test("oversized final recording is rejected without consuming a daily session; shorter recording fits", async () => {
    await fill(1, 5398, "clock_timestamp() - interval '2 days'");
    const session = "10000000-0000-4000-8000-000000000001";
    assert.equal((await reserve(1, 3, "text_qa", session)).code, "speaking_monthly_quota_reached");
    assert.equal((await db.query("select count(*)::integer n from public.speaking_challenge_sessions")).rows[0].n, 0);
    assert.equal((await reserve(1, 2, "text_qa", session)).allowed, true);
});
test("global 4500-minute cap includes staff; per-student remaining does not bypass it", async () => {
    await fill(3, 269997, "clock_timestamp() - interval '2 days'");
    assert.equal((await reserve(2, 4)).code, "speaking_global_budget_reached");
    assert.equal((await reserve(3, 3)).allowed, true);
    assert.equal((await reserve(1, 1)).code, "speaking_global_budget_reached");
    assert.equal((await usage(1)).global_available, false);
    assert.equal((await usage(3)).monthly_limit_seconds, null);
});
test("failed and ambiguous provider requests remain budgeted; retries use additional seconds", async () => {
    for (const status of ["reserved", "provider_failed", "unassessable", "internal_failed"]) await fill(1, 6, "clock_timestamp()", status);
    assert.equal((await reserve(1, 6)).assessment_usage.monthly_used_seconds, 30);
});
test("legacy reservation wrapper reserves 12 seconds and cannot bypass monthly cap", async () => {
    const old = async () => (await db.query("select public.reserve_speaking_pronunciation_request(1,10,100,null) result")).rows[0].result;
    assert.equal((await old()).assessment_usage.monthly_used_seconds, 12);
    await fill(1, 5388, "clock_timestamp() - interval '2 days'");
    assert.equal((await old()).code, "speaking_monthly_quota_reached");
});
test("all legacy types now obey rolling 24-hour 160-request limit", async () => {
    await db.exec(`insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,audio_seconds,created_at)
        select 1,10,100,1,clock_timestamp()-interval '1 hour' from generate_series(1,160);`);
    assert.equal((await reserve(1, 1, null)).code, "rate_limited");
    assert.equal((await reserve(1, 1, "text_qa")).code, "rate_limited");
});
test("daily 5-round rejection is atomic and does not consume audio budget", async () => {
    for (let i = 1; i <= 5; i++) assert.equal((await reserve(1, 1, "text_qa", `10000000-0000-4000-8000-${String(i).padStart(12,"0")}`)).allowed, true);
    assert.equal((await reserve(1, 1, "text_qa", "10000000-0000-4000-8000-000000000006")).code, "speaking_daily_limit_reached");
    assert.equal((await usage()).monthly_used_seconds, 5);
    assert.equal((await reserve(1, 2, "text_qa", "10000000-0000-4000-8000-000000000001")).allowed, true);
    assert.equal((await usage()).monthly_used_seconds, 7);
});
test("invalid duration and unpublished questions cannot reserve quota", async () => {
    for (const seconds of [null, 0, -1, 13]) await assert.rejects(reserve(1, seconds), /Validated audio seconds/);
    await assert.rejects(db.query("select public.reserve_speaking_pronunciation_request_v2(1,11,101,null,3,null)"), /Published speaking question/);
    assert.equal((await usage()).monthly_used_seconds, 0);
});
test("anon and authenticated cannot read ledger or invoke quota functions; service role can", async () => {
    for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role};`);
        await assert.rejects(usage(), /permission denied/);
        await assert.rejects(reserve(), /permission denied/);
        await assert.rejects(db.query("select * from public.speaking_pronunciation_requests"), /permission denied/);
        await db.exec("reset role;");
    }
    await db.exec("set role service_role;");
    assert.equal((await reserve()).allowed, true);
    await db.exec("reset role;");
});
test("parallel queued reservations at the final second never exceed budget", async () => {
    await fill(1, 5399, "clock_timestamp()-interval '2 days'");
    const results = await Promise.all([reserve(1,1),reserve(1,1)]);
    assert.equal(results.filter(r => r.allowed).length, 1);
    assert.equal((await usage()).monthly_used_seconds, 5400);
    // PGlite serializes queries. Production advisory-lock contention still needs
    // a multi-connection PostgreSQL smoke test before production authorization.
});
