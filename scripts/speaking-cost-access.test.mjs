import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as view from '../supabase/functions/_shared/speaking-challenge-view.ts';
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
