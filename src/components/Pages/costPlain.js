// Plain-language, NT$-first presentation of the unified cost dashboard.
// Display only: the backend total and alert thresholds are never replaced here.
import { billingAmount } from './costPresentation';

export const plainNames = {
    openai: { label: 'AI 出題與教材', vendor: 'OpenAI' },
    google_tts: { label: '示範語音', vendor: 'Google' },
    firebase: { label: '學生登入', vendor: 'Firebase' },
    google_other: { label: 'Google 其他費用', vendor: 'Google Cloud' },
    azure: { label: '口說評分', vendor: 'Azure' },
    supabase: { label: '資料庫與後台', vendor: 'Supabase' },
    cloudflare_r2: { label: '聽力音檔存放', vendor: 'Cloudflare R2' },
    cloudflare_workers: { label: '網站主機', vendor: 'Cloudflare' },
    resend: { label: '寄信', vendor: 'Resend' },
    stripe: { label: '刷卡手續費', vendor: 'Stripe' },
    github: { label: '程式碼存放', vendor: 'GitHub' },
    netlify: { label: '舊網站主機', vendor: 'Netlify' },
    domain: { label: '網域', vendor: '年費請除以 12' },
    other: { label: '開發工具訂閱與其他', vendor: 'ChatGPT／Claude Code 等' }
};

export const toTwd = (usd, rate) => usd === null || usd === undefined ? null : Number(usd) * Number(rate);
export const toUsd = (twd, rate) => Math.round(Number(twd) / Number(rate) * 10000) / 10000;
export const twdText = value => {
    if (value === null || value === undefined) return '還不知道';
    if (value > 0 && value < 1) return '不到 NT$1';
    return `NT$${Math.round(value).toLocaleString('zh-TW')}`;
};

export function plainBill(provider, rate) {
    const reported = billingAmount(provider.reported_cost_usd);
    const local = billingAmount(provider.local_cost_usd);
    const fixed = billingAmount(provider.fixed_monthly_usd);
    const names = plainNames[provider.id] || { label: provider.name, vendor: provider.category };
    const base = { id: provider.id, ...names, provider, fixedTwd: toTwd(fixed, rate) };
    if (!provider.enabled) return { ...base, group: 'excluded', amountTwd: null, source: '不計入' };
    if (reported === null && local === null && fixed === null) return { ...base, group: 'unknown', amountTwd: null, source: '還不知道' };
    const known = billingAmount(provider.known_cost_usd);
    const usd = known ?? (reported !== null ? reported : (local ?? 0) + (fixed ?? 0));
    const source = reported !== null ? (provider.source === 'manual' ? '你填的金額' : '帳單金額') : local !== null ? '系統估算' : '只算月費';
    const outdated = Boolean(provider.error_code || provider.stale);
    return { ...base, group: usd > 0 ? 'paying' : 'zero', amountTwd: toTwd(usd, rate), source,
        // The bill itself is missing or late; the amount shown may be lower than the real invoice.
        caution: reported === null && fixed !== null && local === null ? '只有月費，超出的用量費還沒算進來'
            : outdated && reported === null ? '帳單還沒拿到，先用估算' : outdated ? '帳單資料沒有更新到最新' : null };
}

export function plainSummary(providers = [], rate) {
    const bills = providers.map(provider => plainBill(provider, rate));
    const byGroup = group => bills.filter(bill => bill.group === group);
    const paying = byGroup('paying').sort((a, b) => b.amountTwd - a.amountTwd);
    const counted = bills.filter(bill => ['paying', 'zero'].includes(bill.group));
    return { paying, zero: byGroup('zero'), unknown: byGroup('unknown'), excluded: byGroup('excluded'),
        fixedTwd: counted.reduce((sum, bill) => sum + (bill.fixedTwd ?? 0), 0) };
}

// One sale of a workbook bundle. Every amount is NT$; blanks count as unknown, never zero.
const amount = value => value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
export function unitProfit(input) {
    const price = amount(input.price), printing = amount(input.printing), shipping = amount(input.shipping), packaging = amount(input.packaging);
    const feePercent = amount(input.feePercent), months = amount(input.months), platform = amount(input.platformPerMonth);
    if ([price, printing, shipping, packaging, feePercent, months, platform].includes(null)) return null;
    const fee = price * feePercent / 100;
    const platformTotal = months * platform;
    const cost = printing + shipping + packaging + fee + platformTotal;
    const profit = price - cost;
    return { fee, platformTotal, cost, profit, margin: price > 0 ? profit * 100 / price : null };
}
