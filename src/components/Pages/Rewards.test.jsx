import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useAuth } from "../../auth/AuthContext";
import { getRewards } from "../../services/gamificationService";
import Rewards from "./Rewards";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({
    getRewards: jest.fn(),
    redeemReward: jest.fn()
}));

test("試用會員仍看得到累積點數，但兌換按鈕會被鎖定", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "trial-user" } });
    getRewards.mockResolvedValue({
        balance: { level: 2, total_xp: 120, points_balance: 50, next_level_xp: 250 },
        redemption_allowed: false,
        redemption_block_reason: "試用期間可以累積 XP 與 AE Points，升級正式方案後才能兌換獎品",
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
    expect(screen.getByText("試用期間可以累積 XP 與 AE Points，升級正式方案後才能兌換獎品")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "正式方案可兌換" })).toBeDisabled();
    expect(screen.getByText(/實體獎品 · 每 30 天限兌換一次/)).toBeInTheDocument();
});
