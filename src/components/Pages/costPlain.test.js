import { plainBill, plainSummary, toUsd, twdText, unitProfit } from './costPlain';

const provider = (id, extra = {}) => ({ id, name: id, category: id, enabled: true, fixed_monthly_usd: null, local_cost_usd: null, reported_cost_usd: null, ...extra });

test('a service with no bill, estimate or monthly fee stays unknown instead of becoming zero', () => {
    expect(plainBill(provider('supabase'), 33)).toMatchObject({ group: 'unknown', amountTwd: null, label: '資料庫與後台' });
    expect(twdText(null)).toBe('還不知道');
});
test('amounts follow the backend known cost and are converted to NT$', () => {
    expect(plainBill(provider('azure', { reported_cost_usd: 1, known_cost_usd: 1, source: 'billing' }), 33)).toMatchObject({ group: 'paying', amountTwd: 33, source: '帳單金額', caution: null });
    expect(plainBill(provider('openai', { local_cost_usd: 0.5, fixed_monthly_usd: 2, known_cost_usd: 2.5 }), 30)).toMatchObject({ amountTwd: 75, source: '系統估算' });
    expect(plainBill(provider('domain', { reported_cost_usd: 3, known_cost_usd: 3, source: 'manual' }), 33).source).toBe('你填的金額');
    expect(plainBill(provider('github', { reported_cost_usd: 0, known_cost_usd: 0, source: 'billing' }), 33).group).toBe('zero');
});
test('a monthly fee without a bill is counted but flagged as possibly incomplete', () => {
    expect(plainBill(provider('supabase', { fixed_monthly_usd: 25, known_cost_usd: 25, incomplete: true }), 33)).toMatchObject({ group: 'paying', amountTwd: 825, source: '只算月費', caution: '只有月費，超出的用量費還沒算進來' });
});
test('summary sorts paying services, separates groups and totals fixed fees of counted services only', () => {
    const result = plainSummary([
        provider('azure', { reported_cost_usd: 1, known_cost_usd: 1 }), provider('supabase', { fixed_monthly_usd: 25, known_cost_usd: 25 }),
        provider('firebase'), provider('netlify', { enabled: false, fixed_monthly_usd: 19 }), provider('github', { reported_cost_usd: 0, known_cost_usd: 0, fixed_monthly_usd: 0 })
    ], 33);
    expect(result.paying.map(bill => bill.id)).toEqual(['supabase', 'azure']);
    expect(result.unknown.map(bill => bill.id)).toEqual(['firebase']);
    expect(result.excluded.map(bill => bill.id)).toEqual(['netlify']);
    expect(result.zero.map(bill => bill.id)).toEqual(['github']);
    expect(result.fixedTwd).toBe(825);
});
test('small and rounded NT$ amounts are readable and NT$ input converts back to USD', () => {
    expect(twdText(0.4)).toBe('不到 NT$1'); expect(twdText(0)).toBe('NT$0'); expect(twdText(1234.6)).toBe('NT$1,235');
    expect(toUsd('825', 33)).toBe(25);
});
test('unit profit adds every cost once and refuses blanks', () => {
    const result = unitProfit({ price: '2980', months: '12', printing: '150', shipping: '65', packaging: '15', feePercent: '3', platformPerMonth: '21' });
    expect(result.fee).toBeCloseTo(89.4); expect(result.platformTotal).toBe(252); expect(result.cost).toBeCloseTo(571.4); expect(result.profit).toBeCloseTo(2408.6);
    expect(unitProfit({ price: '100', months: '12', printing: '150', shipping: '0', packaging: '0', feePercent: '0', platformPerMonth: '0' }).profit).toBe(-50);
    expect(unitProfit({ price: '2980', months: '', printing: '150', shipping: '65', packaging: '15', feePercent: '3', platformPerMonth: '21' })).toBeNull();
});
