import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import CostOverview from './CostOverview';
import { calculateScaleCosts } from './costScale';
import { costOverview, hasFreePlanReview, reviewIsCurrent, serviceCostDisplay } from './costPresentation';

const now = new Date('2026-10-09T08:00:00Z');
const provider = (id, more = {}) => ({ id, name: id, enabled: true, fixed_monthly_usd: null, local_cost_usd: null, reported_cost_usd: null, known_cost_usd: 0, incomplete: true, ...more });
const review = { kind: 'free_plan', note: '供應商帳務頁：免費方案，未啟用超額付費。', checkedAt: now.toISOString(), validThrough: '2026-10-11' };
beforeEach(() => localStorage.clear());

test('a zero fixed fee never becomes a zero full bill or a free plan without a review', () => {
    const row = provider('supabase', { fixed_monthly_usd: 0 });
    expect(serviceCostDisplay(row)).toEqual({ amount: null, label: '僅確認固定月費', kind: 'unknown' });
    expect(costOverview([row], {}, '2026-10', now)).toMatchObject({ freeCount: 0, billedTotal: null, gaps: 1 });
    expect(costOverview([row], { supabase: review }, '2026-10', now)).toMatchObject({ freeCount: 1, gaps: 1 });
});

test('billing credits and provider totals preserve net amount without adding fixed fees twice', () => {
    const rows = [provider('azure', { reported_cost_usd: 3, known_cost_usd: 5, fixed_monthly_usd: 2, incomplete: false }),
        provider('google', { reported_cost_usd: -1, known_cost_usd: -1, incomplete: false }),
        provider('local', { local_cost_usd: 20, known_cost_usd: 20 }),
        provider('disabled', { enabled: false, reported_cost_usd: 100, known_cost_usd: 100 })];
    expect(costOverview(rows, {}, '2026-10', now)).toMatchObject({ billedTotal: 2, billingCount: 2, gaps: 1, freeCount: 0 });
});

test('zero billing is not a permanent free plan, and stale or failed snapshots remain gaps', () => {
    const row = provider('openai', { source: 'billing', reported_cost_usd: 0, known_cost_usd: 0, incomplete: false, stale: true });
    expect(costOverview([row], {}, '2026-10', now)).toMatchObject({ freeCount: 0, billedTotal: 0, gaps: 1 });
    expect(costOverview([{ ...row, stale: false, error_code: 'provider_http_401' }], {}, '2026-10', now).gaps).toBe(1);
});

test('manual free reviews expire at the period boundary, after seven days, or when fees change', () => {
    const row = provider('supabase', { fixed_monthly_usd: 0 });
    expect(reviewIsCurrent(review, '2026-10', now)).toBe(true);
    expect(reviewIsCurrent(review, '2026-09', now)).toBe(false);
    expect(reviewIsCurrent({ ...review, validThrough: '2026-10-08' }, '2026-10', now)).toBe(false);
    expect(reviewIsCurrent({ ...review, checkedAt: '2026-10-01T00:00:00Z' }, '2026-10', now)).toBe(false);
    expect(hasFreePlanReview({ ...row, fixed_monthly_usd: 5 }, review, '2026-10', now)).toBe(false);
    expect(hasFreePlanReview({ ...row, reported_cost_usd: 0.01 }, review, '2026-10', now)).toBe(false);
    expect(hasFreePlanReview({ ...row, enabled: false }, review, '2026-10', now)).toBe(false);
});

test('manual review is saved per user and month without converting unknown costs into billing', () => {
    jest.useFakeTimers().setSystemTime(now);
    try {
        const providers = [provider('supabase', { fixed_monthly_usd: 0 })];
        const scale = calculateScaleCosts(providers, { active_students: 1 }, '2026-10', {}, now);
        render(<CostOverview providers={providers} scale={scale} month="2026-10" rate={33} userId="admin" />);
        fireEvent.click(screen.getByText('核對紀錄'));
        fireEvent.change(screen.getByLabelText('supabase 核對類型'), { target: { value: 'free_plan' } });
        fireEvent.change(screen.getByLabelText('supabase 核對適用至'), { target: { value: '2026-10-11' } });
        fireEvent.change(screen.getByLabelText('supabase 核對結果'), { target: { value: review.note } });
        fireEvent.click(screen.getByRole('button', { name: '保存 supabase 核對' }));
        expect(screen.getByText('1 項方案')).toBeInTheDocument();
        expect(within(screen.getByRole('table')).getByText('尚未取得')).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem('ae-cost-review-v1:admin:2026-10')).supabase).toMatchObject(review);
    } finally { jest.useRealTimers(); }
});
