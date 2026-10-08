import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const extract = (source,name) => { const start=source.indexOf('create or replace function '+name+'('); assert.ok(start>=0,name); return source.slice(start,source.indexOf('$$;',start)+3); };
const scalar = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
const claim = async id => (await scalar('select public.claim_student_birthday_reward_v1($1) result',[id])).result;
const save = async (points,version=1,enabled=true,admin=1) => (await scalar('select public.save_birthday_reward_settings_v1($1,$2,$3,$4) result',[admin,points,enabled,version])).result;
before(async()=>{
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create schema private;
        create table students(id bigint primary key,role text default 'student',learner_type text default 'academy_student',
            archived_at timestamptz,account_status text default 'active',date_of_birth date,access_active boolean default true);
        create table academy_enrollments(student_id bigint references students,status text);
        create table speaking_question_sets(id bigint primary key,status text);
        create table speaking_questions(id bigint primary key,question_set_id bigint references speaking_question_sets);
        create table speaking_challenge_question_progress(student_id bigint references students,question_set_id bigint,question_id bigint,
            status text,opened_at timestamptz,completed_at timestamptz,updated_at timestamptz,unique(student_id,question_id));
        insert into speaking_question_sets values(10,'published'),(11,'draft');
        insert into speaking_questions values(100,10),(101,10),(110,11);

        create table student_gamification_balances(student_id bigint primary key references students,total_xp integer default 0,points_balance integer default 0,updated_at timestamptz);
        create table student_gamification_ledger(id bigint generated always as identity primary key,student_id bigint references students,
            xp_delta integer,points_delta integer,source_type text,source_key text,description text,metadata jsonb,created_at timestamptz default now(),unique(student_id,source_type,source_key));
        create function public.get_student_effective_access(p_student_id bigint,p_as_of timestamptz default now()) returns jsonb language sql as
            $$ select jsonb_build_object('is_active',access_active) from public.students where id=p_student_id $$;
        insert into students(id,role) values(1,'admin');
    `);
    const v2=read('supabase/migrations/20260902021837_listening_rewards_and_level_up.sql');
    for(const name of ['private.ae_level_for_xp','private.ae_level_reward_points']) await db.exec(extract(v2,name));
    const current=read('supabase/migrations/20260903114141_academy_all_access_assignment_v2.sql');
    for(const name of ['private.ae_student_can_earn_points','private.ae_gamification_grant_v2']) await db.exec(extract(current,name));
    await db.exec(read('supabase/migrations/20261008145617_birthday_month_rewards.sql'));
    await db.exec(read('supabase/migrations/20261008150318_birthday_xp_settlement.sql'));
    await db.exec(read('supabase/migrations/20261008150529_birthday_reward_compatibility.sql'));
});
after(()=>db.close());
beforeEach(async()=>{
    await db.exec(`truncate speaking_challenge_question_progress,birthday_reward_settings_history,student_gamification_ledger,student_gamification_balances,academy_enrollments;
        delete from students where id<>1;
        update birthday_reward_settings set enabled=true,gift_points=100,version=1,updated_by=null;
        insert into students(id,date_of_birth) select n,(date_trunc('month',now() at time zone 'Asia/Taipei')-interval '10 years')::date from generate_series(2,12) n;
        insert into academy_enrollments select id,'active' from students where id<>1;`);
});
test('birthday gift adds exactly 100 points and no XP; refresh and queued claims do not duplicate',async()=>{
    const first=await claim(2); assert.equal(first.gift_points,100); assert.equal(first.just_granted,true);
    const repeats=await Promise.all([claim(2),claim(2),claim(2)]); assert.ok(repeats.every(x=>!x.just_granted));
    assert.deepEqual(await scalar('select total_xp,points_balance from student_gamification_balances where student_id=2'),{total_xp:0,points_balance:100});
    assert.equal((await scalar('select count(*)::integer n from student_gamification_ledger')).n,1);
});
test('admin change applies to unclaimed gifts and preserves the received amount',async()=>{
    await claim(2); const config=await save(150); assert.equal(config.version,2);
    assert.equal((await claim(2)).gift_points,100); assert.equal((await claim(3)).gift_points,150);
    const row=await scalar('select admin_id,previous_settings,new_settings from birthday_reward_settings_history');
    assert.equal(row.admin_id,1); assert.equal(row.previous_settings.gift_points,100); assert.equal(row.new_settings.gift_points,150);
});
test('stale configuration edit is refused without overriding newer settings',async()=>{
    await save(150); await assert.rejects(save(200),/BIRTHDAY_SETTINGS_CHANGED/);
    assert.equal((await scalar('select gift_points from birthday_reward_settings')).gift_points,150);
});
test('students and teachers cannot change configuration; amounts are bounded',async()=>{
    await assert.rejects(save(200,1,true,2),/BIRTHDAY_ADMIN_REQUIRED/);
    await db.exec("update students set role='teacher' where id=2");
    await assert.rejects(save(200,1,true,2),/BIRTHDAY_ADMIN_REQUIRED/);
    for(const points of [-1,10001,null]) await assert.rejects(save(points),/INVALID_BIRTHDAY_SETTINGS/);
});
test('zero gift and disabled activity do not issue points or mark the annual gift as used',async()=>{
    await save(0); assert.equal((await claim(2)).gift_status,'disabled');
    await save(100,2,false); assert.equal((await claim(2)).just_granted,false);
    await save(100,3,true); assert.equal((await claim(2)).just_granted,true);
});
test('non-academy students cannot receive birthday points, but retain birthday-month status',async()=>{
    for(const type of ['textbook_customer','trial_user']){
        await db.query('update students set learner_type=$1 where id=2',[type]);
        const result=await claim(2); assert.equal(result.gift_status,'not_eligible'); assert.equal(result.is_birthday_month,true);
    }
    await db.exec("update academy_enrollments set status='departed' where student_id=2");
    assert.equal((await claim(2)).just_granted,false);
});
test('inactive access, disabled/archived accounts and staff cannot receive gifts',async()=>{
    await db.exec("update students set access_active=false where id=2; update students set account_status='disabled' where id=3; update students set archived_at=now() where id=4; update students set role='teacher' where id=5");
    for(const id of [1,2,3,4,5]) assert.equal((await claim(id)).just_granted,false);
});
test('missing birthday, wrong month and future birthday do not receive rewards',async()=>{
    await db.exec("update students set date_of_birth=null where id=2; update students set date_of_birth=(date_trunc('month',now() at time zone 'Asia/Taipei')-interval '10 years 1 month')::date where id=3; update students set date_of_birth=((now() at time zone 'Asia/Taipei')::date+1) where id=4");
    for(const id of [2,3,4]) assert.equal((await claim(id)).is_birthday_month,false);
});
test('month boundaries use Taipei time including year change and February 29 birthdays',async()=>{
    await db.exec("update students set date_of_birth='2016-02-29' where id=2; update students set date_of_birth='2015-01-01' where id=3");
    const eligible=async(id,at)=>(await scalar('select private.ae_birthday_month_eligible($1,$2) ok',[id,at])).ok;
    assert.equal(await eligible(2,'2027-01-31T15:59:59Z'),false);
    assert.equal(await eligible(2,'2027-01-31T16:00:00Z'),true);
    assert.equal(await eligible(2,'2027-02-28T15:59:59Z'),true);
    assert.equal(await eligible(2,'2027-02-28T16:00:00Z'),false);
    assert.equal(await eligible(3,'2026-12-31T16:00:00Z'),true);
});
test('last-year gift does not block this year; summary never returns birth date',async()=>{
    await db.exec("insert into student_gamification_ledger(student_id,xp_delta,points_delta,source_type,source_key) values(2,0,100,'birthday_gift',concat('year:',extract(year from now() at time zone 'Asia/Taipei')::integer-1))");
    const result=await claim(2); assert.equal(result.just_granted,true); assert.doesNotMatch(JSON.stringify(result),/date_of_birth|firebase_uid/);
});
test('new tables have RLS; browser roles cannot read or execute birthday RPCs',async()=>{
    for(const role of ['anon','authenticated']){
        for(const table of ['birthday_reward_settings','birthday_reward_settings_history']) assert.equal((await scalar('select has_table_privilege($1,$2,\'select\') ok',[role,'public.'+table])).ok,false);
        for(const fn of ['public.claim_student_birthday_reward_v1(bigint)','public.save_birthday_reward_settings_v1(bigint,integer,boolean,integer)']) assert.equal((await scalar('select has_function_privilege($1,$2,\'execute\') ok',[role,fn])).ok,false);
    }
    assert.equal((await scalar("select count(*)::integer n from pg_class where relname in ('birthday_reward_settings','birthday_reward_settings_history') and relrowsecurity")).n,2);
});
const grant = async (id,xp,points=1,source='listening_mastery',key='track:1',metadata={}) =>
    (await scalar("select private.ae_gamification_grant_v2($1,$2,$3,$4,$5,'test',$6) ok",[id,xp,points,source,key,JSON.stringify(metadata)])).ok;
test('birthday XP doubles, regular AE Points remain unchanged, and duplicate events award nothing',async()=>{
    assert.equal(await grant(2,30,3,'speaking_challenge_complete'),true);
    assert.equal(await grant(2,30,3,'speaking_challenge_complete'),false);
    assert.deepEqual(await scalar('select total_xp,points_balance from student_gamification_balances where student_id=2'),{total_xp:60,points_balance:3});
    const row=await scalar('select xp_delta,metadata from student_gamification_ledger');
    assert.equal(row.xp_delta,60);assert.equal(row.metadata.base_xp,30);assert.equal(row.metadata.xp_multiplier,2);
});
test('double XP crosses level boundaries using unchanged once-per-level point awards',async()=>{
    await db.exec('insert into student_gamification_balances(student_id,total_xp,points_balance) values(2,80,0)');
    await grant(2,10);assert.deepEqual(await scalar('select total_xp,points_balance from student_gamification_balances where student_id=2'),{total_xp:100,points_balance:6});
    assert.equal((await scalar("select count(*)::integer n from student_gamification_ledger where source_type='level_up'")).n,1);
});
test('non-academy eligible learners get double XP but no new learning or level points',async()=>{
    await db.exec("update students set learner_type='textbook_customer' where id=2; insert into student_gamification_balances(student_id,total_xp,points_balance) values(2,80,7)");
    await grant(2,10);assert.deepEqual(await scalar('select total_xp,points_balance from student_gamification_balances where student_id=2'),{total_xp:100,points_balance:7});
});
test('disabled activity, missing birthday or inactive access never doubles base XP',async()=>{
    await save(100,1,false);await grant(2,10);
    assert.equal((await scalar('select total_xp from student_gamification_balances where student_id=2')).total_xp,10);
    await save(100,2,true);await db.exec('update students set date_of_birth=null where id=3; update students set access_active=false where id=4');
    for(const id of [3,4]){await grant(id,10);assert.equal((await scalar('select total_xp from student_gamification_balances where student_id=$1',[id])).total_xp,10);}
});
test('adjustments and negative XP do not double; forged metadata cannot choose a multiplier',async()=>{
    await grant(2,10,0,'admin_adjustment','change:1');await grant(2,-3,0,'listening_mastery','change:2');
    assert.equal((await scalar('select total_xp from student_gamification_balances where student_id=2')).total_xp,7);
    await grant(3,10,0,'listening_mastery','track:2',{xp_multiplier:999,base_xp:999});
    const row=await scalar('select metadata from student_gamification_ledger where student_id=3');
    assert.equal(row.metadata.xp_multiplier,2);assert.equal(row.metadata.base_xp,10);
});

test('legacy listening rollout doubles only new XP and deduplicates the original source key',async()=>{
    const legacy=async(id)=>(await scalar("select private.ae_gamification_grant($1,5,1,'listening_daily','track:1:today','listening','{}') ok",[id])).ok;
    assert.equal(await legacy(2),true);assert.equal(await legacy(2),false);
    assert.deepEqual(await scalar('select total_xp,points_balance from student_gamification_balances where student_id=2'),{total_xp:10,points_balance:1});
    await db.exec('update students set date_of_birth=null where id=3');await legacy(3);
    assert.equal((await scalar('select total_xp from student_gamification_balances where student_id=3')).total_xp,5);
});

const game=async(id,key,won=true)=>(await scalar("select * from public.record_game_gamification($1,'word_game',$2,$3)",[id,key,won]));
test('birthday game limit is 30 base XP = 60 actual XP and still only 2 regular points',async()=>{
    const rewards=[];for(let i=0;i<4;i++) rewards.push(await game(2,'round:'+i));
    assert.deepEqual(rewards.map(x=>x.xp_added),[20,20,20,0]);
    assert.deepEqual(rewards.map(x=>x.points_added),[2,0,0,0]);
    assert.equal(rewards[3].total_xp,60);assert.equal(rewards[3].points_balance,2);
    assert.equal((await game(2,'round:0')).xp_added,0);
});
test('ordinary games retain the 30 XP cap and historical rows without base_xp count correctly',async()=>{
    await db.exec('update students set date_of_birth=null where id=2');
    for(let i=0;i<4;i++) await game(2,'normal:'+i);
    assert.equal((await scalar('select total_xp from student_gamification_balances where student_id=2')).total_xp,30);
    await db.exec("insert into student_gamification_balances(student_id,total_xp,points_balance) values(3,20,2);insert into student_gamification_ledger(student_id,xp_delta,points_delta,source_type,source_key,metadata) values(3,20,2,'game','old:1','{}')");
    assert.equal((await game(3,'new:1')).xp_added,20);assert.equal((await game(3,'new:2')).xp_added,0);
});
test('game reward response reports actual zero points for non-academy users',async()=>{
    await db.exec("update students set learner_type='textbook_customer' where id=2");
    const result=await game(2,'round:1');assert.equal(result.xp_added,20);assert.equal(result.points_added,0);assert.equal(result.points_balance,0);
});

const speak=async(id,question=101,set=10)=>(await scalar('select public.complete_speaking_challenge_question_v2($1,$2,$3) result',[id,set,question])).result;
test('speaking response matches actual birthday XP, completion and repeat reward stays unchanged',async()=>{
    assert.equal((await speak(2,100)).xp_awarded,0);
    const result=await speak(2);assert.equal(result.xp_awarded,60);assert.equal(result.total_xp,60);assert.equal(result.ae_points_awarded,3);
    const repeat=await speak(2);assert.equal(repeat.xp_awarded,0);assert.equal(repeat.total_xp,60);
    await db.exec('update students set date_of_birth=null where id=3');await speak(3,100);
    assert.equal((await speak(3)).xp_awarded,30);
});
test('speaking retains published-set and student-only checks',async()=>{
    await assert.rejects(speak(2,110,11),/SPEAKING_QUESTION_NOT_IN_PUBLISHED_SET/);
    await assert.rejects(speak(1,100),/STUDENT_NOT_ELIGIBLE/);
});
