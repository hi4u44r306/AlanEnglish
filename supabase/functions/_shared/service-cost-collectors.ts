// Read-only provider APIs. Never persist raw responses, account identities or credentials.
export type CostMetric = { name: string; used: number; unit: string; limit: number | null; resets_at?: string };
export type CostResult = { provider_id: string; cost_usd: number | null; source: 'billing' | 'usage'; includes_fixed?: boolean; metrics: CostMetric[]; period_start: string; period_end: string };
export type CostIO = { env: (name: string) => string | undefined; fetch: typeof fetch; now: Date; usdToTwd: number; deadline?: number };
const fail = (code: string): never => { throw new Error(code); };
const required = (io: CostIO, name: string) => io.env(name)?.trim() || fail('missing_configuration');
const number = (v: unknown) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fail('invalid_response');
const list = (v: unknown): any[] => Array.isArray(v) ? v : fail('invalid_response');
const identifier = (v: string, pattern: RegExp) => pattern.test(v) ? v : fail('invalid_configuration');
const cloudflareQueryError = (errors: unknown): never => {
    const message = (Array.isArray(errors) ? errors : []).map(error => String(error?.message || '')).join(' ').toLowerCase();
    if (/auth|permission|access denied|not authorized|unauthorized|forbidden|does not have access/.test(message)) return fail('provider_auth_failed');
    if (/account/.test(message) && /invalid|unknown|not found|access/.test(message)) return fail('provider_account_failed');
    if (/cannot query field|unknown (argument|type)|validation|expected type|is not defined/.test(message)) return fail('provider_schema_failed');
    return fail('provider_query_failed');
};
const usd = (amount: unknown, currency: unknown, io: CostIO) => {
    const value = number(amount);
    if (String(currency).toUpperCase() === 'USD') return value;
    if (String(currency).toUpperCase() === 'TWD' && io.usdToTwd > 0) return value / io.usdToTwd;
    return fail('unsupported_currency');
};
export function costPeriod(month: string, now = new Date()) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw Object.assign(new Error('月份格式不正確'), { status: 400 });
    const [year, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, m - 1, 1) - 8 * 3600000);
    const end = new Date(Math.min(Date.UTC(year, m, 1) - 8 * 3600000, now.getTime()));
    if (end <= start) throw Object.assign(new Error('不能查詢未來月份'), { status: 400 });
    return { start: start.toISOString(), end: end.toISOString() };
}
async function request(io: CostIO, url: string, init: RequestInit = {}) {
    const remaining = io.deadline ? io.deadline - Date.now() : 10000;
    if (remaining <= 0) return fail('collection_timeout');
    const response = await io.fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(Math.min(10000, remaining)) });
    if (!response.ok) return fail(`provider_http_${response.status}`);
    return response.json().catch(() => fail('invalid_response'));
}
const result = (id: string, period: ReturnType<typeof costPeriod>, cost: number | null, metrics: CostMetric[] = []): CostResult => ({
    provider_id: id, cost_usd: cost, source: cost === null ? 'usage' : 'billing', metrics, period_start: period.start, period_end: period.end
});

export async function collectOpenAI(month: string, io: CostIO): Promise<CostResult[]> {
    const period = costPeriod(month, io.now);
    const projects = required(io, 'COST_OPENAI_PROJECT_IDS').split(',').map(x => identifier(x.trim(), /^[a-zA-Z0-9_-]+$/));
    const key = required(io, 'COST_OPENAI_ADMIN_KEY');
    const params = new URLSearchParams({ start_time: String(Date.parse(period.start) / 1000), end_time: String(Math.floor(Date.parse(period.end) / 1000)), limit: '31' });
    projects.forEach(id => params.append('project_ids[]', id));
    let total = 0;
    for (let page = 0; page < 8; page++) {
        const response = await request(io, `https://api.openai.com/v1/organization/costs?${params}`, { headers: { Authorization: `Bearer ${key}` } });
        for (const bucket of list(response.data)) for (const row of list(bucket.results)) total += usd(row.amount?.value, row.amount?.currency, io);
        if (response.has_more === false) return [result('openai', period, total)];
        if (!response.next_page || response.has_more !== true) return fail('invalid_response');
        params.set('page', String(response.next_page));
    }
    return fail('incomplete_pagination');
}

