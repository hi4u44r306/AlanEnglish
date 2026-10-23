// 通過門檻 70 → 60 的 migration（20261022021310）：在原有 70 分的函式上再套用，驗證只有門檻變了。
import {before, after, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db=new PGlite();
const read=name=>readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
const scalar=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
const session=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const score=async(n,q,mode='challenge',value=70,matched=true,hint=false)=>db.query(`insert into speaking_pronunciation_attempts(student_id,question_set_id,question_id,client_session_id,challenge_mode,completeness_score,answer_match,hint_used) values(1,10,$1,$2,$3,$4,$5,$6)`,[q,session(n),mode,value,matched,hint]);
const complete=async(n,q,mode='challenge')=>(await scalar(`select complete_speaking_session_question_v2(1,10,$1,$2,$3) result`,[q,session(n),mode])).result;
before(async()=>{
 await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create table students(id bigint primary key);
  create table speaking_question_sets(id bigint primary key,status text);
  create table speaking_questions(id bigint primary key,question_set_id bigint references speaking_question_sets);
  create table speaking_pronunciation_attempts(id bigint generated always as identity primary key,student_id bigint,question_set_id bigint,question_id bigint,client_session_id uuid,challenge_mode text,pronunciation_score numeric,completeness_score numeric,answer_match boolean,hint_used boolean default false,created_at timestamptz default now());
  create table speaking_challenge_hint_reveals(student_id bigint,question_id bigint,client_session_id uuid);
  create table speaking_challenge_mode_progress(student_id bigint,question_set_id bigint,question_id bigint,primary key(student_id,question_id));
  create table speaking_foundation_rounds(id uuid primary key,student_id bigint,question_set_id bigint,question_order bigint[]);
  create table speaking_pronunciation_requests(id uuid primary key,provider text);
  create table test_rewards(student_id bigint,question_set_id bigint,primary key(student_id,question_set_id));
  create function complete_speaking_challenge_question_v2(s bigint,b bigint,q bigint) returns jsonb language plpgsql as $$
   declare granted boolean;
   begin insert into public.test_rewards values(s,b) on conflict do nothing; granted:=found;
   return jsonb_build_object('xp_awarded',case when granted then 30 else 0 end,'ae_points_awarded',case when granted then 3 else 0 end);end; $$;
  create function record_speaking_foundation_assessment_v3(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean) returns jsonb language sql as $$ select jsonb_build_object('status',case when $12 then 'completed' else 'retry' end); $$;
  create function reserve_speaking_pronunciation_request_v2(bigint,bigint,bigint,text,integer,uuid) returns jsonb language plpgsql as $$
   declare request_id uuid:=gen_random_uuid();
   begin insert into public.speaking_pronunciation_requests values(request_id,'azure');return jsonb_build_object('allowed',true,'request_id',request_id);end; $$;
  insert into students values(1);
  insert into speaking_question_sets values(10,'published'),(11,'published');
  insert into speaking_questions values(100,10),(101,10),(102,11);
 `);
 await db.exec(read('20260918063338_speaking_challenge_daily_sessions.sql'));
 await db.exec(read('20261007155958_speaking_challenge_only_reassessment.sql'));
 await db.exec(read('20261022021310_speaking_pass_score_60.sql'));
});
after(()=>db.close());
test('59 分拒絕，60 分接受；答案錯誤、提示、舊回合仍不能通關',async()=>{
 await score(1,100,'challenge',59); await assert.rejects(complete(1,100),/CORRECT_ASSESSMENT_REQUIRED/);
 await score(1,100,'challenge',60);assert.equal((await complete(1,100)).challenge_completed,false);
 await score(2,100,'challenge',100,false);await assert.rejects(complete(2,100),/CORRECT_ASSESSMENT_REQUIRED/);
 await score(3,100,'challenge',100,true,true);await assert.rejects(complete(3,100),/CORRECT_ASSESSMENT_REQUIRED/);
 await score(4,100,'challenge',60);await score(4,100,'challenge',100,false);await assert.rejects(complete(4,100),/CORRECT_ASSESSMENT_REQUIRED/);
});
test('全關 60 分通過才發獎勵一次，重送不重發；新 migration 不改權限',async()=>{
 await score(5,100,'challenge',60);await score(5,101,'challenge',65);
 assert.equal((await complete(5,100)).challenge_completed,false);
 const done=await complete(5,101);assert.equal(done.challenge_completed,true);assert.equal(done.xp_awarded,30);
 assert.equal((await complete(5,101)).xp_awarded,0);
 for(const role of ['anon','authenticated']){
  assert.equal((await scalar(`select has_function_privilege($1,'complete_speaking_session_question_v2(bigint,bigint,bigint,uuid,text)','execute') allowed`,[role])).allowed,false);
 }
 assert.equal((await scalar(`select has_function_privilege('service_role','complete_speaking_session_question_v2(bigint,bigint,bigint,uuid,text)','execute') allowed`)).allowed,true);
});
