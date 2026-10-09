import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useAuth } from "../../auth/AuthContext";
import { getAiCostDashboard, updateAiCostBudget } from "../../services/aiMaterialService";
import { getServiceCostDashboard } from "../../services/costAlertService";
import ApiUsageAdmin from "./ApiUsageAdmin";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/costAlertService", () => ({ getServiceCostDashboard: jest.fn(), saveServiceCost: jest.fn() }));
jest.mock("./CostAlertPanel", () => () => <div>成本超標自動提醒</div>);
jest.mock("../../services/aiMaterialService", () => ({
    getAiCostDashboard: jest.fn(),
    updateAiCostBudget: jest.fn()
}));

const dashboard = {
    summary: { total_cost_usd: 1.25, total_cost_twd: 41.25, projected_cost_usd: 12, projected_cost_twd: 396, projected_percent: 120, total_requests: 42, success_rate: 95 },
    budget: { monthly_budget_usd: 10, warning_percent: 80, usd_to_twd_rate: 33, used_percent: 12.5, status: "normal" },
    alerts: [{ level: "warning", code: "forecast_over", title: "帳務資料缺口", message: "依目前速度預估月底可能超過預算。" }],
    daily: [{ date: "2026-09-01", requests: 12, cost_usd: 0.25 }, { date: "2026-09-02", requests: 30, cost_usd: 1 }],
    providers: [
        { id: "openai_materials", name: "OpenAI · AI 教材", category: "AI", coverage: "tracked", requests: 12, successful_requests: 12, failed_requests: 0, usage_value: 1234, usage_unit: "tokens", estimated_cost_usd: 0.5, note: "自動估算。" },
        { id: "supabase", name: "Supabase", category: "資料庫／Functions", coverage: "external", note: "請至供應商控制台核對。", dashboard_url: "https://supabase.com/dashboard" }
    ],
    recent: [], users: []
};

describe("ApiUsageAdmin", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({ firebaseUser: { getIdToken: jest.fn() } });
        getAiCostDashboard.mockResolvedValue(dashboard);
        getServiceCostDashboard.mockResolvedValue({ ...dashboard, summary: { ...dashboard.summary, incomplete_services: 1 }, providers: dashboard.providers.map(p => ({...p, enabled:true, fixed_monthly_usd:null,local_cost_usd:p.estimated_cost_usd ?? null,reported_cost_usd:null,known_cost_usd:p.estimated_cost_usd ?? 0,incomplete:true})) });
        updateAiCostBudget.mockResolvedValue({ success: true });
    });

    it("shows budget progress, forecast warning and distinguishes external billing", async () => {
        render(<ApiUsageAdmin />);
        expect(await screen.findByRole("heading", { name: "網站成本與服務用量" })).toBeInTheDocument();
        expect(await screen.findByRole("progressbar", { name: "本月網站預算使用率" })).toHaveAttribute("aria-valuenow", "13");
        expect(screen.getByText("帳務資料缺口")).toBeInTheDocument();
        expect(screen.queryByText("月底費用可能超標")).not.toBeInTheDocument();
        expect(screen.getAllByText("OpenAI · AI 教材")).toHaveLength(2);
        expect(screen.getAllByText("Supabase")).toHaveLength(2);
        expect(screen.getAllByText("需補資料").length).toBeGreaterThan(0);
    });

    it("filters providers and saves the budget", async () => {
        render(<ApiUsageAdmin />);
        await screen.findByRole('heading', { name: '依目前人數估算每月成本' });
        fireEvent.click(screen.getByRole("button", { name: "需補資料" }));
        const serviceCards = within(document.querySelector('.api-provider-grid'));
        expect(serviceCards.queryByText("OpenAI · AI 教材")).not.toBeInTheDocument();
        expect(serviceCards.getByText("Supabase")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "儲存設定" }));
        await waitFor(() => expect(updateAiCostBudget).toHaveBeenCalled());
    });

    it("turns the progress warning red after the monthly budget is exceeded", async () => {
        getServiceCostDashboard.mockResolvedValueOnce({
            ...dashboard,
            budget: { ...dashboard.budget, used_percent: 105, status: "over" }
        });
        render(<ApiUsageAdmin />);
        const progress = await screen.findByRole("progressbar", { name: "本月網站預算使用率" });
        expect(progress.closest("section")).toHaveClass("api-budget-critical");
    });

    it('does not present zero cost when the unified data request fails', async()=>{
        getServiceCostDashboard.mockRejectedValueOnce(new Error('帳務資料讀取失敗'));
        render(<ApiUsageAdmin />);
        expect(await screen.findByRole('alert')).toHaveTextContent('尚無可用成本資料');
        expect(screen.queryByText('本月已知成本合計')).not.toBeInTheDocument();
    });

    it('discards a previous month response that arrives after a month switch',async()=>{
        let finishOld;getServiceCostDashboard.mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;}));
        render(<ApiUsageAdmin />);fireEvent.change(screen.getByLabelText('查詢月份'),{target:{value:'2026-09'}});
        await screen.findByText('本月已知成本合計');
        finishOld({...dashboard,summary:{...dashboard.summary,total_cost_usd:999}});
        await waitFor(()=>expect(getServiceCostDashboard).toHaveBeenCalledTimes(2));
        expect(screen.queryByText('999.00')).not.toBeInTheDocument();
    });
});