export async function collectAzure(month: string, io: CostIO): Promise<CostResult[]> {
    const period = costPeriod(month, io.now);
    const tenant = identifier(required(io, 'COST_AZURE_TENANT_ID'), /^[a-zA-Z0-9.-]+$/);
    // Site-specific resource group, never the whole subscription by accident.
    const scope = identifier(required(io, 'COST_AZURE_SCOPE'), /^\/subscriptions\/[a-fA-F0-9-]+\/resourceGroups\/[a-zA-Z0-9_.()-]+$/);
    const token = await request(io, `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST', body: new URLSearchParams({ client_id: required(io, 'COST_AZURE_CLIENT_ID'), client_secret: required(io, 'COST_AZURE_CLIENT_SECRET'), grant_type: 'client_credentials', scope: 'https://management.azure.com/.default' })
    });
    if (!token.access_token) return fail('invalid_response');
    const body = JSON.stringify({ type: 'ActualCost', timeframe: 'Custom', timePeriod: { from: period.start, to: period.end }, dataset: { granularity: 'None', aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } } } });
    let url = `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query?api-version=2025-03-01`;
    let total = 0;
    for (let page = 0; page < 8; page++) {
        const response = await request(io, url, { method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body });
        const columns = list(response.properties?.columns);
        const costIndex = columns.findIndex(x => x.name === 'PreTaxCost' || x.name === 'Cost');
        const currencyIndex = columns.findIndex(x => x.name === 'Currency');
        if (costIndex < 0 || currencyIndex < 0) return fail('invalid_response');
        for (const row of list(response.properties.rows)) total += usd(row[costIndex], row[currencyIndex], io);
        if (!response.properties.nextLink) return [result('azure', period, total)];
        const next = new URL(response.properties.nextLink);
        if (next.origin !== 'https://management.azure.com' || next.pathname.toLowerCase() !== new URL(url).pathname.toLowerCase()) return fail('invalid_response');
        url = next.href;
    }
    return fail('incomplete_pagination');
}

const b64 = (value: string | Uint8Array) => btoa(typeof value === 'string' ? value : Array.from(value, v => String.fromCharCode(v)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
async function googleToken(io: CostIO) {
    let account: any;
    try { account = JSON.parse(required(io, 'COST_GOOGLE_SERVICE_ACCOUNT_JSON')); } catch { return fail('invalid_configuration'); }
    if (!account.client_email || !account.private_key || (account.token_uri && account.token_uri !== 'https://oauth2.googleapis.com/token')) return fail('invalid_configuration');
    const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
    const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const issued = Math.floor(io.now.getTime() / 1000);
    const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/bigquery', aud: 'https://oauth2.googleapis.com/token', iat: issued, exp: issued + 3600 }))}`;
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
    const response = await request(io, 'https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64(signature)}` }) });
    return response.access_token || fail('invalid_response');
}
export async function collectGoogle(month: string, io: CostIO): Promise<CostResult[]> {
    const period = costPeriod(month, io.now);
    const table = identifier(required(io, 'COST_GOOGLE_BILLING_TABLE'), /^[a-zA-Z0-9-]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/);
    const project = identifier(required(io, 'COST_GOOGLE_QUERY_PROJECT'), /^[a-zA-Z0-9-]+$/);
    const siteProjects = required(io, 'COST_GOOGLE_PROJECT_IDS').split(',').map(x => identifier(x.trim(), /^[a-zA-Z0-9-]+$/));
    const response = await request(io, `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`, {
        method: 'POST', headers: { Authorization: `Bearer ${await googleToken(io)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            // Provider export includes credits. Data is usage-month, not invoice-month.
            query: `SELECT service.description AS service, currency, SUM(cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c),0)) AS net_cost FROM \`${table}\` WHERE usage_start_time >= TIMESTAMP(@start) AND usage_start_time < TIMESTAMP(@end) AND project.id IN UNNEST(@projects) GROUP BY service,currency`,
            useLegacySql: false, useQueryCache: true, timeoutMs: 8000, maxResults: 1000, maximumBytesBilled: '1000000000', jobTimeoutMs: '10000',
            location: required(io, 'COST_GOOGLE_BIGQUERY_LOCATION'), parameterMode: 'NAMED',
            queryParameters: [
                { name: 'start', parameterType: { type: 'STRING' }, parameterValue: { value: period.start } },
                { name: 'end', parameterType: { type: 'STRING' }, parameterValue: { value: period.end } },
                { name: 'projects', parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } }, parameterValue: { arrayValues: siteProjects.map(value => ({ value })) } }
            ]
        })
    });
    if (response.jobComplete !== true || response.pageToken || response.errors?.length) return fail('incomplete_query');
    if (!response.rows?.length) return fail('billing_export_empty');
    const columns = list(response.schema?.fields).map(x => x.name);
    const totals: Record<string, number> = { google_tts: 0, firebase: 0, google_other: 0 };
    for (const row of list(response.rows || [])) {
        const values = list(row.f).map(x => x.v);
        const service = String(values[columns.indexOf('service')]);
        const id = /text.?to.?speech/i.test(service) ? 'google_tts' : /identity platform|firebase auth/i.test(service) ? 'firebase' : 'google_other';
        totals[id] += usd(values[columns.indexOf('net_cost')], values[columns.indexOf('currency')], io);
    }
    if (!['service', 'currency', 'net_cost'].every(x => columns.includes(x))) return fail('invalid_response');
    return Object.entries(totals).map(([id, amount]) => result(id, period, amount));
}

