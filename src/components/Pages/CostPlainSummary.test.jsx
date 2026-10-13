import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { saveServiceCost } from '../../services/costAlertService';
import CostPlainSummary from './CostPlainSummary';
import UnitProfitCalculator from './UnitProfitCalculator';

jest.mock('../../services/costAlertService', () => ({ saveServiceCost: jest.fn() }));
const provider = (id, extra = {}) => ({ id, name: id, category: id, enabled: true, fixed_monthly_usd: null, local_cost_usd: null, reported_cost_usd: null, ...extra });
const budget = { monthly_budget_usd: 25, warning_percent: 80, usd_to_twd_rate: 33, used_percent: 4 };
const providers = [provider('azure', { reported_cost_usd: 1, known_cost_usd: 1, source: 'billing' }), provider('supabase'), provider('github', { reported_cost_usd: 0, known_cost_usd: 0, source: 'billing' })];
const view = (extra = {}) => render(<CostPlainSummary providers={providers} summary={{ total_cost_twd: 33 }} budget={budget} month="2026-10" firebaseUser={{ uid: 'a' }} onSaved={jest.fn()} {...extra} />);
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

test('answers the monthly total in NT$ and lists unknown services separately', () => {
    view();
    expect(within(screen.getByRole('heading', { name: '2026-10 到目前為止的費用' }).parentElement).getByText('NT$33')).toBeInTheDocument();
    expect(screen.getByText(/還有 1 項不知道金額/)).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: '請補上這 1 項的金額' }).closest('section')).getByText('資料庫與後台')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: '錢花在哪裡' }).closest('section')).getByText('口說評分')).toBeInTheDocument();
    expect(screen.getByText('目前 0 元的項目（1 項）')).toBeInTheDocument();
});
test('saves a monthly fee typed in NT$ as USD without inventing a bill total', async () => {
    const onSaved = jest.fn(); saveServiceCost.mockResolvedValue({});
    view({ onSaved });
    fireEvent.click(screen.getByRole('button', { name: '填寫 資料庫與後台' }));
    fireEvent.change(screen.getByLabelText('資料庫與後台 每月固定費'), { target: { value: '825' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveServiceCost).toHaveBeenCalledWith({ uid: 'a' }, { provider_id: 'supabase', month: '2026-10', enabled: true, fixed_monthly_usd: 25, month_total_usd: null });
});
test('keeps the form open and reports a failed save', async () => {
    saveServiceCost.mockRejectedValue(new Error('權限不足'));
    view();
    fireEvent.click(screen.getByRole('button', { name: '填寫 資料庫與後台' }));
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('權限不足');
});
test('profit calculator shows cost, profit and break-even, and a loss is labelled', () => {
    render(<UnitProfitCalculator userId="a" fixedTwd={825} />);
    expect(screen.getByText('NT$2,409')).toBeInTheDocument();
    expect(screen.getByText('1 套')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('售價'), { target: { value: '100' } });
    expect(screen.getByText('每套虧損')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('運費'), { target: { value: '' } });
    expect(screen.getByRole('alert')).toHaveTextContent('每一格都要填數字');
});
