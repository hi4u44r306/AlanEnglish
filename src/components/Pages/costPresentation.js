// Display-only distinctions. Never replace the backend total used by alerts.
export const billingAmount = value => value == null || value === '' || typeof value === 'boolean'
    ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export const taiwanDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(now);

export function serviceCostDisplay(provider) {
    const reported = billingAmount(provider.reported_cost_usd);
    const local = billingAmount(provider.local_cost_usd);
    const fixed = billingAmount(provider.fixed_monthly_usd);
    if (!provider.enabled) return { amount: null, label: '不列入總計', kind: 'excluded' };
    if (reported !== null) return {
        amount: reported,
        label: provider.source === 'manual' ? '人工登錄帳務' : '供應商帳務', kind: 'billing'
    };
    if (local !== null) return { amount: local, label: '網站估算，非帳單', kind: 'estimate' };
    return { amount: null, label: fixed === null ? '金額待核對' : '僅確認固定月費', kind: 'unknown' };
}

export function reviewIsCurrent(review, month, now = new Date()) {
    const today = taiwanDate(now);
    return Boolean(review && ['free_plan', 'usage'].includes(review.kind)
        && /^\d{4}-\d{2}-\d{2}$/.test(review.validThrough || '')
        && review.validThrough.startsWith(`${month}-`) && review.validThrough >= today
        && Number.isFinite(Date.parse(review.checkedAt)) && Date.parse(review.checkedAt) <= now.getTime()
        && now.getTime() - Date.parse(review.checkedAt) <= 7 * 86400000);
}

export function hasFreePlanReview(provider, review, month, now = new Date()) {
    return provider.enabled && billingAmount(provider.fixed_monthly_usd) === 0
        && !(billingAmount(provider.reported_cost_usd) > 0)
        && review?.kind === 'free_plan' && reviewIsCurrent(review, month, now);
}

export function costOverview(providers, reviews, month, now = new Date()) {
    const enabled = providers.filter(provider => provider.enabled);
    const billed = enabled.filter(provider => serviceCostDisplay(provider).kind === 'billing');
    return {
        billedTotal: billed.length ? billed.reduce((sum, provider) => sum + serviceCostDisplay(provider).amount, 0) : null,
        billingCount: billed.length,
        freeCount: enabled.filter(provider => hasFreePlanReview(provider, reviews[provider.id], month, now)).length,
        gaps: enabled.filter(provider => provider.incomplete || provider.error_code || provider.stale || serviceCostDisplay(provider).kind !== 'billing').length
    };
}
