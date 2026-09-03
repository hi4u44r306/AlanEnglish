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
