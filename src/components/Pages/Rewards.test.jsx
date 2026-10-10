import React from "react";
import { fireEvent, render as renderView, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { useAuth } from "../../auth/AuthContext";
import { getRewards, redeemReward } from "../../services/gamificationService";
import Rewards from "./Rewards";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({
    getRewards: jest.fn(),
    redeemReward: jest.fn()
}));

const render = element => renderView(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{element}</MemoryRouter>);
const academyAuth = () => useAuth.mockReturnValue({
    firebaseUser: { uid: "academy-user" },
    studentProfile: { learner_type: "academy_student", membership: { effective_access: { plan_codes: ["academy_internal"] } } }
});
const catalog = () => ({
    balance: { level: 2, total_xp: 120, points_balance: 50, next_level_xp: 250, progress_percent: 15 },
    redemption_allowed: true,
    rewards: [
        { id: 1, name: "小餅乾", points_cost: 40, stock_quantity: 5, fulfillment_type: "physical" },
        { id: 2, name: "筆記本", points_cost: 250, stock_quantity: 2, fulfillment_type: "physical" },
        { id: 3, name: "貼紙", points_cost: 10, stock_quantity: 0, fulfillment_type: "physical" }
    ],
    redemptions: []
});

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    getRewards.mockReset();
});

test("有效在校生可查看並兌換獎品", async () => {
    useAuth.mockReturnValue({
        firebaseUser: { uid: "academy-user" },
        studentProfile: {
            learner_type: "academy_student",
            membership: { effective_access: { plan_codes: ["academy_internal"] } }
        }
    });
    getRewards.mockResolvedValue({
        balance: { level: 2, total_xp: 120, points_balance: 50, next_level_xp: 250 },
        redemption_allowed: true,
        redemption_block_reason: null,
        rewards: [{
            id: 1,
            name: "小餅乾",
            description: "學習獎勵",
            points_cost: 40,
            stock_quantity: 5,
            fulfillment_type: "physical"
        }],
        redemptions: []
    });

    render(<Rewards />);

    expect(await screen.findByText("50 P")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "我要兌換" })).toBeEnabled();
    expect(screen.getByText(/實體獎品 · 每 30 天限兌換一次/)).toBeInTheDocument();
});

test("一般會員不載入獎品資料並顯示資格說明", async () => {
    useAuth.mockReturnValue({
        firebaseUser: { uid: "general-user" },
        studentProfile: {
            learner_type: "textbook_customer",
            membership: { effective_access: { plan_codes: ["basic_membership_monthly"] } }
        }
    });

    render(<Rewards />);

    expect(screen.getByRole("status")).toHaveTextContent("目前帳號沒有獎品商城資格");
    expect(getRewards).not.toHaveBeenCalled();
});

test("目標排除缺貨獎品，切換目標只改變頁面提示而不送出兌換", async () => {
    academyAuth();
    getRewards.mockResolvedValue(catalog());
    render(<Rewards />);
    const defaultGoal = await screen.findByRole("button", { name: "設小餅乾為我的目標" });
    expect(defaultGoal).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "設貼紙為我的目標" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "設筆記本為我的目標" }));
    expect(screen.getByRole("progressbar", { name: "距離筆記本的點數進度" })).toHaveAttribute("value", "20");
    expect(screen.getByRole("button", { name: "設筆記本為我的目標" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "還差 200 P" })).toBeDisabled();
    expect(redeemReward).not.toHaveBeenCalled();
});

test("讀取失敗不顯示虛假的零點數或空獎品，重試後顯示後端數據", async () => {
    academyAuth();
    getRewards.mockRejectedValueOnce(new Error("暫時無法連線")).mockResolvedValueOnce(catalog());
    render(<Rewards />);
    const retry = await screen.findByRole("button", { name: "重新讀取獎品" });
    expect(screen.queryByText("0 P")).not.toBeInTheDocument();
    expect(screen.queryByText(/新獎品準備好後/)).not.toBeInTheDocument();
    fireEvent.click(retry);
    expect(await screen.findByRole("button", { name: "我要兌換" })).toBeEnabled();
    expect(screen.getByText("50 P")).toBeInTheDocument();
});

test("重新讀取失敗時停止兌換舊資料，重試成功後恢復可操作狀態", async () => {
    academyAuth();
    getRewards.mockResolvedValueOnce(catalog()).mockRejectedValueOnce(new Error("讀取失敗")).mockResolvedValueOnce(catalog());
    render(<Rewards />);
    expect(await screen.findByRole("button", { name: "我要兌換" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    await screen.findByRole("button", { name: "重新讀取獎品" });
    expect(screen.getByRole("button", { name: "我要兌換" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取獎品" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "我要兌換" })).toBeEnabled());
    expect(redeemReward).not.toHaveBeenCalled();
});

test("確認兌換後依後端重讀點數與紀錄，累積 XP 保留", async () => {
    academyAuth();
    const after = catalog();
    after.balance.points_balance = 10;
    after.redemptions = [{ id: 99, reward_name: "小餅乾", points_cost: 40, status: "pending" }];
    getRewards.mockResolvedValueOnce(catalog()).mockResolvedValueOnce(after);
    redeemReward.mockResolvedValue({});
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    render(<Rewards />);
    fireEvent.click(await screen.findByRole("button", { name: "我要兌換" }));
    expect(await screen.findByText("等待老師確認")).toBeInTheDocument();
    expect(redeemReward).toHaveBeenCalledWith({ uid: "academy-user" }, 1);
    expect(within(screen.getByRole("region", { name: "我的成長" })).getByText("10 P")).toBeInTheDocument();
    expect(screen.getByText("120 XP")).toBeInTheDocument();
    confirm.mockRestore();
});


test("獎品目標在重開頁面後恢復，其他帳號各自選擇", async () => {
    academyAuth();
    getRewards.mockResolvedValue(catalog());
    const view = render(<Rewards />);
    fireEvent.click(await screen.findByRole("button", { name: "設筆記本為我的目標" }));
    view.unmount();
    const restored = render(<Rewards />);
    expect(await screen.findByRole("button", { name: "設筆記本為我的目標" })).toHaveAttribute("aria-pressed", "true");
    const context = useAuth();
    useAuth.mockReturnValue({ ...context, firebaseUser: { uid: "other-student" } });
    restored.rerender(<MemoryRouter><Rewards /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "設小餅乾為我的目標" })).toHaveAttribute("aria-pressed", "true");
    expect(redeemReward).not.toHaveBeenCalled();
});

test("LocalStorage 不可寫入時仍能選擇目標，沒有送出兌換", async () => {
    academyAuth();
    getRewards.mockResolvedValue(catalog());
    const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    render(<Rewards />);
    fireEvent.click(await screen.findByRole("button", { name: "設筆記本為我的目標" }));
    expect(screen.getByRole("button", { name: "設筆記本為我的目標" })).toHaveAttribute("aria-pressed", "true");
    expect(redeemReward).not.toHaveBeenCalled();
    storage.mockRestore();
});
