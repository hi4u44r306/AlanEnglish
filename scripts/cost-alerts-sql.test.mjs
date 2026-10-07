// Real PostgreSQL state transitions + real request/delivery code, isolated from all providers.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { handleCostAlertRequest } from "../supabase/functions/_shared/cost-alert-handler.ts";
import { costAlertMessage, deliverCostAlerts } from "../supabase/functions/_shared/cost-alert-email.ts";
import { refreshServiceCosts } from '../supabase/functions/_shared/service-cost-dashboard.ts';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const unifiedMigration = readFileSync(new URL('../supabase/migrations/20261007041718_unified_service_costs.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL("../supabase/migrations/20261007024653_cost_alert_acknowledgement.sql", import.meta.url), "utf8");
// PostgREST serializes dates as strings; reproduce that boundary for request tests.
const query = async (sql, values = []) => (await db.query(sql, values)).rows.map(row =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])));
const reconcile = () => db.query("select public.reconcile_api_cost_alert_v1()");
const alerts = () => query("select * from public.api_cost_alerts order by month");
const claim = () => query("select * from public.claim_api_cost_alerts_v1()");
const ack = async (a, owner = 1) => (await query("select public.acknowledge_api_cost_alert_v1($1,$2,$3) result", [a.id, owner, a.generation]))[0].result;
const spend = cost => db.query("insert into ai_api_usage_logs(estimated_cost_usd,created_at) values($1,now())", [cost]);

