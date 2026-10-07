import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as view from '../supabase/functions/_shared/speaking-challenge-view.ts';
import * as progression from '../supabase/functions/_shared/speaking-challenge-progression.ts';
test('新增每日紀錄關聯後，學生與管理員仍能載入口說列表及題數',async()=>{
 for (const role of ['student','admin']) {
  let handler;
  const fixture={id:11,book_id:1,title:'A–Z',books:{id:1,name:'Workbook 1'},generation_metadata:{interaction_type:'alphabet_round'},speaking_questions:[{id:21,sort_order:1}]};
  const client={
   rpc:async()=>({data:{completed_set_ids:[],level_daily_limit:1,alphabet_letter_daily_limit:3}}),
   from:table=>{
    let selection='';
    const query={select:v=>{selection=v;return query;},eq:()=>query,in:()=>query,
     then:resolve=>{
      const ambiguous=table==='speaking_question_sets'&&selection.includes('speaking_questions(');
      return Promise.resolve(ambiguous?{data:null,error:{code:'PGRST201'}}:
       {data:table==='speaking_question_sets'?[fixture]:[],count:0,error:null}).then(resolve);
     }};
    return query;
   }
  };
  vm.runInNewContext(code,{exports:{},require:name=>{
   if(name.startsWith('npm:@supabase/'))return{createClient:()=>client};
   if(name.endsWith('/firebase-auth.ts'))return{verifyFirebaseRequest:async()=>({id:5,role}),cleanText:v=>String(v||'')};
   if(name.endsWith('/speaking-challenge-view.ts'))return view;
   if(name.endsWith('/speaking-challenge-progression.ts'))return progression;
   if(name.endsWith('/book-entitlement.ts'))return{isBookEntitled:async()=>true,relationOne:v=>v};
   if(name.endsWith('/effective-access.ts'))return{loadEffectiveAccess:async()=>({is_active:true,features:{pronunciation:true}})};
   if(name.endsWith('/public-error.ts'))return{toPublicErrorResponse:error=>({status:500,payload:{error:error.code}})};
   return{};
  },Deno:{env:{get:()=> 'synthetic'},serve:fn=>{handler=fn;}},Response,Request,Intl,console});
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'catalog'})}));
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.challenges.length,1);
  assert.equal(result.challenges[0].question_count,1);
  assert.equal(result.challenges[0].is_unlocked,true);
  assert.equal(result.challenges[0].completed_today,false);
  assert.equal(result.demo_mode,role==='admin');
 }
});
const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/speaking-challenge/index.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('實際費用 handler 僅管理員可讀全站總額，前端偽造角色無效',async()=>{
 for(const role of ['student','teacher','admin']) {
  let handler,calls=0;
  const client={rpc:async name=>{assert.equal(name,'speaking_alphabet_cost_usage_v1');calls++;return{data:{estimated_twd:1500,reserved_seconds:168750}};}};
  vm.runInNewContext(code,{exports:{},require:name=>{
   if(name.startsWith('npm:@supabase/'))return{createClient:()=>client};
   if(name.endsWith('/firebase-auth.ts'))return{verifyFirebaseRequest:async()=>({id:5,role}),cleanText:v=>String(v||'')};
   if(name.endsWith('/speaking-challenge-view.ts'))return view;
   if(name.endsWith('/effective-access.ts'))return{loadEffectiveAccess:async()=>({is_active:true,features:{pronunciation:true}})};
   if(name.endsWith('/public-error.ts'))return{toPublicErrorResponse:error=>({status:error.status||500,payload:{error:'test'}})};
   return{};
  },Deno:{env:{get:()=> 'synthetic'},serve:fn=>{handler=fn;}},Response,Request,console});
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'alphabet_cost_usage',role:'admin'})}));
  assert.equal(response.status,role==='admin'?200:403);assert.equal(calls,role==='admin'?1:0);
 }
});
