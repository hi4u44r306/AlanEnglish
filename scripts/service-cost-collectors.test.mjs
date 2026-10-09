import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectOpenAI, collectAzure, collectGoogle, collectResend, collectStripe, collectCloudflareWorkers, collectCloudflareR2, collectGitHub, costPeriod, costError } from '../supabase/functions/_shared/service-cost-collectors.ts';
const now = new Date('2026-10-07T04:00:00Z');
const response = body => new Response(JSON.stringify(body));
const io = (values, fetch) => ({ now, usdToTwd: 33, env: n => values[n], fetch });
test('Taiwan month boundary and future month validation', () => {
    assert.equal(costPeriod('2026-10', now).start, '2026-09-30T16:00:00.000Z');
    assert.equal(costPeriod('2026-09', now).end, '2026-09-30T16:00:00.000Z');
    assert.throws(() => costPeriod('2026-13', now)); assert.throws(() => costPeriod('2026-11', now));
});
test('OpenAI scopes projects and completes pagination; no local estimate added', async () => {
    const urls = [];
    const rows = await collectOpenAI('2026-10', io({ COST_OPENAI_PROJECT_IDS:'proj_site,proj_voice',COST_OPENAI_ADMIN_KEY:'mock' }, async url => {
        urls.push(new URL(url));
        return response({ data:[{results:[{amount:{value:urls.length,currency:'usd'}}]}],has_more:urls.length===1,next_page:'cursor' });
    }));
    assert.equal(rows[0].cost_usd,3); assert.deepEqual(urls[0].searchParams.getAll('project_ids[]'),['proj_site','proj_voice']);
    assert.equal(urls[1].searchParams.get('page'),'cursor');
});
test('incomplete billing pagination and unsupported currency fail rather than report zero', async () => {
    const config = { COST_OPENAI_PROJECT_IDS:'proj_site',COST_OPENAI_ADMIN_KEY:'mock' };
    await assert.rejects(collectOpenAI('2026-10',io(config,async()=>response({data:[],has_more:true,next_page:'x'}))), /incomplete_pagination/);
    await assert.rejects(collectOpenAI('2026-10',io(config,async()=>response({data:[{results:[{amount:{value:1,currency:'eur'}}]}],has_more:false}))), /unsupported_currency/);
    await assert.rejects(collectOpenAI('2026-10',io({},async()=>{throw new Error('should not call');})), /missing_configuration/);
});
test('Azure validates site resource group and reads columns by name, including TWD', async () => {
    const calls=[];
    const config={COST_AZURE_TENANT_ID:'tenant',COST_AZURE_SCOPE:'/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/site',COST_AZURE_CLIENT_ID:'mock',COST_AZURE_CLIENT_SECRET:'mock'};
    const rows=await collectAzure('2026-10',io(config,async(url,opts)=>{
        calls.push({url,opts}); return url.includes('login.microsoft')?response({access_token:'mock'}):response({properties:{columns:[{name:'Currency'},{name:'PreTaxCost'}],rows:[['TWD',330]],nextLink:null}});
    }));
    assert.equal(rows[0].cost_usd,10); assert.equal(JSON.parse(calls[1].opts.body).type,'ActualCost');
    await assert.rejects(collectAzure('2026-10',io({...config,COST_AZURE_SCOPE:'/subscriptions/00000000'},async()=>{})),/invalid_configuration/);
});
test('Azure refuses upstream pagination to an arbitrary host', async () => {
    const config={COST_AZURE_TENANT_ID:'tenant',COST_AZURE_SCOPE:'/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/site',COST_AZURE_CLIENT_ID:'mock',COST_AZURE_CLIENT_SECRET:'mock'};
    await assert.rejects(collectAzure('2026-10',io(config,async url=>url.includes('login.microsoft')?response({access_token:'mock'}):response({properties:{columns:[{name:'Currency'},{name:'Cost'}],rows:[],nextLink:'https://attacker.example/steal'}}))),/invalid_response/);
});
test('Resend reads real account quotas without inventing an invoice amount', async()=>{
    const rows=await collectResend('2026-10',io({RESEND_API_KEY:'mock'},async()=>response({emails:{daily:{used:90,limit:100,resets_at:'2026-10-08T00:00:00Z'},monthly:{used:2800,limit:3000,resets_at:'2026-11-01T00:00:00Z'}}})));
    assert.equal(rows[0].cost_usd,null);assert.equal(rows[0].metrics[1].used,2800);assert.equal(rows[0].metrics[1].limit,3000);
    await assert.rejects(collectResend('2026-09',io({},async()=>{})),/historical_usage_unavailable/);
});
test('Stripe test mode cannot contribute real costs; live fees exclude revenue and refunds principal', async()=>{
    let calls=0;
    await assert.rejects(collectStripe('2026-10',io({STRIPE_SECRET_KEY:'sk_test_mock'},async()=>{calls++;})),/test_mode_only/);assert.equal(calls,0);
    const rows=await collectStripe('2026-10',io({COST_STRIPE_READ_KEY:'rk_live_mock'},async()=>response({has_more:false,data:[{type:'charge',amount:100000,fee:300,currency:'usd'},{type:'refund',amount:-10000,fee:-10,currency:'usd'},{type:'stripe_fee',amount:-50,fee:0,currency:'usd'}]})));
    assert.equal(rows[0].cost_usd,3.4);
});
test('Cloudflare uses analytics and does not label usage or bytes as a bill',async()=>{
    const config={COST_CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),COST_CLOUDFLARE_READ_TOKEN:'mock',COST_CLOUDFLARE_WORKER_NAME:'alanenglish',COST_CLOUDFLARE_R2_BUCKET:'alanenglish-audio'};
    let workersPayload;const workers=await collectCloudflareWorkers('2026-10',io(config,async(_url,opts)=>{workersPayload=JSON.parse(opts.body);return response({data:{viewer:{accounts:[{workersInvocationsAdaptive:[{sum:{requests:12,errors:1}}]}]}}});}));
    let r2Payload;const r2=await collectCloudflareR2('2026-10',io(config,async(_url,opts)=>{r2Payload=JSON.parse(opts.body);return response({data:{viewer:{accounts:[{r2OperationsAdaptiveGroups:[{sum:{requests:10},dimensions:{actionType:'GetObject'}}]}]}}});}));
    assert.equal(workers[0].cost_usd,null);assert.equal(r2[0].metrics[0].used,10);assert.equal(workersPayload.variables.script,'alanenglish');assert.equal(r2Payload.variables.bucket,'alanenglish-audio');
    assert.doesNotMatch(workersPayload.query,/r2OperationsAdaptiveGroups/);assert.match(r2Payload.query,/r2OperationsAdaptiveGroups[^}]+datetime_leq:\$end/);assert.doesNotMatch(r2Payload.query,/r2StorageAdaptiveGroups/);
});
test('Cloudflare errors expose only safe diagnostic categories',async()=>{
    const env={COST_CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),COST_CLOUDFLARE_READ_TOKEN:'mock',COST_CLOUDFLARE_WORKER_NAME:'alanenglish',COST_CLOUDFLARE_R2_BUCKET:'alanenglish-audio'};
    await assert.rejects(collectCloudflareWorkers('2026-10',io(env,async()=>response({errors:[{message:'user does not have access to account secret-account'}]}))),/provider_auth_failed/);
    await assert.rejects(collectCloudflareWorkers('2026-10',io(env,async()=>response({errors:[{message:'Cannot query field hiddenField on type Account'}]}))),/provider_schema_failed/);
    assert.equal(costError(new Error('provider_auth_failed')),'provider_auth_failed');
    assert.equal(costError(new Error('secret-account token=hidden')),'collection_failed');
});
test('Cloudflare R2 reports an operations failure without upstream details',async()=>{
    const env={COST_CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),COST_CLOUDFLARE_READ_TOKEN:'mock',COST_CLOUDFLARE_R2_BUCKET:'alanenglish-audio'};
    await assert.rejects(collectCloudflareR2('2026-10',io(env,async()=>response({errors:[{message:'private upstream detail'}]}))),/provider_r2_operations_failed/);
    assert.equal(costError(new Error('provider_r2_operations_failed')),'provider_r2_operations_failed');
});