export async function collectResend(month: string, io: CostIO): Promise<CostResult[]> {
    const period = costPeriod(month, io.now);
    const current = io.now.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Taipei' });
    if (month !== current) return fail('historical_usage_unavailable');
    const response = await request(io, 'https://api.resend.com/usage', { headers: { Authorization: `Bearer ${io.env('COST_RESEND_READ_KEY') || required(io, 'RESEND_API_KEY')}` } });
    const metrics: CostMetric[] = ['daily', 'monthly'].map(window => {
        const row = response.emails?.[window];
        if (!row || !row.resets_at) return fail('invalid_response');
        return { name: window === 'daily' ? '今日 Email（帳戶）' : '本期 Email（帳戶）', used: number(row.used), limit: row.limit === null ? null : number(row.limit), unit: '封', resets_at: row.resets_at };
    });
    return [result('resend', period, null, metrics)]; // Usage API is not an invoice API.
}

export async function collectStripe(month: string, io: CostIO): Promise<CostResult[]> {
    const period = costPeriod(month, io.now);
    const key = io.env('COST_STRIPE_READ_KEY') || required(io, 'STRIPE_SECRET_KEY');
    if (!/^(sk|rk)_live_/.test(key)) return fail('test_mode_only');
    const params = new URLSearchParams({ 'created[gte]': String(Date.parse(period.start) / 1000), 'created[lt]': String(Math.floor(Date.parse(period.end) / 1000)), limit: '100' });
    let total = 0;
    for (let page = 0; page < 12; page++) {
        const response = await request(io, `https://api.stripe.com/v1/balance_transactions?${params}`, { headers: { Authorization: `Bearer ${key}` } });
        const rows = list(response.data);
        for (const row of rows) {
            // Stripe fee transactions carry their charge in amount, other entries in fee.
            total += usd(row.type === 'stripe_fee' ? -number(row.amount) : row.fee, row.currency, io) / 100;
        }
        if (response.has_more === false) return [result('stripe', period, total)];
        if (!rows.at(-1)?.id || response.has_more !== true) return fail('invalid_response');
        params.set('starting_after', rows.at(-1).id);
    }
    return fail('incomplete_pagination');
}

