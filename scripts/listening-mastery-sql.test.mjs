// Runs the real migration/functions in an isolated, in-memory PostgreSQL engine.
// PGLITE_MODULE may point to an independently installed @electric-sql/pglite entry.
// No environment files, Supabase credentials, or remote databases are used.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(process.env.PGLITE_MODULE
    ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const v2 = read("supabase/migrations/20260902021837_listening_rewards_and_level_up.sql");
const v3 = read("supabase/migrations/20260903003717_listening_mastery_reward_allocation.sql");
const originalFunction = name => {
    const start = v2.indexOf(`create or replace function ${name}(`);
    assert.ok(start >= 0, name);
    return v2.slice(start, v2.indexOf("$$;", start) + 3);
};
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0];

before(async () => {
    await db.exec(`
        create role anon; create role authenticated; create role service_role;
        create schema private;
        create table students(id bigint primary key, role text default 'student', learner_type text default 'academy_student',
            total_time_played integer default 0, current_time_played integer default 0, updated_at timestamptz);
        create table music_tracks(id bigint primary key, enabled boolean default true);
        create table listening_coverage_sessions(id uuid primary key default gen_random_uuid(), student_id bigint references students,
            track_id bigint references music_tracks, duration_seconds numeric, started_at timestamptz default now(),
            completed_at timestamptz, count_recorded boolean default false, eligible_for_count boolean default true,
            covered_ranges jsonb, covered_seconds numeric, coverage_percent numeric, ineligibility_reason text, updated_at timestamptz);
        create table student_feature_rollouts(student_id bigint references students, feature_key text, enabled boolean, primary key(student_id, feature_key));
        create table student_gamification_balances(student_id bigint primary key references students, total_xp integer default 0,
            points_balance integer default 0, updated_at timestamptz);
        create table student_gamification_ledger(id bigint generated always as identity primary key, student_id bigint references students,
            xp_delta integer, points_delta integer, source_type text, source_key text, description text, metadata jsonb,
            created_at timestamptz default now(), unique(student_id, source_type, source_key));
        create table student_track_progress(student_id bigint references students, track_id bigint references music_tracks,
            play_count integer, completed boolean, completed_at timestamptz, last_played_at timestamptz, updated_at timestamptz, primary key(student_id, track_id));
        create table student_listening_daily(student_id bigint, activity_date date, play_count integer, updated_at timestamptz, primary key(student_id, activity_date));
        create table student_listening_monthly(student_id bigint, month_start date, play_count integer, updated_at timestamptz, primary key(student_id, month_start));
        create table academy_classes(id bigint primary key, code text);
        create table academy_enrollments(student_id bigint references students, class_id bigint references academy_classes,
            status text, enrolled_at date, access_ends_at date, scheduled_departure_at date);
        create table assignments(id bigint primary key, enabled boolean default true, source_type text default 'music_track',
            assigned_date date default ((now() at time zone 'Asia/Taipei')::date - 1), due_at timestamptz,
            created_at timestamptz default (now() - interval '1 day'), track_id bigint, required_listens integer default 3, target_class text);
        create table assignment_track_items(assignment_id bigint references assignments, track_id bigint references music_tracks,
            required_listens integer, sort_order integer, primary key(assignment_id, track_id));
    `);
    // Use the deployed table DDL and all relevant deployed helpers, not mocked reward logic.
    await db.exec(v2.slice(v2.indexOf("create table if not exists public.assignment_listening_progress"), v2.indexOf("do $$")));
    for (const name of ["private.ae_level_for_xp", "private.ae_level_reward_points", "private.ae_gamification_grant_v2",
        "private.ae_gamification_track_progress_trigger", "public.record_student_music_play_v2",
        "public.start_listening_reward_session_v2", "private.ae_try_grant_assignment_completion_v2"]) {
        await db.exec(originalFunction(name));
    }
    await db.exec(`create trigger test_legacy_rewards after insert or update on student_track_progress
        for each row execute function private.ae_gamification_track_progress_trigger();
        insert into students(id) select generate_series(1,20);
        insert into music_tracks(id) select generate_series(1,50);
        insert into student_feature_rollouts select id, 'listening_rewards_v2', true from students;
        insert into academy_classes values (1,'E3'),(2,'E5');
        insert into academy_enrollments(student_id,class_id,status,enrolled_at) select id,1,'active',current_date-100 from students;
        insert into student_track_progress values(1,1,99,true,now(),now(),now());
        insert into student_gamification_ledger(student_id,xp_delta,points_delta,source_type,source_key) values(1,5,1,'listening_daily','track:1:old');
    `);
    await db.exec(v3);
});
after(() => db.close());

