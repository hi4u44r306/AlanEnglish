import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costPopulation, refreshServiceCosts } from '../supabase/functions/_shared/service-cost-dashboard.ts';

test('counts only enabled students with exact HEAD and returns no profiles', async () => {
    const calls = [];
    const query = { select: (...args) => { calls.push(args); return query; }, eq: (...args) => { calls.push(args); return query; },
        then: resolve => resolve({ count: 45, data: null, error: null }) };
    const result = await costPopulation({ from: table => { assert.equal(table, 'students'); return query; } });
    assert.equal(result.active_students, 45);
    assert.deepEqual(calls, [['id', { count: 'exact', head: true }], ['role', 'student'], ['account_status', 'active']]);
    assert.deepEqual(Object.keys(result).sort(), ['active_students', 'counted_at']);
});
test('errors and missing count are unavailable, while a true zero count remains zero', async () => {
    for (const count of [null, undefined, 0]) {
        const q = { select: () => q, eq: () => q, then: resolve => resolve({ count, error: null }) };
        const result = await costPopulation({ from: () => q });
        assert.equal(result.active_students, count === 0 ? 0 : null);
    }
    assert.equal((await costPopulation({ from: () => { throw new Error('private provider failure'); } })).error, 'population_unavailable');
});

test('failed Cloudflare billing refresh updates analytics but preserves previous bill and success time', async () => {
    const updates=[];
    const context={now:new Date('2026-10-07T04:00:00Z'),usdToTwd:33,env:name=>({COST_CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),COST_CLOUDFLARE_READ_TOKEN:'analytics',COST_CLOUDFLARE_BILLING_READ_TOKEN:'billing',COST_CLOUDFLARE_R2_BUCKET:'site-audio'})[name],
        fetch:async url=>url.endsWith('/graphql')?new Response(JSON.stringify({data:{viewer:{accounts:[{r2OperationsAdaptiveGroups:[{sum:{requests:99},dimensions:{actionType:'GetObject'}}]}]}}})):new Response('',{status:403})};
    const query={eq:()=>query,then:resolve=>resolve({error:null})};
    const read={eq:()=>read,single:async()=>({data:{metrics:[{name:'R2 GetObject',used:1},{name:'帳戶計費用量：R2 Storage',used:3}]},error:null})};
    const admin={rpc:async(_name,args)=>({data:args.p_providers.includes('cloudflare_r2')?[{provider_id:'cloudflare_r2',month:'2026-10-01',claim_token:'lease'}]:[],error:null}),
        from:table=>{assert.equal(table,'cost_service_snapshots');return {select:()=>read,update:patch=>{updates.push(patch);return query;}};}};
    await refreshServiceCosts(admin,'2026-10',context);
    assert.equal(updates.length,1);assert.equal(updates[0].error_code,'provider_http_403');
    for(const key of ['cost_usd','source','includes_fixed','collected_at','period_start','period_end']) assert.equal(Object.hasOwn(updates[0],key),false);
    assert.deepEqual(updates[0].metrics,[{name:'R2 GetObject',used:99,unit:'次',limit:null},{name:'帳戶計費用量：R2 Storage',used:3}]);
    assert.equal(updates[0].claim_token,null);assert.equal(updates[0].next_refresh_at,'2026-10-07T04:15:00.000Z');
});
