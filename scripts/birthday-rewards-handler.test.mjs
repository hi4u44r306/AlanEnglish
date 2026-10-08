import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/gamification/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''));
function harness({role='student',validToken=true,rpcFailure=null}={}){
    let handler;const calls=[];
    const tables={ students:[{id:7,role,firebase_uid:'mock-uid',name:'fixture',account_status:'active'}],
        birthday_reward_settings:[{singleton:true,gift_points:100,enabled:true,version:1}],
        student_gamification_balances:[{student_id:7,total_xp:20,points_balance:0}],student_gamification_ledger:[],student_social_profiles:[] };
    const admin={from(table){const filters=[];let one=false;const q={
        select(){calls.push({read:table});return q;},eq(field,value){filters.push(x=>x[field]===value);return q;},order(){return q;},limit(){return q;},single(){one=true;return q;},maybeSingle(){one=true;return q;},
        then(resolve,reject){const rows=(tables[table]||[]).filter(x=>filters.every(f=>f(x)));return Promise.resolve({data:one?rows[0]||null:rows,error:null}).then(resolve,reject);}
    };return q;},async rpc(name,args){
        calls.push({rpc:name,args});if(rpcFailure)return {data:null,error:{message:rpcFailure}};
        if(name==='claim_student_birthday_reward_v1'){
            tables.student_gamification_balances[0].points_balance=100;
            return {data:{enabled:true,is_birthday_month:true,gift_status:'received',gift_points:100},error:null};
        }
        return {data:{gift_points:args.p_gift_points,enabled:args.p_enabled,version:2},error:null};
    }};
    vm.runInNewContext(source,{Request,Response,URL,File,console:{error(){}},createClient:()=>admin,createRemoteJWKSet:()=>({}),
        jwtVerify:async()=>{if(!validToken)throw Error('invalid');return {payload:{sub:'mock-uid'}};},
        Deno:{env:{get:()=> 'isolated-placeholder'},serve:fn=>{handler=fn;}}});
    return {calls,call:body=>handler(new Request('https://isolated.invalid',{method:'POST',headers:{Authorization:'Bearer mock-token'},body:JSON.stringify(body)}))};
}
const settings={gift_points:100,enabled:true,version:1};
test('birthday summary uses authenticated DB identity and reads balance after gift settlement',async()=>{
    const run=harness();const response=await run.call({action:'summary',student_id:999,gift_points:9999,role:'admin'});
    assert.equal(response.status,200);const body=await response.json();assert.equal(body.balance.points_balance,100);assert.equal(body.birthday.xp_multiplier,2);
    assert.deepEqual(JSON.parse(JSON.stringify(run.calls.find(x=>x.rpc).args)),{p_student_id:7});
    assert.ok(run.calls.findIndex(x=>x.rpc)<run.calls.findIndex(x=>x.read==='student_gamification_balances'));
});
test('teachers and students spoofing admin cannot read or change birthday settings',async()=>{
    for(const role of ['student','teacher'])for(const action of ['admin_birthday_settings','admin_save_birthday_settings']){
        const run=harness({role});assert.equal((await run.call({action,settings,role:'admin',student_id:999})).status,403);
        assert.ok(!run.calls.some(x=>x.rpc||x.read==='birthday_reward_settings'));
    }
});
test('invalid Firebase token cannot reach birthday RPC or settings',async()=>{
    const run=harness({role:'admin',validToken:false});assert.equal((await run.call({action:'admin_save_birthday_settings',settings})).status,401);assert.equal(run.calls.length,0);
});
test('admin update uses authenticated actor and preserves bounded amount/version checks',async()=>{
    const run=harness({role:'admin'});assert.equal((await run.call({action:'admin_save_birthday_settings',settings,student_id:999})).status,200);
    assert.deepEqual(JSON.parse(JSON.stringify(run.calls.find(x=>x.rpc).args)),{p_admin_id:7,p_gift_points:100,p_enabled:true,p_expected_version:1});
    for(const invalid of [{...settings,gift_points:-1},{...settings,gift_points:10001},{...settings,gift_points:1.5},{...settings,gift_points:'100'},{...settings,version:0},{...settings,enabled:null}]){
        const request=harness({role:'admin'});assert.equal((await request.call({action:'admin_save_birthday_settings',settings:invalid})).status,400);assert.ok(!request.calls.some(x=>x.rpc));
    }
});
test('conflicting admin update returns actionable 409 without hiding it as success',async()=>{
    const run=harness({role:'admin',rpcFailure:'BIRTHDAY_SETTINGS_CHANGED'});const response=await run.call({action:'admin_save_birthday_settings',settings});
    assert.equal(response.status,409);assert.match((await response.json()).error,/重新讀取/);
});
test('staff summary never issues birthday gift; failed settlement is not reported as received',async()=>{
    const staff=harness({role:'teacher'});assert.equal((await staff.call({action:'summary'})).status,200);assert.ok(!staff.calls.some(x=>x.rpc));
    const failed=harness({rpcFailure:'isolated gift failure'});assert.equal((await failed.call({action:'summary'})).status,500);
    assert.ok(!failed.calls.some(x=>x.read==='student_gamification_balances'));
});