before(async () => {
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create table students(id bigint primary key,role text,account_status text,email text);
        create table ai_api_budget_settings(id smallint primary key,monthly_budget_usd numeric,warning_percent int,usd_to_twd_rate numeric);
        create table ai_api_usage_logs(estimated_cost_usd numeric,created_at timestamptz);
        create table speaking_generation_jobs(input_tokens bigint,output_tokens bigint,created_at timestamptz);
        create table speaking_source_chunks(input_tokens bigint,output_tokens bigint,created_at timestamptz);
        create table speaking_tts_assets(used_characters bigint,created_at timestamptz);
        create table speaking_pronunciation_requests(audio_seconds numeric,interaction_type text,status text,created_at timestamptz,provider text default 'azure');
        create table guardian_email_settings(id smallint primary key,from_email text,from_name text,reply_to text);
        create schema vault; create table vault.secrets(name text); create table vault.decrypted_secrets(name text,decrypted_secret text);
        insert into vault.secrets values('guardian_email_project_url'),('guardian_email_cron_secret');
        create schema cron; create table cron.test_jobs(name text,schedule text,command text);
        create function cron.schedule(text,text,text) returns bigint language sql as $f$
          insert into cron.test_jobs values($1,$2,$3) returning 1::bigint;
        $f$;
    `);
    await db.exec(migration); await db.exec(unifiedMigration);
});
after(() => db.close());
beforeEach(async () => {
    await db.exec(`truncate api_cost_alerts,api_cost_notification_settings,students,ai_api_budget_settings,
      ai_api_usage_logs,speaking_generation_jobs,speaking_source_chunks,speaking_tts_assets,speaking_pronunciation_requests,guardian_email_settings,cost_service_snapshots,cost_service_fixed_fees cascade;
      update cost_service_settings set fixed_monthly_usd=null,enabled=true;
      insert into students values(1,'admin','active','owner@example.com'),(2,'admin','active','other@example.com'),(3,'student','active','student@example.com');
      insert into ai_api_budget_settings values(1,10,80,33);
      insert into api_cost_notification_settings(id,recipient_student_id) values(1,1);
      insert into guardian_email_settings values(1,'sender@example.com','Alan English',null);`);
});

test("registers an independent five-minute cron and leaves the existing hourly schedule alone", async () => {
    const [job] = await query("select * from cron.test_jobs");
    assert.equal(job.schedule, "*/5 * * * *");
    assert.match(job.command, /cost-alert-manager/);
    assert.match(job.command, /vault\.decrypted_secrets/);
    assert.doesNotMatch(migration, /cron\.unschedule/);
});
test("below the exact warning boundary never alerts; reaching the line does", async () => {
    await spend(7.999999); await reconcile(); assert.equal((await alerts()).length, 0);
    await spend(0.000001); await reconcile(); assert.equal((await alerts())[0].level, "warning");
});
test("uses all four tracked sources and excludes previous/future Taiwan months", async () => {
    await spend(1);
    await db.exec(`insert into speaking_generation_jobs values(4000000,500000,now());
      insert into speaking_source_chunks values(4000000,500000,now());
      insert into speaking_tts_assets values(100000,now());
      insert into ai_api_usage_logs values(100, date_trunc('month',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei' - interval '1 second'),
      (100,(date_trunc('month',now() at time zone 'Asia/Taipei')+interval '1 month') at time zone 'Asia/Taipei');`);
    await reconcile(); assert.equal(Number((await alerts())[0].cost_usd), 8);
});
test("overlapping workers cannot claim the same alert twice in one slot; next slot retries", async () => {
    await spend(8); await reconcile();
    const claims = await Promise.all([claim(), claim()]);
    assert.equal(claims.flat().length, 1);
    await db.exec("update api_cost_alerts set next_attempt_at=now()-interval '1 second'");
    const [next] = await claim(); assert.equal(next.attempt_count, 2);
    assert.notEqual(next.delivery_token, claims.flat()[0].delivery_token);
});
test("only explicit acknowledgement stops reminders and remains stopped after refresh or cost growth", async () => {
    await spend(8); await reconcile(); const [a] = await alerts();
    await reconcile(); assert.equal((await claim()).length, 1);
    assert.equal(await ack(a), true);
    await spend(1); await reconcile();
    assert.equal((await claim()).length, 0); assert.ok((await alerts())[0].acknowledged_at);
    assert.equal(await ack(a), true);
});
test("reaching 100 percent after acknowledgement remains silent for the same month", async () => {
    await spend(8); await reconcile(); const [old] = await alerts(); await ack(old);
    await spend(2); await reconcile(); const [current] = await alerts();
    assert.equal(current.level, "critical"); assert.equal(current.generation, old.generation);
    assert.ok(current.acknowledged_at); assert.equal(await ack(old), true);
    assert.equal((await claim()).length, 0);
});
test("a new month gets its own event while an older unacknowledged event remains pending", async () => {
    await spend(8); await reconcile();
    await db.exec("update api_cost_alerts set month=(month-interval '1 month')::date");
    await reconcile(); assert.equal((await alerts()).length, 2); assert.equal((await claim()).length, 2);
});
test("unknown budget or tracking source fails closed instead of reporting zero", async () => {
    await db.exec("delete from ai_api_budget_settings"); await assert.rejects(reconcile(), /Cost budget unavailable/);
});
test("disabled/non-admin recipients receive nothing and cannot acknowledge", async () => {
    await spend(8); await reconcile(); const [a] = await alerts();
    await db.exec("update students set account_status='disabled' where id=1");
    assert.equal((await claim()).length, 0); assert.equal(await ack(a), false);
    assert.equal(await ack(a, 2), false); assert.equal(await ack(a, 3), false);
});
test("anonymous and authenticated database roles cannot read tables or call privileged RPCs", async () => {
    const secured = await query("select relrowsecurity from pg_class where oid in ('api_cost_alerts'::regclass,'api_cost_notification_settings'::regclass)");
    assert.ok(secured.every(row => row.relrowsecurity));
    for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        for (const sql of ["select * from api_cost_alerts", "select * from api_cost_notification_settings", "select reconcile_api_cost_alert_v1()", "select * from claim_api_cost_alerts_v1()"])
            await assert.rejects(db.query(sql), /permission denied/);
        await db.exec("reset role");
    }
});

// Minimal Supabase-compatible adapter executes queries on the real isolated DB.
class Builder {
    constructor(table) { this.table = table; this.conditions = []; this.values = []; this.columns = "*"; }
    select(columns) { this.columns = columns; this.returning = true; return this; }
    update(values) { this.updateValues = values; return this; }
    eq(key, value) { this.values.push(value); this.conditions.push(`${key}=$${this.values.length}`); return this; }
    is(key) { this.conditions.push(`${key} is null`); return this; }
    or(condition) { const id = Number(condition.split(".eq.")[1]); this.values.push(id); this.conditions.push(`(recipient_student_id is null or recipient_student_id=$${this.values.length})`); return this; }
    order(column, opts) { this.sort = `${column} ${opts.ascending ? "asc" : "desc"}`; return this; }
    limit(limit) { this.max = limit; return this; }
    maybeSingle() { this.singleResult = true; return this; }
    single() { this.singleResult = true; return this; }
    async execute() {
        try {
            const values = [...this.values];
            const assignments = Object.entries(this.updateValues || {}).map(([k,v]) => { values.push(k==='metrics' ? JSON.stringify(v) : v); return `${k}=$${values.length}`; });
            const where = this.conditions.length ? ` where ${this.conditions.join(" and ")}` : "";
            const sql = this.updateValues ? `update ${this.table} set ${assignments.join(",")}${where}${this.returning ? ` returning ${this.columns}` : ""}` :
                `select ${this.columns} from ${this.table}${where}${this.sort ? ` order by ${this.sort}` : ""}${this.max ? ` limit ${this.max}` : ""}`;
            const rows = await query(sql, values);
            return { data: this.singleResult ? rows[0] || null : rows, error: null };
        } catch (error) { return { data: null, error }; }
    }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
}
const admin = {
    from: table => new Builder(table),
    rpc: async (name, params = {}) => {
        if (name === "verify_guardian_cron_secret") return { data: params.p_secret === "test-cron", error: null };
        try {
            if (name === "claim_api_cost_alerts_v1") return { data: await claim(), error: null };
            if (name === 'claim_cost_service_refresh_v1') return { data: await query('select * from claim_cost_service_refresh_v1($1,$2)', [params.p_month,params.p_providers]), error: null };
            if (name === 'unified_cost_month_v1') return { data: (await query('select unified_cost_month_v1($1) result',[params.p_month]))[0].result,error:null };
            if (name === 'save_cost_service_v1') return { data: await query('select save_cost_service_v1($1,$2,$3,$4,$5)',[params.p_provider,params.p_month,params.p_fixed,params.p_total,params.p_enabled]),error:null };
            if (name === "reconcile_api_cost_alert_v1") { await reconcile(); return { data: null, error: null }; }
            return { data: (await query("select public.acknowledge_api_cost_alert_v1($1,$2,$3) result", [params.p_alert_id, params.p_student_id, params.p_generation]))[0].result, error: null };
        } catch (error) { return { data: null, error }; }
    }
};
let sends;
let providerStatus;
const makeRequest = (body, options = {}) => handleCostAlertRequest(new Request("https://isolated.example/cost-alert-manager", {
    method: "POST", headers: options.secret ? { "x-cron-secret": options.secret } : {}, body: JSON.stringify(body)
}), {
    admin,
    verifyUser: async () => {
        if (options.unauthenticated) throw Object.assign(new Error("請先登入"), { status: 401 });
        return { id: options.owner || 1, role: options.role || "admin", email: options.email || "owner@example.com" };
    },
    env: name => name === "RESEND_API_KEY" && !options.noProvider ? "isolated-test-key" : name === "COST_ALERTS_ENABLED" && options.paused ? "false" : undefined,
    fetch: async (_url, options) => { if (_url.endsWith('/usage')) return new Response('{}',{status:403}); sends.push({ body: JSON.parse(options.body), headers: options.headers }); return new Response(JSON.stringify({ id: "fake-provider-id" }), { status: providerStatus }); }
});
beforeEach(() => { sends = []; providerStatus = 200; });
test("background cron sends without a login and deduplicates; acknowledging stops later sends", async () => {
    await db.exec("update guardian_email_settings set reply_to='support@example.com'");
    await spend(8);
    let response = await makeRequest({ action: "run_due" }, { secret: "test-cron", unauthenticated: true });
    assert.equal(response.status, 200); assert.equal(sends.length, 1);
    assert.deepEqual(sends[0].body.to, ["owner@example.com"]); assert.match(sends[0].body.text, /我已經看到/);
    assert.equal(sends[0].body.reply_to, "support@example.com");
    assert.match(sends[0].headers["Idempotency-Key"], /^api-cost-/);
    await makeRequest({ action: "run_due" }, { secret: "test-cron" }); assert.equal(sends.length, 1);
    const [a] = await alerts(); response = await makeRequest({ action: "acknowledge", alert_id: a.id, generation: a.generation });
    assert.equal(response.status, 200);
    await db.exec("update api_cost_alerts set next_attempt_at=now()-interval '1 second'");
    await makeRequest({ action: "run_due" }, { secret: "test-cron" }); assert.equal(sends.length, 1);
});
test("status never acknowledges or sends; another admin cannot spoof the alert owner", async () => {
    await spend(8); await makeRequest({ action: "status" }); const [a] = await alerts();
    assert.equal(a.acknowledged_at, null); assert.equal(sends.length, 0);
    const response = await makeRequest({ action: "acknowledge", alert_id: a.id, generation: a.generation, student_id: 1 }, { owner: 2 });
    assert.equal(response.status, 409); assert.equal((await alerts())[0].acknowledged_at, null);
});
test("subscribe uses verified admin email/id and cannot replace an existing recipient", async () => {
    await db.exec("update api_cost_notification_settings set recipient_student_id=null");
    assert.equal((await makeRequest({ action: "subscribe", student_id: 3, email: "spoof@example.com" })).status, 200);
    assert.equal(Number((await query("select recipient_student_id from api_cost_notification_settings"))[0].recipient_student_id), 1);
    assert.equal((await makeRequest({ action: "subscribe" }, { owner: 2 })).status, 409);
});
test("unauthenticated users, teachers and invalid cron credentials are rejected before sending", async () => {
    assert.equal((await makeRequest({ action: "status" }, { unauthenticated: true })).status, 401);
    assert.equal((await makeRequest({ action: "subscribe" }, { role: "teacher" })).status, 403);
    assert.equal((await makeRequest({ action: "run_due" })).status, 401);
    assert.equal((await makeRequest({ action: "run_due" }, { secret: "wrong" })).status, 403);
    assert.equal(sends.length, 0);
});
test("provider failure is recorded safely, retried next slot and never acknowledged automatically", async () => {
    await spend(8); providerStatus = 429;
    const response = await makeRequest({ action: "run_due" }, { secret: "test-cron" });
    assert.equal((await response.json()).failed, 1); const [a] = await alerts();
    assert.equal(a.last_error, "provider_http_429"); assert.equal(a.acknowledged_at, null); assert.equal(a.last_sent_at, null);
    await db.exec("update api_cost_alerts set next_attempt_at=now()-interval '1 second'"); providerStatus = 200;
    await makeRequest({ action: "run_due" }, { secret: "test-cron" });
    assert.equal(sends.length, 2); assert.ok((await alerts())[0].last_sent_at); assert.equal((await alerts())[0].last_error, null);
});
test("missing provider is visible and leaves pending state; kill switch prevents any sending", async () => {
    await spend(8);
    assert.equal((await makeRequest({ action: "run_due" }, { secret: "test-cron", noProvider: true })).status, 503);
    assert.equal((await alerts())[0].attempt_count, 0);
    const status = await (await makeRequest({ action: "status" }, { noProvider: true })).json();
    assert.equal(status.notification.delivery_configured, false);
    assert.equal((await makeRequest({ action: "run_due" }, { secret: "test-cron", paused: true })).status, 200);
    assert.equal(sends.length, 0);
});
test("acknowledgement occurring before provider submission cancels the claimed delivery", async () => {
    let sent = false;
    const result = await deliverCostAlerts([{ month: "2026-10-01", level: "warning", cost_usd: 8, monthly_budget_usd: 10, warning_percent: 80 }], {
        recipient: async () => "owner@example.com", isPending: async () => false,
        send: async () => { sent = true; return "x"; }, finish: async () => { throw new Error("should not finish"); }
    });
    assert.equal(sent, false); assert.equal(result.sent, 0);
});
test("email message calls costs estimates and explains the exact stopping action", () => {
    const message = costAlertMessage({ month: "2026-10-01", level: "critical", cost_usd: 10, monthly_budget_usd: 10, warning_percent: 80 });
    assert.match(message.subject, /已達月預算/); assert.match(message.text, /估算/); assert.match(message.text, /每 5 分鐘/);
    assert.match(message.text, /缺少資料/); assert.match(message.text, /admin\/api-usage/);
});

const month = () => query("select date_trunc('month',now() at time zone 'Asia/Taipei')::date::text as value").then(rows=>rows[0].value);
const unified = async () => (await query('select unified_cost_month_v1($1) result',[await month()]))[0].result;
test('unified total includes fixed plans, replaces matching estimates and never adds fees twice',async()=>{
    await spend(2);
    await db.exec("insert into cost_service_fixed_fees values('supabase',date_trunc('month',now() at time zone 'Asia/Taipei')::date,25),('openai',date_trunc('month',now() at time zone 'Asia/Taipei')::date,1)");
    assert.equal(Number((await unified()).total_cost_usd),28);
    await db.query("insert into cost_service_snapshots(provider_id,month,cost_usd,source) values('openai',$1,4,'billing')",[await month()]);
    assert.equal(Number((await unified()).total_cost_usd),29);
    await reconcile(); assert.equal(Number((await alerts())[0].cost_usd),29);
});
test('unknown providers have gaps, and local aggregate is not presented as complete billing',async()=>{
    const result=await unified(); const azure=result.providers.find(x=>x.provider_id==='azure');
    assert.equal(azure.reported_cost_usd,null);assert.equal(azure.incomplete,true);
    assert.equal(result.providers.find(x=>x.provider_id==='openai').incomplete,true);
});
test('snapshot leases stop overlap and manual override cancels an in-flight refresh',async()=>{
    const p={p_month:await month(),p_providers:['openai']};
    const first=await admin.rpc('claim_cost_service_refresh_v1',p);assert.equal(first.data.length,1);
    assert.equal((await admin.rpc('claim_cost_service_refresh_v1',p)).data.length,0);
    const m=await month();await db.query("select save_cost_service_v1('openai',$1,null,10,true)",[m]);
    await db.query("update cost_service_snapshots set cost_usd=2 where provider_id='openai' and month=$1 and claim_token=$2",[m,first.data[0].claim_token]);
    assert.equal(Number((await unified()).total_cost_usd),10);
    await db.query("update cost_service_snapshots set next_refresh_at=now()-interval '1 minute'");
    assert.equal((await admin.rpc('claim_cost_service_refresh_v1',p)).data.length,0);
});
test('manual complete amount can resume automatic tracking, disabled services are excluded',async()=>{
    const m=await month();await db.query("select save_cost_service_v1('azure',$1,null,12,true)",[m]);
    assert.equal(Number((await unified()).total_cost_usd),12);
    await db.query("select save_cost_service_v1('azure',$1,null,12,false)",[m]);assert.equal(Number((await unified()).total_cost_usd),0);
    await db.query("select save_cost_service_v1('azure',$1,null,null,true)",[m]);assert.equal((await unified()).providers.find(x=>x.provider_id==='azure').reported_cost_usd,null);
});
test('fee history prevents changing a previous month when a plan changes',async()=>{
    const m=await month();await db.query("insert into cost_service_fixed_fees values('supabase',($1::date-interval '1 month')::date,25)",[m]);
    await db.query("select save_cost_service_v1('supabase',$1,30,null,true)",[m]);
    const previous=(await query("select unified_cost_month_v1(($1::date-interval '1 month')::date) result",[m]))[0].result;
    assert.equal(Number(previous.total_cost_usd),25);assert.equal(Number((await unified()).total_cost_usd),30);
});
test('unified dashboard and service settings require a verified administrator',async()=>{
    const m=(await month()).slice(0,7);
    assert.equal((await makeRequest({action:'dashboard',month:m},{role:'student'})).status,403);
    assert.equal((await makeRequest({action:'save_service',month:m,provider_id:'azure',fixed_monthly_usd:1,month_total_usd:null,enabled:true},{unauthenticated:true})).status,401);
    const response=await makeRequest({action:'dashboard',month:m});assert.equal(response.status,200);
    const body=await response.json();assert.equal(body.providers.length,14);assert.ok(body.summary.incomplete_services>0);
    assert.equal((await makeRequest({action:'save_service',month:m,provider_id:'azure',fixed_monthly_usd:-1,month_total_usd:null,enabled:true})).status,400);
});
test('all new tables and aggregation/settings/refresh RPCs reject public database roles',async()=>{
    for(const role of ['anon','authenticated']){
        await db.exec(`set role ${role}`);
        for(const table of ['cost_service_settings','cost_service_snapshots','cost_service_fixed_fees'])await assert.rejects(db.query(`select * from ${table}`),/permission denied/);
        await assert.rejects(db.query("select unified_cost_month_v1('2026-10-01')"),/permission denied/);
        await assert.rejects(db.query("select save_cost_service_v1('azure','2026-10-01',null,null,true)"),/permission denied/);
        await assert.rejects(db.query("select claim_cost_service_refresh_v1('2026-10-01',array['azure'])"),/permission denied/);
        await db.exec('reset role');
    }
});
test('collector success persists one snapshot, failure keeps the last amount/time and retries later',async()=>{
    const m=(await month()).slice(0,7);const now=new Date();let calls=0;
    const values={COST_OPENAI_PROJECT_IDS:'proj_site',COST_OPENAI_ADMIN_KEY:'mock'};
    await refreshServiceCosts(admin,m,{now,usdToTwd:33,env:n=>values[n],fetch:async()=>{calls++;return new Response(JSON.stringify({data:[{results:[{amount:{value:5,currency:'usd'}}]}],has_more:false}));}});
    assert.equal(calls,1);let row=(await query("select * from cost_service_snapshots where provider_id='openai'"))[0];
    assert.equal(Number(row.cost_usd),5);assert.equal(row.error_code,null);const collected=row.collected_at;
    await db.exec("update cost_service_snapshots set next_refresh_at=now()-interval '1 second'");
    await refreshServiceCosts(admin,m,{now,usdToTwd:33,env:n=>values[n],fetch:async()=>new Response('private upstream text',{status:403})});
    row=(await query("select * from cost_service_snapshots where provider_id='openai'"))[0];assert.equal(Number(row.cost_usd),5);assert.equal(row.collected_at,collected);assert.equal(row.error_code,'provider_http_403');
});
test('usage-only billing adds its separate fixed plan, complete invoices do not',async()=>{
    const m=await month();await db.query("insert into cost_service_fixed_fees values('github',$1,4)",[m]);
    await db.query("insert into cost_service_snapshots(provider_id,month,cost_usd,source,includes_fixed) values('github',$1,1,'billing',false)",[m]);
    assert.equal(Number((await unified()).total_cost_usd),5);
    await db.query("select save_cost_service_v1('github',$1,4,3,true)",[m]);assert.equal(Number((await unified()).total_cost_usd),3);
});
test('net provider credits are retained and monitoring pause does not call providers',async()=>{
    const m=await month();await spend(2);await db.query("insert into cost_service_snapshots(provider_id,month,cost_usd,source) values('google_other',$1,-3,'billing')",[m]);
    assert.equal(Number((await unified()).total_cost_usd),-1);await reconcile();assert.equal((await alerts()).length,0);
    await refreshServiceCosts(admin,m.slice(0,7),{now:new Date(),usdToTwd:33,env:n=>n==='COST_MONITORING_ENABLED'?'false':undefined,fetch:async()=>{throw new Error('must remain paused');}});
    assert.equal((await query("select * from cost_service_snapshots")).length,1);
});
test('released Azure alphabet reservations are estimated but other speech/local modes are not guessed',async()=>{
    await db.exec("insert into speaking_pronunciation_requests values(3600,'alphabet_round','reserved',now(),'azure_alphabet_basic'),(3600,'reading','completed',now(),'azure')");
    assert.equal(Number((await unified()).total_cost_usd),1);
    const m=await month();await db.query("insert into cost_service_snapshots(provider_id,month,cost_usd,source) values('azure',$1,0.5,'billing')",[m]);
    assert.equal(Number((await unified()).total_cost_usd),0.5);
});
