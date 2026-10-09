import { costCollectors, costError, costPeriod, type CostIO } from "./service-cost-collectors.ts";
const checked = (r: any) => { if (r.error) throw r.error; return r.data; };
export const serviceNames: Record<string, { name: string; category: string; note: string }> = {
    openai: { name: 'OpenAI', category: 'AI 教材／OCR／題庫', note: '帳務接通前使用網站 Token 估算；接通後以指定專案費用取代相同服務估算。帳務有延遲。' },
    google_tts: { name: 'Google Cloud TTS', category: '自然示範語音', note: '接通前為網站字元牌價估算；Google 帳單包含免費折抵，更新有延遲。' },
    firebase: { name: 'Firebase Authentication', category: '登入／Identity Platform', note: '透過 Google 帳務匯出取得登入費用；不把學生帳號數當成計費 MAU。' },
    google_other: { name: 'Google Cloud 其他服務', category: '帳務查詢／其他雲端服務', note: '同一網站專案的其他 Google 費用，包括 BigQuery 查詢；與 TTS、登入分開計算。' },
    azure: { name: 'Azure Speech', category: '錄音發音評分', note: '字母基本評分依既有 US$1／小時保守估算，含預留與失敗；不含舊版其他 Azure 評分費用。接通網站資源群組帳單後每日核對並取代估算。本機朗讀不算 Azure 費用。' },
    supabase: { name: 'Supabase', category: '資料庫／Edge Functions／流量', note: '資料庫大小可直接監測。組織月費、Compute、流量、Functions 超額帳單尚無已接通來源；固定月費與本月總額可於此設定。' },
    cloudflare_r2: { name: 'Cloudflare R2', category: '私有教材音檔／儲存／操作', note: '操作量限網站 bucket、採台灣月份。帳務接通後另顯示整個 Cloudflare 帳戶的 R2 用量費與計費用量，採 UTC 月份、每日更新，以實際回傳期間為準；可能包含其他 bucket。固定月費另設，空資料保留缺口。' },
    cloudflare_workers: { name: 'Cloudflare Workers／Pages', category: '正式網站／請求／CPU／建置', note: '請求量限網站 Worker、採台灣月份。帳務接通後為整個 Cloudflare 帳戶 Workers 產品的用量費，採 UTC 月份、每日更新，以實際回傳期間為準；可能包含其他 Worker。固定方案費另設，其他 Cloudflare 產品與稅金不包含在此。' },
    resend: { name: 'Resend', category: '系統信／週報／成本提醒', note: '自動取得整個寄信帳戶的每日／本期用量及額度；寄送成本提醒也會消耗此額度。用量 API 不提供帳單金額。' },
    stripe: { name: 'Stripe', category: '付款手續費', note: '只讀正式帳戶 balance transaction 的費用；測試交易不算真實支出。不更動商品、扣款或訂閱。' },
    github: { name: 'GitHub', category: 'Actions／Packages／儲存', note: '讀取本 Repository 的使用量淨費用（供應商月曆月份）；GitHub 方案月費另設固定費，與 Cloudflare 建置分開。' },
    netlify: { name: 'Netlify（歷史／測試服務）', category: '可能保留的舊訂閱／用量', note: '正式前端使用 Cloudflare。未核對舊帳戶訂閱前仍保留費用缺口；確認不再付費後可取消列入監測。' },
    domain: { name: '網域／固定訂閱', category: '網域續約／相關訂閱', note: '年費可除以 12 填入月攤提；續約月份實際支出可填本月總額。' },
    other: { name: '其他網站支出', category: '未串接服務／PAYUNi 等', note: '保留其他支出入口；未確認停用的服務不會自動假設零元。' }
};

