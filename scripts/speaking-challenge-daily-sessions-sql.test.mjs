// Executes the real daily speaking-challenge migration in isolated,
// in-memory PostgreSQL. It never reads credentials or connects to Supabase.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.PGLITE_MODULE
    ? pathToFileURL(process.env.PGLITE_MODULE).href
    : "@electric-sql/pglite");
const db = new PGlite();
const migration = readFileSync(
    new URL("../supabase/migrations/20260918063338_speaking_challenge_daily_sessions.sql", import.meta.url),
    "utf8"
);
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const reserve = async (studentId, clientSessionId, questionSetId = 10, questionId = 100) => (
    await scalar(`select public.reserve_speaking_challenge_session_v1($1, $2, $3, $4) result`, [
        studentId, questionSetId, questionId, clientSessionId
    ])
).result;

before(async () => {
    await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;

        create table public.students (id bigint primary key);
        create table public.speaking_question_sets (id bigint primary key, status text not null);
        create table public.speaking_questions (
            id bigint primary key,
            question_set_id bigint not null references public.speaking_question_sets(id)
        );

        insert into public.students(id) values (1), (2);
        insert into public.speaking_question_sets(id, status) values (10, 'published'), (11, 'published'), (12, 'draft');
        insert into public.speaking_questions(id, question_set_id) values (100, 10), (101, 11), (102, 12);
    `);
    await db.exec(migration);
});

after(() => db.close());

test("同一挑戰回合重錄與多題送出只計一次", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const first = await reserve(1, sessionId);
    const retry = await reserve(1, sessionId);

    assert.equal(first.allowed, true);
    assert.equal(first.already_reserved, false);
    assert.equal(first.daily_used, 1);
    assert.equal(retry.allowed, true);
    assert.equal(retry.already_reserved, true);
    assert.equal(retry.daily_used, 1);
    assert.equal((await scalar("select count(*)::int count from public.speaking_challenge_sessions where student_id=1")).count, 1);
});

test("同一學生每日前五輪可用，第六輪拒絕且不新增紀錄", async () => {
    for (let index = 2; index <= 5; index += 1) {
        const sessionId = `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`;
        const result = await reserve(1, sessionId);
        assert.equal(result.allowed, true);
        assert.equal(result.daily_used, index);
        assert.equal(result.daily_remaining, 5 - index);
    }

    const denied = await reserve(1, "11111111-1111-4111-8111-000000000006");
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, "speaking_daily_limit_reached");
    assert.equal(denied.daily_used, 5);
    assert.equal((await scalar("select count(*)::int count from public.speaking_challenge_sessions where student_id=1")).count, 5);
});

test("未發布題目、題組不符及跨題組重用回合皆 fail closed", async () => {
    await assert.rejects(
        reserve(2, "22222222-2222-4222-8222-222222222222", 12, 102),
        /Published speaking question does not match its question set/
    );
    await assert.rejects(
        reserve(2, "22222222-2222-4222-8222-222222222222", 10, 101),
        /Published speaking question does not match its question set/
    );
    await reserve(2, "22222222-2222-4222-8222-222222222222", 10, 100);
    await assert.rejects(
        reserve(2, "22222222-2222-4222-8222-222222222222", 11, 101),
        /Speaking challenge session does not match its question set/
    );
});