export async function collectCloudflare(month: string, io: CostIO): Promise<CostResult[]> {
    const period = costPeriod(month, io.now);
    const account = identifier(required(io, 'COST_CLOUDFLARE_ACCOUNT_ID'), /^[a-f0-9]{32}$/i);
    const key = required(io, 'COST_CLOUDFLARE_READ_TOKEN');
    const script = identifier(required(io, 'COST_CLOUDFLARE_WORKER_NAME'), /^[a-zA-Z0-9_-]+$/);
    const bucket = identifier(required(io, 'COST_CLOUDFLARE_R2_BUCKET'), /^[a-zA-Z0-9_.-]+$/);
    const response = await request(io, 'https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `query($account:string!,$start:Time!,$end:Time!,$ws:string!,$we:string!,$script:string!,$bucket:string!){viewer{accounts(filter:{accountTag:$account}){
          workersInvocationsAdaptive(limit:10000,filter:{datetime_geq:$ws,datetime_leq:$we,scriptName:$script}){sum{requests errors}}
          r2OperationsAdaptiveGroups(limit:10000,filter:{datetime_geq:$start,datetime_leq:$end,bucketName:$bucket}){sum{requests} dimensions{actionType}}
          r2StorageAdaptiveGroups(limit:1,filter:{datetime_geq:$start,datetime_leq:$end,bucketName:$bucket},orderBy:[datetime_DESC]){max{payloadSize metadataSize objectCount}}
        }}}`, variables: { account, start: period.start, end: period.end, ws: period.start, we: period.end, script, bucket } })
    });
    if (response.errors?.length) return cloudflareQueryError(response.errors);
    const row = list(response.data?.viewer?.accounts)[0];
    if (!row) return fail('invalid_response');
    const workers = list(row.workersInvocationsAdaptive);
    const operations = list(row.r2OperationsAdaptiveGroups);
    if (workers.length >= 10000 || operations.length >= 10000) return fail('incomplete_pagination');
    const storage = list(row.r2StorageAdaptiveGroups)[0]?.max;
    const r2: CostMetric[] = operations.map(x => ({ name: `R2 ${String(x.dimensions?.actionType || '').slice(0,60)}`, used: number(x.sum?.requests), unit: '次', limit: null }));
    if (storage) r2.push({ name: '目前 R2 儲存（非 GB-month）', used: number(storage.payloadSize) + number(storage.metadataSize), unit: 'bytes', limit: null });
    return [result('cloudflare_workers', period, null, [{ name: '網站 Worker 請求', used: workers.reduce((a, x) => a + number(x.sum?.requests), 0), unit: '次', limit: null }]), result('cloudflare_r2', period, null, r2)];
}

export async function collectGitHub(month: string, io: CostIO): Promise<CostResult[]> {
    const period = costPeriod(month, io.now);
    const owner = identifier(required(io, 'COST_GITHUB_BILLING_OWNER'), /^[a-zA-Z0-9-]+$/);
    const kind = required(io, 'COST_GITHUB_BILLING_KIND');
    if (!['user','organization'].includes(kind)) return fail('invalid_configuration');
    const repository = identifier(required(io, 'COST_GITHUB_REPOSITORY'), /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/);
    const [year, m] = month.split('-');
    const params = new URLSearchParams({ year, month:String(Number(m)), repository });
    const response = await request(io, `https://api.github.com/${kind === 'user' ? 'users' : 'organizations'}/${owner}/settings/billing/usage/summary?${params}`, {
        headers: { Authorization: `Bearer ${required(io, 'COST_GITHUB_BILLING_READ_TOKEN')}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2026-03-10' }
    });
    const items = list(response.usageItems);
    const total = items.reduce((sum,x) => sum + number(x.netAmount),0);
    const metrics = items.map(x => ({ name: `${String(x.product).slice(0,50)} ${String(x.sku).slice(0,70)}`, used:number(x.grossQuantity),unit:String(x.unitType).slice(0,30),limit:null }));
    return [{ ...result('github',period,total,metrics),includes_fixed:false }];
}

export const costCollectors = [
    { ids: ['openai'], interval: 3600, run: collectOpenAI },
    { ids: ['azure'], interval: 86400, run: collectAzure },
    { ids: ['google_tts', 'firebase', 'google_other'], interval: 21600, run: collectGoogle },
    { ids: ['cloudflare_workers', 'cloudflare_r2'], interval: 900, run: collectCloudflare },
    { ids: ['resend'], interval: 300, run: collectResend },
    { ids: ['stripe'], interval: 3600, run: collectStripe },
    { ids: ['github'], interval: 3600, run: collectGitHub }
];
export function costError(error: unknown) {
    const code = error instanceof Error ? error.message : '';
    return /^(missing_configuration|invalid_configuration|invalid_response|unsupported_currency|incomplete_pagination|incomplete_query|billing_export_empty|historical_usage_unavailable|provider_(?:query|auth|account|schema)_failed|test_mode_only|collection_timeout|provider_http_\d{3})$/.test(code) ? code : 'collection_failed';
}