const cfConfig = { COST_CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32), COST_CLOUDFLARE_READ_TOKEN:'analytics-mock', COST_CLOUDFLARE_BILLING_READ_TOKEN:'billing-mock', COST_CLOUDFLARE_WORKER_NAME:'site', COST_CLOUDFLARE_R2_BUCKET:'audio' };
const cfCharge = (extra={}) => ({ BillingAccountId:'a'.repeat(32), BillingCurrency:'USD', ChargeCategory:'Usage', ServiceFamilyName:'R2', ServiceName:'R2 Storage', SubscriptionId:'subscription', BillingPeriodStart:'2026-09-21T00:00:00Z', ChargePeriodStart:'2026-10-01T00:00:00Z', ChargePeriodEnd:'2026-10-02T00:00:00Z', ContractedCost:0.25, CumulatedContractedCost:100, ConsumedQuantity:1.2, ConsumedUnit:'GB-months', PricingUnit:'GB-months', ...extra });
const cfIO = (charges, { covered=true, envelope={}, calls=[] }={}) => io(cfConfig, async (url, options) => {
    calls.push({url,options});
    if(url.endsWith('/graphql')) {
        assert.equal(options.headers.Authorization,'Bearer analytics-mock');
        return response({data:{viewer:{accounts:[{workersInvocationsAdaptive:[{sum:{requests:12}}],r2OperationsAdaptiveGroups:[{sum:{requests:10},dimensions:{actionType:'GetObject'}}]}]}}});
    }
    assert.equal(options.headers.Authorization,'Bearer billing-mock');
    if(url.endsWith('/info')) return response({success:true,result:{covered,subscriptions:[]}});
    return response({success:true,result:charges,...envelope});
});

