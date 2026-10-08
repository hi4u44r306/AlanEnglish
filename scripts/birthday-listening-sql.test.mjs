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
const tenListenCompletion = read("supabase/migrations/20260929160000_require_ten_listens_for_track_completion.sql");
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
        create table student_feature_rollouts(student_id bigint references students, feature_key text, enabled boolean,
            enabled_at timestamptz, disabled_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(),
            primary key(student_id, feature_key));
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
        "public.start_listening_reward_session_v2", "private.ae_try_grant_assignment_completion_v2", "private.ae_record_assignment_listening_v2", "public.complete_listening_reward_session_v2"]) {
        await db.exec(originalFunction(name));
    }
    await db.exec(`create trigger test_legacy_rewards after insert or update on student_track_progress
        for each row execute function private.ae_gamification_track_progress_trigger();
        insert into students(id) select generate_series(1,20);
        insert into music_tracks(id) select generate_series(1,50);
        insert into student_feature_rollouts(student_id, feature_key, enabled)
            select id, 'listening_rewards_v2', true from students;
        insert into academy_classes values (1,'E3'),(2,'E5');
        insert into academy_enrollments(student_id,class_id,status,enrolled_at) select id,1,'active',current_date-100 from students;
        insert into student_track_progress values(1,1,99,true,now(),now(),now());
        insert into student_gamification_ledger(student_id,xp_delta,points_delta,source_type,source_key) values(1,5,1,'listening_daily','track:1:old');
    `);
    await db.exec(v3);
    await db.exec(tenListenCompletion);
    await db.exec(`alter table students add column date_of_birth date, add column archived_at timestamptz,
        add column account_status text default 'active',add column access_active boolean default true;
        update students set date_of_birth=(date_trunc('month',now() at time zone 'Asia/Taipei')-interval '10 years')::date;
        create function public.get_student_effective_access(p_student_id bigint,p_as_of timestamptz default now()) returns jsonb language sql as
        $$ select jsonb_build_object('is_active',access_active) from public.students where id=p_student_id $$;`);
    const pointsPolicy=read('supabase/migrations/20260903114141_academy_all_access_assignment_v2.sql');
    const first=pointsPolicy.indexOf('create or replace function private.ae_student_can_earn_points(');
    await db.exec(pointsPolicy.slice(first,pointsPolicy.indexOf('$$;',first)+3));
    await db.exec(read('supabase/migrations/20261008145617_birthday_month_rewards.sql'));
    await db.exec(read('supabase/migrations/20261008150318_birthday_xp_settlement.sql'));
    await db.exec(read('supabase/migrations/20261008150529_birthday_reward_compatibility.sql'));
    await db.exec(read('supabase/migrations/20261008151540_birthday_listening_feedback.sql'));

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


test('real V3 listening: tenth listen awards and reports 20 birthday XP, one point; repeat never rewards',async()=>{
    for(let i=0;i<9;i++) assert.equal((await listen(2,2)).listening_xp_added,0);
    const session=await start(2,2);const result=await complete(2,2,session);
    assert.equal(result.listening_xp_added,20);assert.equal(result.total_xp_added,20);assert.equal(result.listening_points_added,1);
    assert.equal((await balance(2)).total_xp,20);
    await assert.rejects(complete(2,2,session),/LISTENING_SESSION_UNAVAILABLE/);
    assert.equal((await listen(2,2)).listening_xp_added,0);
});
test('real V3 listening preserves ordinary XP and non-academy points qualification',async()=>{
    await db.exec("update students set date_of_birth=null where id=3;update students set learner_type='textbook_customer' where id=4");
    for(const id of [3,4]){let result;for(let i=0;i<10;i++)result=await listen(id,id);
        assert.equal(result.listening_xp_added,id===3?10:20);assert.equal(result.listening_points_added,id===3?1:0);
    }
});
test('real V3 assignment completion doubles its XP without counting it as autonomous mastery',async()=>{
    await db.exec("insert into assignments(id,target_class,track_id,required_listens) values(100,'E3',5,1)");
    const result=await listen(5,5);assert.equal(result.listening_xp_added,0);assert.equal(result.total_xp_added,60);
    assert.equal(result.total_points_added,5);assert.equal(result.assignment_updates[0].completion_reward_granted,true);
});
test('real V2 session reports 10 birthday XP for its original 5-XP daily event',async()=>{
    const session=(await scalar('select to_jsonb(s) session from start_listening_reward_session_v2(6,6,100) s')).session;
    await db.query("update listening_coverage_sessions set started_at=now()-interval '110 seconds' where id=$1",[session.id]);
    const result=await scalar("select * from complete_listening_reward_session_v2(6,6,$1,'[[0,100]]',100,100)",[session.id]);
    assert.equal(result.listening_xp_added,10);assert.equal(result.total_xp_added,10);assert.equal(result.listening_points_added,0);
});