const start = async (student, track) => {
    const { session } = await scalar("select start_listening_reward_session_v3($1,$2,100) session", [student, track]);
    // Simulate elapsed wall time only in this isolated fixture; never production.
    await db.query("update listening_coverage_sessions set started_at = now() - interval '110 seconds' where id=$1", [session.id]);
    return session;
};
const complete = async (student, track, session) => (await scalar(
    "select complete_listening_reward_session_v3($1,$2,$3,'[[0,100]]',100,100) result", [student, track, session.id])).result;
const listen = async (student, track) => complete(student, track, await start(student, track));
const balance = student => scalar("select * from student_gamification_balances where student_id=$1", [student]);

test("舊次數／獎勵不回填；第9次無獎勵，第10次10XP+1點，第11次不重領", async () => {
    assert.equal((await scalar("select count(*)::int n from student_track_mastery")).n, 0);
    let result;
    for (let i = 0; i < 9; i++) result = await listen(1, 1);
    assert.equal(result.reward_status.mastery_count, 9);
    assert.equal((await balance(1)).total_xp, 0);
    result = await listen(1, 1);
    assert.equal(result.listening_xp_added, 10);
    assert.equal(result.listening_points_added, 1);
    assert.equal(result.reward_status.mastery_rewarded, true);
    result = await listen(1, 1);
    assert.equal(result.total_xp_added, 0);
    assert.equal(result.play_count, 110);
    // Changing the reward date cannot reset a lifetime source key.
    await db.exec("update student_gamification_ledger set created_at=now()-interval '1 day' where student_id=1");
    assert.equal((await listen(1, 1)).total_xp_added, 0);
});

test("每日3檔上限、第四檔保留10/10並於隔天再聽領取", async () => {
    let result;
    for (const track of [1,2,3,4]) for (let i = 0; i < 10; i++) result = await listen(2, track);
    assert.equal((await balance(2)).total_xp, 30);
    assert.equal((await balance(2)).points_balance, 3);
    assert.equal(result.reward_status.mastery_count, 10);
    assert.equal(result.reward_status.mastery_rewarded, false);
    assert.equal(result.reward_status.limit_reached, true);
    await db.exec("update student_gamification_ledger set created_at=now()-interval '1 day' where student_id=2");
    assert.equal((await listen(2, 4)).listening_points_added, 1);
});

test("同一音檔多份作業最早截止優先；每次只計一份，不湊自主10次", async () => {
    await db.exec(`insert into assignments(id,track_id,required_listens,due_at,target_class) values
        (100,10,2,now()+interval '2 days','E3'),(101,10,3,now()+interval '1 day','E3');`);
    const session = await start(3, 10);
    assert.equal(session.reward_status.assignment_id, 101);
    let result = await complete(3, 10, session);
    assert.equal(result.assignment_updates.length, 1);
    assert.equal(result.reward_status.mastery_count, 0);
    assert.equal(result.total_xp_added, 0);
    await listen(3, 10);
    result = await listen(3, 10);
    assert.equal(result.total_xp_added, 30);
    assert.equal(result.total_points_added, 5);
    assert.equal((await listen(3, 10)).reward_status.assignment_id, 100);
    assert.equal((await listen(3, 10)).total_xp_added, 30);
    result = await listen(3, 10);
    assert.equal(result.reward_status.source, "self_practice");
    assert.equal(result.reward_status.mastery_count, 1);
    assert.equal(result.play_count, 6);
    assert.equal((await scalar("select count(*)::int n from assignment_listening_events where student_id=3")).n, 5);
});

test("整份作業所有音檔才發獎、已達標音檔可自主練習；新作業可另領整份獎勵", async () => {
    await db.exec(`insert into assignments(id,target_class) values(110,'E3');
        insert into assignment_track_items values(110,11,1,0),(110,12,2,1);`);
    assert.equal((await listen(4, 11)).total_points_added, 0);
    assert.equal((await listen(4, 11)).reward_status.source, 'self_practice');
    await listen(4, 12);
    assert.equal((await listen(4, 12)).total_points_added, 5);
    for (let i=0;i<9;i++) await listen(4,11);
    await db.exec(`insert into assignments(id,track_id,required_listens,target_class) values(111,11,1,'E3')`);
    const result = await listen(4,11);
    assert.equal(result.reward_status.source, 'assignment');
    assert.equal(result.total_xp_added, 30);
    assert.equal(result.listening_xp_added, 0);
    assert.equal(result.reward_status.mastery_count, 10);
});

