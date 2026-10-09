import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
const source=stripTypeScriptTypes(readFileSync(new URL("../supabase/functions/membership-manager/index.ts",import.meta.url),"utf8").replace(/^import[\s\S]*?;\r?\n/gm,""));
const payload={student_id:2,expected_date_of_birth:"2016-03-02",date_of_birth:"2016-10-02",reason:"測試帳號生日更正"};
function harness({role="admin",validToken=true,rpcError=null,archived=false,targetRole="student"}={}) {
    let handler;const calls=[];
    const tables={students:[{id:7,firebase_uid:"fixture-uid",role,account_status:archived?"archived":"active"},
        {id:2,role:targetRole,date_of_birth:"2016-03-02",name:"Fixture Student"}],admin_birth_date_corrections:[{id:1,admin_id:7,reason:"Fixture reason"}]};
    const admin={from(table){const filters=[];let one=false;const q={
        select(){calls.push({read:table});return q;},eq(key,value){filters.push(item=>item[key]===value);return q;},
        order(key,options){calls.push({order:key,options});return q;},limit(n){calls.push({limit:n});return q;},maybeSingle(){one=true;return q;},
        then(resolve,reject){const rows=(tables[table]||[]).filter(item=>filters.every(fn=>fn(item)));
            return Promise.resolve({data:one?rows[0]||null:rows,error:null}).then(resolve,reject);}
    };return q;},async rpc(name,args){calls.push({rpc:name,args});if(rpcError)return {data:null,error:{message:rpcError}};
        return {data:{student:{id:args.p_student_id,date_of_birth:args.p_date_of_birth},history_entry:{id:1,admin_id:args.p_admin_id}},error:null};}};
    vm.runInNewContext(source,{Request,Response,URL,TextEncoder,console:{error(){}},createClient:()=>admin,createRemoteJWKSet:()=>({}),
        jwtVerify:async()=>{if(!validToken)throw Error("invalid");return {payload:{sub:"fixture-uid"}};},
        Deno:{env:{get:()=>"isolated-placeholder"},serve:fn=>{handler=fn;}}});
    return {calls,call:(body,token=true)=>handler(new Request("https://isolated.invalid",{method:"POST",headers:token?{Authorization:"Bearer fixture"}:{},body:JSON.stringify(body)}))};
}
test("correction takes the authenticated administrator ID and exact expected birthday",async()=>{
    const run=harness();const response=await run.call({action:"admin_correct_birth_date",...payload,admin_id:999,role:"admin"});
    assert.equal(response.status,200);assert.equal((await response.json()).student.date_of_birth,payload.date_of_birth);
    assert.deepEqual(JSON.parse(JSON.stringify(run.calls.find(call=>call.rpc).args)),{p_admin_id:7,p_student_id:2,p_expected_date_of_birth:payload.expected_date_of_birth,p_date_of_birth:payload.date_of_birth,p_reason:payload.reason});
});
test("student and teacher impersonation cannot read history or call correction",async()=>{
    for(const role of ["student","teacher"])for(const action of ["admin_correct_birth_date","admin_birth_date_history"]){
        const run=harness({role});assert.equal((await run.call({action,...payload,role:"admin",admin_id:7})).status,403);
        assert.ok(!run.calls.some(call=>call.rpc||call.read==="admin_birth_date_corrections"));
    }
});
test("missing/invalid Firebase token and archived admin are rejected",async()=>{
    const missing=harness();assert.equal((await missing.call({action:"admin_correct_birth_date",...payload},false)).status,401);assert.equal(missing.calls.length,0);
    const invalid=harness({validToken:false});assert.equal((await invalid.call({action:"admin_correct_birth_date",...payload})).status,401);assert.equal(invalid.calls.length,0);
    const archived=harness({archived:true});assert.equal((await archived.call({action:"admin_correct_birth_date",...payload})).status,403);assert.ok(!archived.calls.some(call=>call.rpc));
});
test("invalid date, reason, target and missing expected date never reach RPC",async()=>{
    const missingExpected={...payload};delete missingExpected.expected_date_of_birth;
    for(const bad of [missingExpected,{...payload,date_of_birth:"2016-02-30"},{...payload,date_of_birth:"2099-01-01"},{...payload,date_of_birth:"2016-10-02extra"},
        {...payload,expected_date_of_birth:"bad"},{...payload,reason:" "},{...payload,reason:"x".repeat(501)},{...payload,student_id:"2"},{...payload,student_id:0}]){
        const run=harness();assert.equal((await run.call({action:"admin_correct_birth_date",...bad})).status,400);assert.ok(!run.calls.some(call=>call.rpc));
    }
});
test("a null previous birthday is explicitly supported for admin first registration",async()=>{
    const run=harness();assert.equal((await run.call({action:"admin_correct_birth_date",...payload,expected_date_of_birth:null})).status,200);
    assert.equal(run.calls.find(call=>call.rpc).args.p_expected_date_of_birth,null);
});
test("conflict, revoked admin and missing target remain actionable errors",async()=>{
    for(const [message,status] of [["BIRTH_DATE_CHANGED",409],["ADMIN_REQUIRED",403],["STUDENT_NOT_FOUND",404],["BIRTH_DATE_UNCHANGED",400]]){
        const run=harness({rpcError:message});const response=await run.call({action:"admin_correct_birth_date",...payload});assert.equal(response.status,status);assert.equal((await response.json()).code,message);
    }
});
test("unexpected database failure is not exposed or reported as saved",async()=>{
    const run=harness({rpcError:"raw-private-fixture"});const response=await run.call({action:"admin_correct_birth_date",...payload});assert.equal(response.status,500);
    assert.doesNotMatch(JSON.stringify(await response.json()),/raw-private-fixture|success/);
});
test("history is admin-only, bounded to 20 and rejects staff targets",async()=>{
    const run=harness();const response=await run.call({action:"admin_birth_date_history",student_id:2});assert.equal(response.status,200);
    assert.equal((await response.json()).student.date_of_birth,payload.expected_date_of_birth);assert.ok(run.calls.some(call=>call.limit===20));
    assert.equal((await harness({targetRole:"teacher"}).call({action:"admin_birth_date_history",student_id:2})).status,404);
});
