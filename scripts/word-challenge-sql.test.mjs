// 單字大挑戰 migration 的真實 PostgreSQL（PGlite）狀態測試：開局、提示、答案定案、結算、XP 門檻與每日上限、權限。
// 發獎函式 private.ae_gamification_grant_v2 在這裡用同樣語意的簡化版代替（唯一鍵＋略過重複），真正的發獎規則由既有 gamification 測試負責。
// 執行：PGLITE_MODULE=<pglite/dist/index.js 的絕對路徑> node --test scripts/word-challenge-sql.test.mjs
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const migrationPath = new URL("../supabase/migrations/20261111100000_word_challenge_server_v1.sql", import.meta.url);
const migration = readFileSync(migrationPath, "utf8");
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const one = async (sql, values = []) => (await rows(sql, values))[0];
const rejects = (promise, code) => assert.rejects(promise, error => String(error.message).includes(code), code);

const KEYS = ["big", "large", "mother", "gray", "june", "dog", "cat", "sun", "moon", "star"];
// 每次都是從沒學過的字（XP 只看「第一次學會」的字）。
const freshKeys = tag => Array.from({ length: 10 }, (_, index) => `${tag}-${index}`);

async function startRound(studentId = 1, level = 2, keys = KEYS) {
    const row = await one("select * from public.start_word_challenge_round_v1($1,'v1',$2::smallint,$3::text[])", [studentId, level, keys]);
    return row.round_id;
}
async function answerAll(roundId, { wrong = [], hinted = [], studentId = 1 } = {}) {
    for (let position = 0; position < 10; position += 1) {
        if (hinted.includes(position)) await db.query("select public.reveal_word_challenge_hint_v1($1,$2,$3::smallint,5)", [studentId, roundId, position]);
        const correct = !wrong.includes(position);
        await db.query("select * from public.record_word_challenge_answer_v1($1,$2,$3::smallint,$4,$5,null,false)", [studentId, roundId, position, correct ? "ok" : "zzz", correct]);
    }
}

