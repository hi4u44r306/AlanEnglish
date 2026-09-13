// Executes the real pronunciation request-ledger migration in an isolated,
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
    new URL("../supabase/migrations/20260913013037_speaking_pronunciation_request_ledger.sql", import.meta.url),
    "utf8"
);
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const reserve = async (studentId, interactionType = "") => (await scalar(`
    select public.reserve_speaking_pronunciation_request($1, 10, 100, $2) result
`, [studentId, interactionType])).result;

before(async () => {
    await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;

        create table public.students (
            id bigint primary key
        );
        create table public.speaking_question_sets (
            id bigint primary key,
            status text not null
        );
        create table public.speaking_questions (
            id bigint primary key,
            question_set_id bigint not null references public.speaking_question_sets(id)
        );

        insert into public.students(id) select generate_series(1, 6);
        insert into public.speaking_question_sets(id, status) values
            (10, 'published'),
            (11, 'draft');
        insert into public.speaking_questions(id, question_set_id) values
            (100, 10),
            (101, 11);
    `);
    await db.exec(migration);
});

after(() => db.close());

test("一般口說十分鐘最多保留 12 次 provider request", async () => {
    for (let index = 1; index <= 12; index += 1) {
        const result = await reserve(1);
        assert.equal(result.allowed, true);
        assert.equal(result.recent_count, index);
        assert.equal(result.daily_count, 0);
    }

    const denied = await reserve(1);
    assert.deepEqual(
        { allowed: denied.allowed, code: denied.code, recent: denied.recent_count },
        { allowed: false, code: "rate_limited", recent: 12 }
    );
    assert.equal((await scalar("select count(*)::int count from public.speaking_pronunciation_requests where student_id=1")).count, 12);
});

test("Workbook 1 基礎關十分鐘第 60 次可用，第 61 次拒絕", async () => {
    await db.exec(`
        insert into public.speaking_pronunciation_requests (
            student_id, question_set_id, question_id, interaction_type
        )
        select 2, 10, 100, 'alphabet_round'
        from generate_series(1, 59)
    `);

    const sixtieth = await reserve(2, "alphabet_round");
    assert.equal(sixtieth.allowed, true);
    assert.equal(sixtieth.recent_count, 60);
    assert.equal(sixtieth.daily_count, 60);

    const denied = await reserve(2, "alphabet_round");
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, "rate_limited");
    assert.equal(denied.recent_count, 60);
    assert.equal((await scalar("select count(*)::int count from public.speaking_pronunciation_requests where student_id=2")).count, 60);
});

test("Workbook 1 基礎關二十四小時第 160 次可用，第 161 次拒絕", async () => {
    await db.exec(`
        insert into public.speaking_pronunciation_requests (
            student_id, question_set_id, question_id, interaction_type, created_at
        )
        select 3, 10, 100, 'letter_spelling', now() - interval '20 minutes'
        from generate_series(1, 159)
    `);

    const oneHundredSixtieth = await reserve(3, "letter_spelling");
    assert.equal(oneHundredSixtieth.allowed, true);
    assert.equal(oneHundredSixtieth.recent_count, 1);
    assert.equal(oneHundredSixtieth.daily_count, 160);

    const denied = await reserve(3, "letter_spelling");
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, "rate_limited");
    assert.equal(denied.daily_count, 160);
    assert.equal((await scalar("select count(*)::int count from public.speaking_pronunciation_requests where student_id=3")).count, 160);
});

test("超過二十四小時的紀錄不占用新一輪付費額度", async () => {
    await db.exec(`
        insert into public.speaking_pronunciation_requests (
            student_id, question_set_id, question_id, interaction_type, created_at
        )
        select 4, 10, 100, 'picture_qa', now() - interval '25 hours'
        from generate_series(1, 200)
    `);

    const result = await reserve(4, "picture_qa");
    assert.equal(result.allowed, true);
    assert.equal(result.recent_count, 1);
    assert.equal(result.daily_count, 1);
});

test("未發布題組或題目與題組不符時 fail closed，且不建立 reservation", async () => {
    await assert.rejects(
        db.query("select public.reserve_speaking_pronunciation_request(5, 11, 101, 'picture_qa')"),
        /Published speaking question does not match its question set/
    );
    await assert.rejects(
        db.query("select public.reserve_speaking_pronunciation_request(5, 10, 101, 'picture_qa')"),
        /Published speaking question does not match its question set/
    );
    assert.equal((await scalar("select count(*)::int count from public.speaking_pronunciation_requests where student_id=5")).count, 0);
});