test("作業只計發布後開始的session，且排除過期、未發布、跨班、離校、一般會員", async () => {
    await db.exec(`insert into assignments(id,track_id,target_class,due_at,created_at) values
        (120,20,'E3',now()-interval '1 hour',now()-interval '2 days'),
        (121,20,'E5',null,now()-interval '2 days'),(122,20,'E3',null,now()+interval '1 hour');`);
    assert.equal((await listen(5,20)).reward_status.source, 'self_practice');
    const session = await start(5,20);
    await db.exec(`insert into assignments(id,track_id,target_class,created_at) values(123,20,'E3',now())`);
    assert.equal((await complete(5,20,session)).reward_status.source, 'self_practice');
    await db.exec(`update assignments set created_at=now()-interval '1 day' where id=123;
        update academy_enrollments set status='departed' where student_id=6;
        update students set learner_type='textbook_customer' where id=7;`);
    assert.equal((await listen(6,20)).reward_status.source, 'self_practice');
    assert.equal((await listen(7,20)).reward_status.source, 'self_practice');
});

test("同一session重送不增總次數、不重發獎；錯學生／錯音檔被拒絕", async () => {
    const session = await start(8,30);
    await assert.rejects(complete(9,30,session), /LISTENING_SESSION_UNAVAILABLE/);
    await assert.rejects(complete(8,31,session), /LISTENING_SESSION_UNAVAILABLE/);
    await complete(8,30,session);
    await assert.rejects(complete(8,30,session), /LISTENING_SESSION_UNAVAILABLE/);
    assert.equal((await scalar("select count(*)::int n from listening_reward_allocations where session_id=$1",[session.id])).n,1);
    assert.equal((await scalar("select play_count from student_track_progress where student_id=8 and track_id=30")).play_count,1);
});

test("未達80%、時間不足、老師與未開旗標均不得結算", async () => {
    const session = await start(9,30);
    await assert.rejects(db.query("select complete_listening_reward_session_v3(9,30,$1,'[[0,79]]',79,79)",[session.id]), /INVALID_LISTENING_COVERAGE/);
    await db.query("update listening_coverage_sessions set started_at=now() where id=$1",[session.id]);
    await assert.rejects(complete(9,30,session), /INVALID_LISTENING_COVERAGE/);
    await db.exec("update students set role='teacher' where id=10; update student_feature_rollouts set enabled=false where student_id=11");
    await assert.rejects(start(10,30), /STUDENT_NOT_FOUND/);
    await assert.rejects(start(11,30), /LISTENING_REWARDS_V2_DISABLED/);
    assert.equal((await scalar("select count(*)::int n from listening_reward_allocations where student_id=9")).n,0);
});

test("新版啟動會作廢舊session、沿用升等獎勵且無舊trigger額外發點", async () => {
    const first = await start(12,31);
    await start(12,32);
    await assert.rejects(complete(12,31,first), /LISTENING_SESSION_UNAVAILABLE/);
    await db.exec("insert into student_gamification_balances(student_id,total_xp) values(12,90)");
    let result;
    for (let i=0;i<10;i++) result=await listen(12,31);
    assert.equal(result.level_after,2);
    assert.equal(result.level_points_added,5);
    assert.equal(result.total_points_added,6);
    assert.equal((await scalar("select count(*)::int n from student_gamification_ledger where student_id=12")).n,2);
});

test("RLS與RPC限制可從Postgres catalog驗證", async () => {
    for (const role of ['anon','authenticated']) {
        const permissions = await scalar(`select
            has_table_privilege($1,'student_track_mastery','SELECT') can_read,
            has_table_privilege($1,'listening_reward_allocations','INSERT') can_write,
            has_function_privilege($1,'public.complete_listening_reward_session_v3(bigint,bigint,uuid,jsonb,numeric,numeric)','EXECUTE') can_complete`,[role]);
        assert.deepEqual(permissions,{can_read:false,can_write:false,can_complete:false});
    }
    assert.equal((await scalar("select count(*)::int n from pg_class where relname in ('student_track_mastery','listening_reward_allocations') and relrowsecurity")).n,2);
});
