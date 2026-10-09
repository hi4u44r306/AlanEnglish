import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CostScalePanel from './CostScalePanel';
import { calculateScaleCosts, costAmount, scalePeriod } from './costScale';

const population = { active_students: 40 };
const provider = (id, extra = {}) => ({ id, name: id, enabled: true, fixed_monthly_usd: null, local_cost_usd: null, reported_cost_usd: null, ...extra });
const now = new Date('2026-10-09T04:00:00Z');
beforeEach(() => localStorage.clear());

test('population multiplies variable costs, fixed fees are added once and excluded items stay out', () => {
    const result = calculateScaleCosts([provider('supabase'), provider('domain', { enabled: false })], population, '2026-10', {
        supabase: { shared: 25, perStudent: 0.5 }, domain: { shared: 100, perStudent: 10 }
    }, now);
    expect(result.total).toBe(45); expect(result.gaps).toBe(0);
});
test('unknown costs and unavailable counts never become a complete zero total', () => {
    expect(calculateScaleCosts([provider('supabase')], population, '2026-10', {}, now)).toMatchObject({ total: null, gaps: 1 });
    expect(calculateScaleCosts([provider('supabase')], { active_students: null }, '2026-10', { supabase: { shared: 25, perStudent: 1 } }, now)).toMatchObject({ total: 25, gaps: 1, count: null });
    expect(costAmount('')).toBeNull(); expect(costAmount(-1)).toBeNull(); expect(costAmount('NaN')).toBeNull(); expect(costAmount(0)).toBe(0);
});
test('a full monthly manual total includes fixed fees and is not multiplied by population', () => {
    expect(calculateScaleCosts([provider('supabase', { source: 'manual', reported_cost_usd: 27, fixed_monthly_usd: 25 })], population, '2026-10', {}, now)).toMatchObject({ total: 27, gaps: 0 });
});
test('Azure scenario respects calendar days, including leap February and zero students', () => {
    expect(calculateScaleCosts([provider('azure')], population, '2026-10', {}, now).total).toBeCloseTo(26.8666667);
    expect(scalePeriod('2028-02', now).days).toBe(29);
    expect(calculateScaleCosts([provider('azure')], { active_students: 0 }, '2026-10', {}, now).total).toBe(0);
});
test('shared generation extrapolates only current month and never multiplies a shared asset by student count', () => {
    const rows = [provider('google_tts', { local_cost_usd: 9, fixed_monthly_usd: 1 })];
    expect(calculateScaleCosts(rows, population, '2026-10', {}, now).total).toBe(32);
    expect(calculateScaleCosts(rows, population, '2026-09', {}, now).total).toBe(10);
    expect(calculateScaleCosts(rows, population, '2026-11', {}, now).total).toBe(1);
});
test('edits update itemized totals and react to refreshed counts; restore uses provider defaults', () => {
    const props = { providers: [provider('supabase')], population, month: '2026-10', rate: 32, userId: 'admin' };
    const { rerender } = render(<CostScalePanel {...props} />);
    fireEvent.click(screen.getByText('調整每人用量與月底預算假設'));
    fireEvent.change(screen.getByLabelText('supabase 固定／共用月費'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('supabase 每人每月用量費'), { target: { value: '0.5' } });
    expect(screen.getByText('US$ 45.00／月')).toBeInTheDocument();
    rerender(<CostScalePanel {...props} population={{ active_students: 50 }} />);
    expect(screen.getByText('US$ 50.00／月')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('ae-cost-scale-v1:admin:2026-10')).supabase.perStudent).toBe('0.5');
    fireEvent.click(screen.getByRole('button', { name: '恢復 supabase 自動估算' }));
    expect(screen.getByText('可估算項目合計（尚未完整）')).toBeInTheDocument();
});
test('an unavailable population shows a warning and corrupt saved assumptions are ignored', () => {
    localStorage.setItem('ae-cost-scale-v1:admin:2026-10', 'corrupt');
    render(<CostScalePanel providers={[provider('supabase')]} month="2026-10" rate={32} userId="admin" />);
    fireEvent.click(screen.getByText('調整每人用量與月底預算假設'));
    expect(screen.getByRole('alert')).toHaveTextContent('不當成 0 人');
});