test('Cloudflare billing includes the previous anchor, separates products and shares only this refresh',async()=>{
    const calls=[];
    const charges=[cfCharge(),cfCharge({ChargePeriodStart:'2026-10-02T00:00:00Z',ChargePeriodEnd:'2026-10-03T00:00:00Z',ContractedCost:-0.05}),cfCharge({ServiceFamilyName:'Workers',ServiceName:'Workers Standard',ContractedCost:2,ConsumedUnit:'requests'}),cfCharge({ServiceFamilyName:'D1',ContractedCost:500}),cfCharge({ChargePeriodStart:'2026-09-29T00:00:00Z',ChargePeriodEnd:'2026-09-30T00:00:00Z',ContractedCost:30})];
    const context=cfIO(charges,{calls});
    const [[r2],[workers]]=await Promise.all([collectCloudflareR2('2026-10',context),collectCloudflareWorkers('2026-10',context)]);
    assert.equal(r2.cost_usd,0.2);assert.equal(workers.cost_usd,2);assert.equal(r2.includes_fixed,false);assert.equal(r2.source,'billing');
    assert.equal(r2.period_start,'2026-10-01T00:00:00.000Z');assert.equal(r2.period_end,'2026-10-03T00:00:00.000Z');
    assert.equal(r2.metrics[0].used,10);assert.equal(r2.metrics[1].used,2.4);assert.match(r2.metrics[1].name,/帳戶計費用量/);
    const bills=calls.filter(x=>x.url.includes('billable-usage?'));assert.equal(bills.length,1);
    assert.equal(new URL(bills[0].url).searchParams.get('from'),'2026-09-01');
    assert.equal(new URL(bills[0].url).searchParams.get('to'),'2026-10-07');
    assert.equal(calls.filter(x=>x.url.endsWith('/info')).length,1);
    await collectCloudflareR2('2026-10',cfIO(charges,{calls}));
    assert.equal(calls.filter(x=>x.url.endsWith('/info')).length,2);
    assert.doesNotMatch(JSON.stringify(r2),/subscription|aaaaaaa|billing-mock/);
});

test('Cloudflare zero requires a real product row; empty or uncovered data remains unknown',async()=>{
    const [zero]=await collectCloudflareR2('2026-10',cfIO([cfCharge({ContractedCost:0})]));assert.equal(zero.cost_usd,0);
    await assert.rejects(collectCloudflareR2('2026-10',cfIO([])),/billing_usage_empty/);
    await assert.rejects(collectCloudflareWorkers('2026-10',cfIO([cfCharge()])),/billing_usage_empty/);
    await assert.rejects(collectCloudflareR2('2026-10',cfIO([],{covered:false})),/billing_coverage_unavailable/);
});

