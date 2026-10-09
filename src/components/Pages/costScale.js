// Forecast assumptions remain separate from incurred costs and alert thresholds.
export const costAmount = value => value === null || value === undefined || value === '' || typeof value === 'boolean'
    ? null : Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1000000 ? Number(value) : null;

export function scalePeriod(month, now = new Date()) {
    const [year, number] = month.split('-').map(Number);
    const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const current = today.slice(0, 7);
    return { days, factor: month < current ? 1 : month === current ? days / Number(today.slice(8, 10)) : null };
}

export function defaultScaleCost(provider, period) {
    if (provider.source === 'manual' && costAmount(provider.reported_cost_usd) !== null) {
        return { shared: costAmount(provider.reported_cost_usd), perStudent: 0, basis: '已登錄完整月總額；已含固定費，作為目前規模參考', partial: false };
    }
    if (provider.id === 'azure') {
        return { shared: costAmount(provider.fixed_monthly_usd) ?? 0, perStudent: 26 * 3 * period.days / 3600,
            basis: `A–Z 情境：每人每天 26 字母、各 3 秒、${period.days} 天，沿用 US$1／小時預算假設；其他評分／重試需補入共用費`, partial: true };
    }
    const fixed = costAmount(provider.fixed_monthly_usd);
    const local = costAmount(provider.local_cost_usd);
    if (['openai', 'google_tts'].includes(provider.id) && local !== null && period.factor !== null) {
        return { shared: local * period.factor + (fixed ?? 0), perStudent: 0,
            basis: '以所選月份網站生成用量外推整月；教材／示範語音可共用，不按人數重複生成；尚未核對帳務折抵', partial: true };
    }
    return { shared: fixed, perStudent: null, basis: '待確認方案月費、免費額度及超額用量；確認無費用可填 0', partial: true };
}

export function calculateScaleCosts(providers, population, month, overrides = {}, now = new Date()) {
    const count = Number.isInteger(population?.active_students) && population.active_students >= 0 ? population.active_students : null;
    const period = scalePeriod(month, now);
    const rows = providers.map(provider => {
        const automatic = defaultScaleCost(provider, period);
        const override = overrides[provider.id];
        const shared = override ? costAmount(override.shared) : automatic.shared;
        const perStudent = override ? costAmount(override.perStudent) : automatic.perStudent;
        const variable = count === null || perStudent === null ? null : count * perStudent;
        const amount = shared !== null || variable !== null ? (shared ?? 0) + (variable ?? 0) : null;
        const partial = shared === null || perStudent === null || count === null || (!override && automatic.partial);
        return { ...provider, shared, perStudent, amount, partial, basis: override ? '管理員填入的月費與人均預算假設；非實際帳單' : automatic.basis };
    });
    const enabled = rows.filter(row => row.enabled);
    const known = enabled.filter(row => row.amount !== null);
    return { rows, count, total: known.length ? known.reduce((sum, row) => sum + row.amount, 0) : null,
        gaps: enabled.filter(row => row.partial).length, days: period.days };
}