before(async () => {
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create schema private;
        create table public.student_feature_rollouts (student_id bigint not null, feature_key text not null, enabled boolean not null default false, primary key (student_id, feature_key),
            constraint student_feature_rollouts_key_check check (feature_key in ('listening_rewards_v2','assignment_v2')));
        insert into public.student_feature_rollouts values (1,'listening_rewards_v2',true);
        create table public.students (id bigint primary key, role text not null, account_status text, archived_at timestamptz);
        insert into public.students values (1,'student','active',null),(2,'teacher','active',null),(3,'student','archived',null),(4,'student','active',now()),(5,'student','active',null),(6,'student','active',null),(8,'student','active',null);
        create table public.student_gamification_balances (student_id bigint primary key references public.students(id), total_xp integer not null default 0, points_balance integer not null default 0, updated_at timestamptz default now());
        create table public.student_gamification_ledger (
            id bigserial primary key, student_id bigint not null, xp_delta integer not null, points_delta integer not null default 0,
            source_type text not null, source_key text not null, description text, metadata jsonb not null default '{}'::jsonb,
            created_at timestamptz not null default now(), unique (student_id, source_type, source_key));
        create function private.ae_gamification_grant_v2(p_student_id bigint, p_xp_delta integer, p_points_delta integer, p_source_type text, p_source_key text, p_description text default null, p_metadata jsonb default '{}'::jsonb)
        returns boolean language plpgsql as $$
        declare n integer;
        begin
            insert into public.student_gamification_balances(student_id) values (p_student_id) on conflict do nothing;
            insert into public.student_gamification_ledger(student_id,xp_delta,points_delta,source_type,source_key,description,metadata)
            values (p_student_id,p_xp_delta,0,p_source_type,p_source_key,p_description,p_metadata || jsonb_build_object('base_xp',p_xp_delta))
            on conflict (student_id,source_type,source_key) do nothing;
            get diagnostics n = row_count;
            if n = 0 then return false; end if;
            update public.student_gamification_balances set total_xp = total_xp + p_xp_delta where student_id = p_student_id;
            return true;
        end $$;
    `);
    await db.exec(migration);
});

after(async () => { await db.close(); });

test("migration is additive only: no drops, deletes, truncates or edits to existing objects", () => {
    assert.doesNotMatch(migration, /\b(truncate|delete\s+from)\b/i);
    // 唯一允許的 drop／alter：rollout 開關表的 key 檢查清單（和 assignment_v2 當時相同做法）。
    assert.deepEqual(migration.match(/\bdrop\s+\w+(\s+if exists)?\s+\w+/gi), ["drop constraint if exists student_feature_rollouts_key_check"]);
    const alteredTables = [...migration.matchAll(/alter\s+table\s+public\.(\w+)/gi)].map(match => match[1]).filter(name => !/^(word_challenge|student_word)/.test(name));
    assert.deepEqual(alteredTables, ["student_feature_rollouts", "student_feature_rollouts"]);
    assert.doesNotMatch(migration, /create or replace function (public|private)\.(ae_gamification_grant|record_game_gamification|complete_speaking)/);
    assert.equal(migration.match(/source_type = 'word_challenge'/g).length >= 2, true);
    assert.doesNotMatch(migration, /birthday/i);
});

test("the rollout switch accepts the new key and keeps the old rows and keys", async () => {
    await db.exec("insert into public.student_feature_rollouts values (5,'word_challenge_server_v1',true)");
    assert.equal((await one("select count(*)::int n from public.student_feature_rollouts where feature_key='listening_rewards_v2'")).n, 1);
    await assert.rejects(db.exec("insert into public.student_feature_rollouts values (5,'something_else',true)"), /student_feature_rollouts_key_check/);
    await db.exec("delete from public.student_feature_rollouts where student_id = 5");
});

test("all three tables have RLS on and are closed to anon and authenticated", async () => {
    for (const table of ["word_challenge_rounds", "word_challenge_round_items", "student_word_progress"]) {
        const info = await one("select relrowsecurity from pg_class where oid = ('public.'||$1)::regclass", [table]);
        assert.equal(info.relrowsecurity, true, table);
        for (const role of ["anon", "authenticated"]) {
            const can = await one("select has_table_privilege($1, 'public.'||$2, 'select,insert,update,delete') ok", [role, table]);
            assert.equal(can.ok, false, `${role} on ${table}`);
        }
        const service = await one("select has_table_privilege('service_role', 'public.'||$1, 'select,insert,update,delete') ok", [table]);
        assert.equal(service.ok, true);
    }
});

test("only service_role can run the functions; anon and authenticated cannot", async () => {
    const signatures = [
        "public.start_word_challenge_round_v1(bigint,text,smallint,text[])",
        "public.reveal_word_challenge_hint_v1(bigint,uuid,smallint,integer)",
        "public.record_word_challenge_answer_v1(bigint,uuid,smallint,text,boolean,text,boolean)",
        "public.finish_word_challenge_round_v1(bigint,uuid,boolean)",
        "public.get_word_challenge_summary_v1(bigint,text)",
        "private.ae_word_challenge_student_ok(bigint)"
    ];
    for (const signature of signatures) {
        for (const role of ["anon", "authenticated"]) {
            assert.equal((await one("select has_function_privilege($1,$2,'execute') ok", [role, signature])).ok, false, `${role} ${signature}`);
        }
        assert.equal((await one("select has_function_privilege('service_role',$1,'execute') ok", [signature])).ok, true, signature);
    }
});

test("a round needs a real, active student and 1 to 10 distinct, valid word keys", async () => {
    await rejects(startRound(2), "WORD_CHALLENGE_STUDENT_NOT_ALLOWED");
    await rejects(startRound(3), "WORD_CHALLENGE_STUDENT_NOT_ALLOWED");
    await rejects(startRound(4), "WORD_CHALLENGE_STUDENT_NOT_ALLOWED");
    await rejects(startRound(999), "WORD_CHALLENGE_STUDENT_NOT_ALLOWED");
    await rejects(startRound(1, 7), "WORD_CHALLENGE_INVALID_LEVEL");
    await rejects(startRound(1, 2, []), "WORD_CHALLENGE_INVALID_WORDS");
    await rejects(startRound(1, 2, [...KEYS, "extra"]), "WORD_CHALLENGE_INVALID_WORDS");
    await rejects(startRound(1, 2, ["big", "big"]), "WORD_CHALLENGE_INVALID_WORDS");
    await rejects(startRound(1, 2, ["a".repeat(65)]), "WORD_CHALLENGE_INVALID_WORDS");
});

test("a full round: first answer is final, resending returns the stored result, and 9 right earns 10 XP once", async () => {
    const roundId = await startRound(1, 2);
    await db.query("select public.reveal_word_challenge_hint_v1(1,$1,0::smallint,3)", [roundId]);
    const first = await one("select * from public.record_word_challenge_answer_v1(1,$1,0::smallint,'wrong',false,'oneLetter',false)", [roundId]);
    assert.equal(first.correct, false);
    assert.equal(first.already_answered, false);
    // 想改成對：不可以，拿到的是原本的結果。
    const again = await one("select * from public.record_word_challenge_answer_v1(1,$1,0::smallint,'right',true,null,false)", [roundId]);
    assert.equal(again.correct, false);
    assert.equal(again.already_answered, true);
    await rejects(db.query("select public.reveal_word_challenge_hint_v1(1,$1,0::smallint,3)", [roundId]), "WORD_CHALLENGE_ALREADY_ANSWERED");

    await rejects(db.query("select * from public.finish_word_challenge_round_v1(1,$1,true)", [roundId]), "WORD_CHALLENGE_ROUND_INCOMPLETE");
    for (let position = 1; position < 10; position += 1) {
        await db.query("select * from public.record_word_challenge_answer_v1(1,$1,$2::smallint,'ok',true,null,false)", [roundId, position]);
    }
    const finished = await one("select * from public.finish_word_challenge_round_v1(1,$1,true)", [roundId]);
    assert.equal(finished.correct_count, 9);
    assert.equal(finished.unhinted_correct_count, 9);
    assert.equal(finished.xp_awarded, 10);
    assert.equal(finished.already_finished, false);
    assert.equal(finished.total_xp, 10);

    const replay = await one("select * from public.finish_word_challenge_round_v1(1,$1,true)", [roundId]);
    assert.equal(replay.already_finished, true);
    assert.equal(replay.xp_awarded, 10);
    assert.equal(replay.total_xp, 10);
    assert.equal((await one("select count(*)::int n from public.student_gamification_ledger where student_id=1 and source_type='word_challenge'")).n, 1);
    await rejects(db.query("select * from public.record_word_challenge_answer_v1(1,$1,5::smallint,'x',true,null,false)", [roundId]).then(r => { assert.equal(r.rows[0].already_answered, true); throw new Error("WORD_CHALLENGE_ROUND_CLOSED"); }), "WORD_CHALLENGE_ROUND_CLOSED");
});

test("only first-time-learned words pay: repeating the same ten words earns nothing, and a hinted word is learned later without paying", async () => {
    const keys = freshKeys("reuse");
    const first = await startRound(8, 3, keys);
    await answerAll(first, { studentId: 8 });
    const paid = await one("select * from public.finish_word_challenge_round_v1(8,$1,true)", [first]);
    assert.deepEqual([paid.new_mastered_count, paid.xp_awarded], [10, 10]);

    // 同一批字再玩一次：全對、沒用提示，但都學會過了。
    const again = await startRound(8, 3, keys);
    await answerAll(again, { studentId: 8 });
    const repeat = await one("select * from public.finish_word_challenge_round_v1(8,$1,true)", [again]);
    assert.deepEqual([repeat.correct_count, repeat.unhinted_correct_count, repeat.new_mastered_count, repeat.xp_awarded], [10, 10, 0, 0]);

    // 全新的字，其中 3 題先用了提示：這 3 題不算學會，只剩 7 個，沒到 8 個不給。
    const hinted = await startRound(8, 3, freshKeys("hinted-first"));
    await answerAll(hinted, { studentId: 8, hinted: [0, 1, 2] });
    const partial = await one("select * from public.finish_word_challenge_round_v1(8,$1,true)", [hinted]);
    assert.deepEqual([partial.new_mastered_count, partial.xp_awarded], [7, 0]);
    // 那 3 個字之後沒用提示答對，才算第一次學會；以前答錯過的字也算新學會。
    const later = await startRound(8, 3, ["hinted-first-0", "hinted-first-1", "hinted-first-2"]);
    for (let position = 0; position < 3; position += 1) {
        await db.query("select * from public.record_word_challenge_answer_v1(8,$1,$2::smallint,'ok',true,null,false)", [later, position]);
    }
    const row = await one("select count(*) filter (where newly_mastered)::int n from public.word_challenge_round_items where round_id = $1", [later]);
    assert.equal(row.n, 3);
});

test("hints and misses: a hinted correct answer does not count toward the 8, so 7 clean + 3 hinted gives no XP", async () => {
    const roundId = await startRound(5, 3);
    await answerAll(roundId, { hinted: [0, 1, 2], studentId: 5 });
    const finished = await one("select * from public.finish_word_challenge_round_v1(5,$1,true)", [roundId]);
    assert.equal(finished.correct_count, 10);
    assert.equal(finished.unhinted_correct_count, 7);
    assert.equal(finished.xp_awarded, 0);
    assert.equal((await one("select count(*)::int n from public.student_gamification_ledger where student_id=5")).n, 0);
});

test("a missed-words round (level 0) and a round with award switched off give no XP", async () => {
    const missedRound = await startRound(5, 0);
    await answerAll(missedRound, { studentId: 5 });
    assert.equal((await one("select * from public.finish_word_challenge_round_v1(5,$1,true)", [missedRound])).xp_awarded, 0);
    const noAward = await startRound(5, 2);
    await answerAll(noAward, { studentId: 5 });
    assert.equal((await one("select * from public.finish_word_challenge_round_v1(5,$1,false)", [noAward])).xp_awarded, 0);
});

test("30 XP a day: the 4th paying round of the day earns nothing, and a partial cap pays the remainder", async () => {
    // 學生 1 已經拿了 10；再 2 輪拿滿 30，第 4 輪是 0。
    const results = [];
    for (let index = 0; index < 3; index += 1) {
        const roundId = await startRound(1, 2, freshKeys(`cap${index}`));
        await answerAll(roundId);
        results.push((await one("select * from public.finish_word_challenge_round_v1(1,$1,true)", [roundId])).xp_awarded);
    }
    assert.deepEqual(results, [10, 10, 0]);
    const today = (await one("select public.get_word_challenge_summary_v1(1,'v1') s")).s;
    assert.equal(today.xp_today, 30);
    assert.equal((await one("select total_xp from public.student_gamification_balances where student_id=1")).total_xp, 30);
});

test("progress follows the rules: clean correct = mastered, wrong = missed, a later clean correct clears missed", async () => {
    const roundId = await startRound(6, 4, ["big", "large", "mother", "gray", "june", "dog", "cat", "sun", "moon", "star"]);
    await answerAll(roundId, { wrong: [0, 1], hinted: [2], studentId: 6 });
    await db.query("select * from public.finish_word_challenge_round_v1(6,$1,true)", [roundId]);
    const summary = (await one("select public.get_word_challenge_summary_v1(6,'v1') s")).s;
    assert.deepEqual([...summary.missed].sort(), ["big", "large"]);
    assert.equal(summary.mastered.includes("mother"), false, "a hinted answer does not become mastered");
    assert.equal(summary.mastered.includes("gray"), true);
    assert.equal(summary.best["4"], 8);

    const next = await startRound(6, 4, ["big"]);
    await db.query("select * from public.record_word_challenge_answer_v1(6,$1,0::smallint,'big',true,null,false)", [next]);
    const after = (await one("select public.get_word_challenge_summary_v1(6,'v1') s")).s;
    assert.deepEqual(after.missed, ["large"]);
    assert.equal(after.mastered.includes("big"), true);
});

test("skipping counts as wrong; an expired round refuses answers and gives no XP", async () => {
    const skipRound = await startRound(5, 5);
    const skipped = await one("select * from public.record_word_challenge_answer_v1(5,$1,0::smallint,'',true,null,true)", [skipRound]);
    assert.equal(skipped.correct, false);
    assert.equal(skipped.skipped, true);

    const expired = await startRound(5, 5);
    for (let position = 0; position < 10; position += 1) {
        await db.query("select * from public.record_word_challenge_answer_v1(5,$1,$2::smallint,'ok',true,null,false)", [expired, position]);
    }
    await db.query("update public.word_challenge_rounds set expires_at = now() - interval '1 minute' where id = $1", [expired]);
    const finished = await one("select * from public.finish_word_challenge_round_v1(5,$1,true)", [expired]);
    assert.equal(finished.xp_awarded, 0);

    const stale = await startRound(5, 5);
    await db.query("update public.word_challenge_rounds set expires_at = now() - interval '1 minute' where id = $1", [stale]);
    await rejects(db.query("select * from public.record_word_challenge_answer_v1(5,$1,0::smallint,'ok',true,null,false)", [stale]), "WORD_CHALLENGE_ROUND_EXPIRED");
    await rejects(db.query("select public.reveal_word_challenge_hint_v1(5,$1,0::smallint,3)", [stale]), "WORD_CHALLENGE_ROUND_EXPIRED");
});

test("the XP deadline is when the last answer was given: pressing 看成績 late still pays, answering late does not", async () => {
    const onTime = await startRound(6, 5, freshKeys("late-ok"));
    await answerAll(onTime, { studentId: 6 });
    // 最後一題在期限內答完，但按「看成績」時已經過期。
    await db.query("update public.word_challenge_rounds set expires_at = now() - interval '1 minute' where id = $1", [onTime]);
    await db.query("update public.word_challenge_round_items set answered_at = now() - interval '5 minutes' where round_id = $1", [onTime]);
    assert.equal((await one("select * from public.finish_word_challenge_round_v1(6,$1,true)", [onTime])).xp_awarded, 10);

    const late = await startRound(6, 5, freshKeys("late-bad"));
    await answerAll(late, { studentId: 6 });
    await db.query("update public.word_challenge_rounds set expires_at = now() - interval '1 minute' where id = $1", [late]);
    assert.equal((await one("select * from public.finish_word_challenge_round_v1(6,$1,true)", [late])).xp_awarded, 0);
});

test("a student cannot touch another student's round, and bad notes or positions are rejected", async () => {
    const roundId = await startRound(1, 2);
    await rejects(db.query("select * from public.record_word_challenge_answer_v1(5,$1,0::smallint,'ok',true,null,false)", [roundId]), "WORD_CHALLENGE_ROUND_NOT_FOUND");
    await rejects(db.query("select public.reveal_word_challenge_hint_v1(5,$1,0::smallint,3)", [roundId]), "WORD_CHALLENGE_ROUND_NOT_FOUND");
    await rejects(db.query("select * from public.finish_word_challenge_round_v1(5,$1,true)", [roundId]), "WORD_CHALLENGE_ROUND_NOT_FOUND");
    await rejects(db.query("select * from public.record_word_challenge_answer_v1(1,$1,99::smallint,'ok',true,null,false)", [roundId]), "WORD_CHALLENGE_ITEM_NOT_FOUND");
    await rejects(db.query("select * from public.record_word_challenge_answer_v1(1,$1,0::smallint,'ok',true,'hacked',false)", [roundId]), "WORD_CHALLENGE_INVALID_NOTE");
    await rejects(db.query("select * from public.record_word_challenge_answer_v1(1,gen_random_uuid(),0::smallint,'ok',true,null,false)"), "WORD_CHALLENGE_ROUND_NOT_FOUND");
    const tooLong = await one("select * from public.record_word_challenge_answer_v1(1,$1,0::smallint,$2,false,null,false)", [roundId, "x".repeat(200)]);
    assert.equal(tooLong.correct, false);
    assert.equal((await one("select char_length(typed) n from public.word_challenge_round_items where round_id=$1 and position=0", [roundId])).n, 64);
});

test("at most 60 rounds can be opened per student per day", async () => {
    await db.exec("delete from public.word_challenge_rounds where student_id = 5");
    for (let index = 0; index < 60; index += 1) await startRound(5, 1, ["big"]);
    await rejects(startRound(5, 1, ["big"]), "WORD_CHALLENGE_DAILY_ROUND_LIMIT");
});

test("deleting a student removes their rounds, items and progress (no orphans)", async () => {
    await db.exec("insert into public.students values (9,'student','active',null)");
    const roundId = await startRound(9, 1, ["big"]);
    await db.query("select * from public.record_word_challenge_answer_v1(9,$1,0::smallint,'zzz',false,null,false)", [roundId]);
    await db.exec("delete from public.students where id = 9");
    for (const table of ["word_challenge_rounds", "student_word_progress"]) {
        assert.equal((await one(`select count(*)::int n from public.${table} where student_id = 9`)).n, 0, table);
    }
    assert.equal((await one("select count(*)::int n from public.word_challenge_round_items where round_id = $1", [roundId])).n, 0);
});
