import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "../../auth/AuthContext";
import { getAiCostDashboard, updateAiCostBudget } from "../../services/aiMaterialService";
import ApiUsageAdmin from "./ApiUsageAdmin";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/aiMaterialService", () => ({
    getAiCostDashboard: jest.fn(),
    updateAiCostBudget: jest.fn()
}));

const dashboard = {
    summary: { total_cost_usd: 1.25, total_cost_twd: 41.25, projected_cost_usd: 12, projected_cost_twd: 396, projected_percent: 120, total_requests: 42, success_rate: 95 },
    budget: { monthly_budget_usd: 10, warning_percent: 80, usd_to_twd_rate: 33, used_percent: 12.5, status: "normal" },
    alerts: [{ level: "warning", code: "forecast_over", title: "月底費用可能超標", message: "依目前速度預估月底可能超過預算。" }],
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
        updateAiCostBudget.mockResolvedValue({ success: true });
    });

    it("shows budget progress, forecast warning and distinguishes external billing", async () => {
        render(<ApiUsageAdmin />);
        expect(await screen.findByRole("heading", { name: "API 使用量與費用" })).toBeInTheDocument();
        expect(await screen.findByRole("progressbar", { name: "本月 API 預算使用率" })).toHaveAttribute("aria-valuenow", "13");
        expect(screen.getByText("月底費用可能超標")).toBeInTheDocument();
        expect(screen.getByText("OpenAI · AI 教材")).toBeInTheDocument();
        expect(screen.getByText("Supabase")).toBeInTheDocument();
        expect(screen.getAllByText("外部核對").length).toBeGreaterThan(0);
    });

    it("filters providers and saves the budget", async () => {
        render(<ApiUsageAdmin />);
        await screen.findByText("OpenAI · AI 教材");
        fireEvent.click(screen.getByRole("button", { name: "外部核對" }));
        expect(screen.queryByText("OpenAI · AI 教材")).not.toBeInTheDocument();
        expect(screen.getByText("Supabase")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "儲存設定" }));
        await waitFor(() => expect(updateAiCostBudget).toHaveBeenCalled());
    });

    it("turns the progress warning red after the monthly budget is exceeded", async () => {
        getAiCostDashboard.mockResolvedValueOnce({
            ...dashboard,
            budget: { ...dashboard.budget, used_percent: 105, status: "over" }
        });
        render(<ApiUsageAdmin />);
        const progress = await screen.findByRole("progressbar", { name: "本月 API 預算使用率" });
        expect(progress.closest("section")).toHaveClass("api-budget-critical");
    });
});