export async function refreshServiceCosts(admin: any, month: string, io: CostIO) {
    costPeriod(month, io.now);
    if (io.env('COST_MONITORING_ENABLED') === 'false') return;
    const boundedIO = { ...io, deadline: Date.now() + 40000 };
    // Atomic leases throttle independent browser/cron workers. No credentials returned.
    await Promise.all(costCollectors.map(async collector => {
        const claims = checked(await admin.rpc('claim_cost_service_refresh_v1', { p_month: `${month}-01`, p_providers: collector.ids })) || [];
        if (!claims.length) return;
        let results: any[] = [];
        let error: string | null = null;
        try { results = await collector.run(month, boundedIO); } catch (e) { error = costError(e); }
        for (const claim of claims) {
            const row = results.find(x => x.provider_id === claim.provider_id);
            const code = error || row?.billing_error || (row ? null : 'invalid_response');
            let usagePatch = {};
            if (row?.billing_error) {
                // Billing may be unavailable for a free product. Keep analytics moving without
                // discarding the previous bill, billed metrics or its successful timestamp.
                const previous = checked(await admin.from('cost_service_snapshots').select('metrics').eq('provider_id', claim.provider_id).eq('month', claim.month).single());
                const billed = (Array.isArray(previous?.metrics) ? previous.metrics : []).filter((metric: any) => String(metric.name).startsWith('帳戶計費用量：'));
                usagePatch = { metrics: [...row.metrics, ...billed] };
            }
            // Failed refresh retains previous amount, metrics and successful timestamp.
            checked(await admin.from('cost_service_snapshots').update({
                ...(row && !row.billing_error ? { cost_usd: row.cost_usd, source: row.source, includes_fixed: row.includes_fixed ?? true, metrics: row.metrics, period_start: row.period_start, period_end: row.period_end, collected_at: io.now.toISOString() } : usagePatch),
                error_code: code, claim_token: null,
                next_refresh_at: new Date(io.now.getTime() + (code ? 900 : collector.interval) * 1000).toISOString()
            }).eq('provider_id', claim.provider_id).eq('month', claim.month).eq('claim_token', claim.claim_token));
        }
    }));
}
export async function serviceCostDashboard(admin: any, month: string) {
    const population = await costPopulation(admin);
    const raw = checked(await admin.rpc('unified_cost_month_v1', { p_month: `${month}-01` }));
    const budget = checked(await admin.from('ai_api_budget_settings').select('monthly_budget_usd,warning_percent,usd_to_twd_rate').eq('id', 1).single());
    const providers = raw.providers.map((row: any) => {
        const outdated = Boolean(row.source !== 'manual' && row.collected_at && row.next_refresh_at && Date.parse(row.next_refresh_at) < Date.now());
        return { ...row, id: row.provider_id, ...serviceNames[row.provider_id], coverage: row.enabled && !row.incomplete && !row.error_code && !outdated ? 'tracked' : 'external', stale: outdated };
    });
    const total = Number(raw.total_cost_usd);
    const used = total * 100 / Number(budget.monthly_budget_usd);
    const gaps = providers.filter((p: any) => p.enabled && (p.incomplete || p.error_code || p.stale)).length;
    return { month, providers, population, calculated_at: raw.calculated_at, summary: { total_cost_usd: total, total_cost_twd: total * Number(budget.usd_to_twd_rate), incomplete_services: gaps }, budget: { ...budget, used_percent: used, status: used >= 100 ? 'over' : used >= budget.warning_percent ? 'warning' : 'normal' } };
}
// Only called behind the existing Firebase and database administrator gate.
// Exact HEAD count avoids returning profiles and the API row limit.
export async function costPopulation(admin: any) {
    try {
        const result = await admin.from('students').select('id', { count: 'exact', head: true })
            .eq('role', 'student').eq('account_status', 'active');
        if (result.error || !Number.isInteger(result.count) || result.count < 0) throw new Error('count_unavailable');
        return { active_students: result.count, counted_at: new Date().toISOString() };
    } catch {
        return { active_students: null, counted_at: null, error: 'population_unavailable' };
    }
}
export async function saveServiceCost(admin: any, body: any) {
    if (!serviceNames[body.provider_id] || typeof body.enabled !== 'boolean') throw Object.assign(new Error('服務設定格式不正確'), { status: 400 });
    costPeriod(body.month);
    const validAmount = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000000);
    if (!validAmount(body.fixed_monthly_usd) || !validAmount(body.month_total_usd)) throw Object.assign(new Error('費用須為 0 至 1000000 美元，未知請留空'), { status: 400 });
    // Save monthly override atomically in the database, so it cannot race a refresh.
    checked(await admin.rpc('save_cost_service_v1', { p_provider: body.provider_id, p_month: `${body.month}-01`, p_fixed: body.fixed_monthly_usd, p_total: body.month_total_usd, p_enabled: body.enabled }));
}