test('Cloudflare refuses wrong accounts, duplicate charges, partial pages and unsafe periods',async()=>{
    for(const [charges,options,error] of [
        [[cfCharge({BillingAccountId:'b'.repeat(32)})],{},'provider_account_failed'],
        [[cfCharge(),cfCharge()],{},'invalid_response'],
        [[cfCharge()],{envelope:{result_info:{total_count:2}}},'incomplete_pagination'],
        [[cfCharge({BillingCurrency:'EUR'})],{},'unsupported_currency'],
        [[cfCharge({ChargePeriodStart:'2026-09-30T00:00:00Z'})],{},'billing_period_mismatch'],
        [[cfCharge({ChargePeriodEnd:'2026-10-08T00:00:00Z'})],{},'billing_period_mismatch'],
        [[cfCharge({ChargePeriodStart:'bad-date'})],{},'invalid_response'],
        [[cfCharge()],{envelope:{success:false,errors:[{message:'sensitive provider detail'}]}},'provider_query_failed']
    ]) await assert.rejects(collectCloudflareR2('2026-10',cfIO(charges,options)),new RegExp(error));
    for(const code of ['billing_usage_empty','billing_coverage_unavailable','billing_period_mismatch']) assert.equal(costError(new Error(code)),code);
});

test('Cloudflare billing HTTP failure does not invent a new zero amount',async()=>{
    const context=cfIO([]);const original=context.fetch;
    context.fetch=async(url,options)=>url.endsWith('/info')?new Response('',{status:403}):original(url,options);
    await assert.rejects(collectCloudflareR2('2026-10',context),/provider_http_403/);
});
test('collection errors reveal no raw tokens or response bodies',()=>{
    assert.equal(costError(new Error('token=secret PII response')),'collection_failed');
    assert.equal(costError(new Error('provider_http_403')),'provider_http_403');
});
test('GitHub queries only this repository and separates usage charges from plan fees',async()=>{
    let url;
    const rows=await collectGitHub('2026-10',io({COST_GITHUB_BILLING_OWNER:'owner',COST_GITHUB_BILLING_KIND:'user',COST_GITHUB_REPOSITORY:'owner/site',COST_GITHUB_BILLING_READ_TOKEN:'mock'},async u=>{url=new URL(u);return response({usageItems:[{product:'Actions',sku:'actions_linux',grossQuantity:1000,unitType:'minutes',netAmount:0.8}]});}));
    assert.equal(url.searchParams.get('repository'),'owner/site');assert.equal(url.searchParams.get('month'),'10');assert.equal(rows[0].cost_usd,0.8);assert.equal(rows[0].includes_fixed,false);
});

// A generated test key proves the actual JWT signing and BigQuery request; no provider keys used.
async function googleIO(fetch) {
    const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
    const der=new Uint8Array(await crypto.subtle.exportKey('pkcs8',key.privateKey));
    const pem=`-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----`;
    return io({COST_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'test@example.com',private_key:pem}),COST_GOOGLE_BILLING_TABLE:'test.billing.gcp_export',COST_GOOGLE_QUERY_PROJECT:'test',COST_GOOGLE_PROJECT_IDS:'site,site-auth',COST_GOOGLE_BIGQUERY_LOCATION:'US'},fetch);
}
test('Google separates TTS, Firebase and all other website costs, with bounded query bytes',async()=>{
    let payload;
    const rows=await collectGoogle('2026-10',await googleIO(async(url,opts)=>{
        if(url.includes('oauth2')) return response({access_token:'mock'});
        payload=JSON.parse(opts.body);return response({jobComplete:true,schema:{fields:[{name:'service'},{name:'currency'},{name:'net_cost'}]},rows:[{f:[{v:'Cloud Text-to-Speech'},{v:'USD'},{v:'2'}]},{f:[{v:'Identity Platform'},{v:'USD'},{v:'1'}]},{f:[{v:'BigQuery'},{v:'USD'},{v:'0.1'}]}]});
    }));
    assert.deepEqual(rows.map(x=>[x.provider_id,x.cost_usd]),[['google_tts',2],['firebase',1],['google_other',0.1]]);
    assert.equal(payload.maximumBytesBilled,'1000000000');assert.match(payload.query,/UNNEST\(credits\)/);assert.deepEqual(payload.queryParameters[2].parameterValue.arrayValues,[{value:'site'},{value:'site-auth'}]);
});
test('Google empty export and incomplete query are visible gaps, never free-service claims',async()=>{
    await assert.rejects(collectGoogle('2026-10',await googleIO(async url=>url.includes('oauth2')?response({access_token:'mock'}):response({jobComplete:true,rows:[],schema:{fields:[]}}))),/billing_export_empty/);
    await assert.rejects(collectGoogle('2026-10',await googleIO(async url=>url.includes('oauth2')?response({access_token:'mock'}):response({jobComplete:false}))),/incomplete_query/);
});
