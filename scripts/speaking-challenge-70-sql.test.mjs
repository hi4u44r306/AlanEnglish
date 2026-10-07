// Isolated PostgreSQL execution of the new migration, with explicit stubs for
// unchanged reward and foundation writers (covered by existing round SQL tests).
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
 await db.exec(read('20261007150657_speaking_challenge_only_reassessment.sql'));
});
after(()=>db.close());
test('69 分拒絕，70 分接受；沒有評分、不同回合、答案錯誤及提示不能通關',async()=>{
 await score(1,100,'challenge',69); await assert.rejects(complete(1,100),/CORRECT_ASSESSMENT_REQUIRED/);
 await score(1,100);assert.equal((await complete(1,100)).challenge_completed,false);
 await assert.rejects(complete(2,100),/CORRECT_ASSESSMENT_REQUIRED/);
 await score(2,100,'challenge',100,false);await assert.rejects(complete(2,100),/CORRECT_ASSESSMENT_REQUIRED/);
 await score(3,100,'challenge',100,true,true);await assert.rejects(complete(3,100),/CORRECT_ASSESSMENT_REQUIRED/);
});
test('練習完成全部題目仍不寫挑戰進度、不發獎勵',async()=>{
 const beforeCount=await scalar('select count(*)::int count from speaking_challenge_mode_progress');
 for(const q of [100,101]){await score(4,q,'easy',100);const result=await complete(4,q,'easy');assert.equal(result.challenge_completed,false);assert.equal(result.xp_awarded,0);if(q===101)assert.equal(result.practice_completed,true);}
 assert.equal((await scalar('select count(*)::int count from speaking_challenge_mode_progress')).count,beforeCount.count);
 assert.equal((await scalar('select count(*)::int count from test_rewards')).count,0);
});
test('只計同一模式與回合；全關挑戰通過才發獎勵，重送不重發',async()=>{
 await score(5,101);assert.equal((await complete(5,101)).challenge_completed,false);
 await score(1,101);const result=await complete(1,101);assert.equal(result.challenge_completed,true);assert.equal(result.xp_awarded,30);assert.equal(result.ae_points_awarded,3);
 assert.equal((await complete(1,101)).xp_awarded,0);
});
test('通關後可再開新回合評分完成，不重複發獎勵',async()=>{
 for(const q of [100,101]){await score(6,q);const result=await complete(6,q);assert.equal(result.xp_awarded,0);if(q===101)assert.equal(result.challenge_completed,true);}
});
test('後來的失敗結果會阻止使用先前的成功結果',async()=>{
 await score(7,100);await score(7,100,'challenge',100,false);await assert.rejects(complete(7,100),/CORRECT_ASSESSMENT_REQUIRED/);
});
test('匿名及登入前端角色不可直接執行進度 RPC，也不可讀寫新進度表',async()=>{
 for(const role of ['anon','authenticated']){
  assert.equal((await scalar(`select has_function_privilege($1,'complete_speaking_session_question_v2(bigint,bigint,bigint,uuid,text)','execute') allowed`,[role])).allowed,false);
  assert.equal((await scalar(`select has_table_privilege($1,'speaking_session_question_completions','select') allowed`,[role])).allowed,false);
 }
});
test('Azure 拼字 reservation 歸入現有基本評分費用統計',async()=>{
 const result=(await scalar(`select reserve_speaking_azure_spelling_request_v1(1,10,100,3,null) result`)).result;
 assert.equal((await scalar('select provider from speaking_pronunciation_requests where id=$1',[result.request_id])).provider,'azure_alphabet_basic');
});
test('A–Z wrapper 70 分以下不通過，70 分完整挑戰才寫地圖進度',async()=>{
 await db.query('insert into speaking_foundation_rounds values($1,1,10,array[100,101]::bigint[])',[session(8)]);
 const call=value=>scalar(`select record_speaking_foundation_challenge_v4(1,$1,100,$1,$2,80,80,100,null,'A','[]',true) result`,[session(8),value]);
 assert.equal((await call(69)).result.status,'retry');assert.equal((await call(70)).result.status,'completed');
});
