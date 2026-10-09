import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const scalar = async (sql, args=[]) => (await db.query(sql,args)).rows[0];
const extract = (source,name) => { const start=source.indexOf("create or replace function "+name+"("); assert.ok(start>=0); return source.slice(start,source.indexOf("$$;",start)+3); };
let originalDate;
const correct = async (date="2015-03-02",expected=originalDate,admin=1,student=2,reason="測試帳號生日更正") => {
    await db.exec("set role service_role");
    try { return (await scalar("select public.admin_correct_student_birth_date_v1($1,$2,$3,$4,$5) result",[admin,student,expected,date,reason])).result; }
    finally { await db.exec("reset role"); }
};
before(async()=>{
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema private;
        create table public.students(id bigint primary key,role text default 'student',learner_type text default 'academy_student',
            date_of_birth date,account_status text default 'active',archived_at timestamptz,updated_at timestamptz,access_active boolean default true);
        create table academy_enrollments(student_id bigint references students,status text);
        create table student_gamification_balances(student_id bigint primary key references students,total_xp integer default 0,points_balance integer default 0,updated_at timestamptz);
        create table student_gamification_ledger(id bigint generated always as identity primary key,student_id bigint references students,xp_delta integer,points_delta integer,
            source_type text,source_key text,description text,metadata jsonb,created_at timestamptz default now(),unique(student_id,source_type,source_key));
        create function public.get_student_effective_access(p_student_id bigint,p_at timestamptz default now()) returns jsonb language sql as
            $$ select jsonb_build_object('is_active',access_active) from public.students where id=p_student_id $$;
        grant usage on schema private to service_role;
        grant all on students,academy_enrollments,student_gamification_balances,student_gamification_ledger to service_role;
        grant usage,select on sequence student_gamification_ledger_id_seq to service_role;`);
    const levels=read("supabase/migrations/20260902021837_listening_rewards_and_level_up.sql");
    for(const name of ["private.ae_level_for_xp","private.ae_level_reward_points"]) await db.exec(extract(levels,name));
    const original=read("supabase/migrations/20260903114141_academy_all_access_assignment_v2.sql");
    for(const name of ["private.ae_student_can_earn_points","private.ae_gamification_grant_v2"]) await db.exec(extract(original,name));
    await db.exec(read("supabase/migrations/20261008145617_birthday_month_rewards.sql"));
    await db.exec(read("supabase/migrations/20261008150318_birthday_xp_settlement.sql"));
    await db.exec(read("supabase/migrations/20261009050131_admin_birth_date_correction.sql"));
    await db.exec("create trigger students_birth_date_immutable_trigger before update of date_of_birth on students for each row execute function public.prevent_student_birth_date_change()");
});
beforeEach(async()=>{
    await db.exec(`reset role; truncate students,academy_enrollments,admin_birth_date_corrections,student_gamification_balances,student_gamification_ledger,birthday_reward_settings_history cascade;
        insert into birthday_reward_settings(singleton,enabled,gift_points,version) values(true,true,100,1) on conflict(singleton) do update set enabled=true,gift_points=100,version=1;
        insert into students(id,role) values(1,'admin'),(4,'teacher'),(5,'admin');
        update students set account_status='archived',archived_at=now() where id=5;
        insert into students(id,date_of_birth) select n,(date_trunc('month',now() at time zone 'Asia/Taipei')-interval '10 years')::date from generate_series(2,3) n;
        insert into academy_enrollments select id,'active' from students where role='student';`);
    originalDate=(await scalar("select date_of_birth::text as date from students where id=2")).date;
});
after(()=>db.close());
test("admin correction commits date, actor, reason and before/after audit atomically",async()=>{
    const result=await correct(); assert.equal(result.student.date_of_birth,"2015-03-02");
    assert.equal(result.history_entry.previous_date_of_birth,originalDate);assert.equal(result.history_entry.admin_id,1);
    assert.equal(result.history_entry.reason,"測試帳號生日更正");assert.ok(!("transaction_id" in result.history_entry));
    assert.equal((await scalar("select date_of_birth::text as date from students where id=2")).date,"2015-03-02");
    assert.equal((await scalar("select count(*)::int n from admin_birth_date_corrections")).n,1);
    assert.ok(!(await scalar("select current_setting('alan_english.birth_date_correction_id',true) as context")).context);
});
test("teacher, student and archived admin identities cannot correct a birthday",async()=>{
    for(const id of [2,4,5,999]) await assert.rejects(correct("2015-03-02",originalDate,id),/ADMIN_REQUIRED/);
    assert.equal((await scalar("select count(*)::int n from admin_birth_date_corrections")).n,0);
});
test("only student targets may be corrected",async()=>{
    for(const id of [1,4,999]) await assert.rejects(correct("2015-03-02",null,1,id),/STUDENT_NOT_FOUND/);
});
test("stale expected birthday and duplicate requests cannot overwrite a correction",async()=>{
    await correct();await assert.rejects(correct(),/BIRTH_DATE_CHANGED/);
    await assert.rejects(correct("2014-02-03",null),/BIRTH_DATE_CHANGED/);
    assert.equal((await scalar("select count(*)::int n from admin_birth_date_corrections")).n,1);
});
test("invalid, future, unchanged birthdays and empty/oversized reasons create no audit",async()=>{
    for(const date of [null,"1899-12-31","2099-01-01"]) await assert.rejects(correct(date),/INVALID_BIRTH_DATE_CORRECTION/);
    await assert.rejects(correct(originalDate),/BIRTH_DATE_UNCHANGED/);
    for(const reason of [null," ","a","x".repeat(501)]) await assert.rejects(correct("2015-03-02",originalDate,1,2,reason),/INVALID_BIRTH_DATE_CORRECTION/);
    assert.equal((await scalar("select count(*)::int n from admin_birth_date_corrections")).n,0);
});
test("first registration is preserved while ordinary service updates remain immutable",async()=>{
    await db.exec("insert into students(id) values(6);set role service_role");
    try { await db.exec("update students set date_of_birth='2016-01-01' where id=6");
        await assert.rejects(db.exec("update students set date_of_birth='2016-02-02' where id=6"),/student_date_of_birth_is_immutable/);
        await assert.rejects(db.exec("update students set date_of_birth=null where id=2"),/student_date_of_birth_is_immutable/);
    } finally { await db.exec("reset role"); }
});
test("browser roles have no table DML or correction RPC privileges",async()=>{
    const permissions=await scalar(`select relrowsecurity as rls,has_table_privilege('anon','admin_birth_date_corrections','SELECT,INSERT,UPDATE,DELETE') as anon,
        has_table_privilege('authenticated','admin_birth_date_corrections','SELECT,INSERT,UPDATE,DELETE') as authenticated,
        has_function_privilege('authenticated','admin_correct_student_birth_date_v1(bigint,bigint,date,date,text)','EXECUTE') as rpc
        from pg_class where oid='admin_birth_date_corrections'::regclass`);
    assert.deepEqual(permissions,{rls:true,anon:false,authenticated:false,rpc:false});
    for(const role of ["anon","authenticated"]) { await db.exec("set role "+role);
        try { await assert.rejects(db.exec("select * from admin_birth_date_corrections"),/permission denied/);
            await assert.rejects(db.query("select admin_correct_student_birth_date_v1(1,2,$1,'2015-03-02','test')",[originalDate]),/permission denied/);
        } finally { await db.exec("reset role"); }
    }
});
test("forged setting and an old matching audit cannot bypass transaction guard",async()=>{
    const first=await correct();await correct(originalDate,"2015-03-02");
    await db.exec("begin;set role service_role");
    try { await db.query("select set_config('alan_english.birth_date_correction_id',$1,true)",[String(first.history_entry.id)]);
        await assert.rejects(db.exec("update students set date_of_birth='2015-03-02' where id=2"),/student_date_of_birth_is_immutable/);
    } finally { await db.exec("rollback;reset role"); }
});
test("a failed student update rolls back its inserted audit",async()=>{
    await db.exec("create function test_reject_birth_date() returns trigger language plpgsql as $$ begin raise exception 'fixture_update_failed'; end $$;create trigger test_reject before update of date_of_birth on students for each row execute function test_reject_birth_date()");
    try { await assert.rejects(correct(),/fixture_update_failed/); }
    finally { await db.exec("drop trigger test_reject on students;drop function test_reject_birth_date()"); }
    assert.equal((await scalar("select count(*)::int n from admin_birth_date_corrections")).n,0);
    assert.equal((await scalar("select date_of_birth::text as date from students where id=2")).date,originalDate);
});
test("changing birthday out and back preserves annual gift and applies XP only to new learning",async()=>{
    const claim=async()=> (await scalar("select claim_student_birthday_reward_v1(2) result")).result;
    assert.equal((await claim()).just_granted,true);
    const otherMonth=(await scalar("select (date_trunc('month',now() at time zone 'Asia/Taipei')-interval '10 years 1 month')::date::text as date")).date;
    await correct(otherMonth);assert.equal((await claim()).is_birthday_month,false);
    await db.exec("select private.ae_gamification_grant_v2(2,30,0,'speaking_challenge_complete','normal','fixture','{}')");
    await correct(originalDate,otherMonth);
    await db.exec("update birthday_reward_settings set gift_points=150;select private.ae_gamification_grant_v2(2,30,0,'speaking_challenge_complete','birthday','fixture','{}')");
    const repeated=await claim();assert.equal(repeated.just_granted,false);assert.equal(repeated.gift_points,100);
    const ledger=(await db.query("select source_key,xp_delta,points_delta from student_gamification_ledger order by id")).rows;
    assert.deepEqual(ledger.map(x=>[x.xp_delta,x.points_delta]),[[0,100],[30,0],[60,0]]);
});
