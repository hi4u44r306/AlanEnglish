import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { REWARD_SHOP_ENABLED } from "./rewardShop";
import { listeningRewardText } from "../utils/listeningRewardText";
import StudentGrowthHeader from "../components/fragment/StudentGrowthHeader";

// The shipped default: no prize shop, and nothing a student reads mentions AE Points.
test("the prize shop ships switched off", () => {
    expect(REWARD_SHOP_ENABLED).toBe(false);
});

test("listening progress text promises experience only", () => {
    const own = listeningRewardText({ policy_version: 3, source: "self", mastery_count: 6 });
    expect(own.title).toBe("已聽 6 / 30 次");
    expect(own.detail).toBe("累計 30 次可得 10 XP（每檔限領一次）");
    const homework = listeningRewardText({ policy_version: 3, source: "assignment", valid_listen_count: 3, required_listens: 3, completion_reward_granted: true });
    expect(homework.detail).toBe("整份作業完成：+30 XP");
});

test("the student header shows the level without a points button", () => {
    render(<MemoryRouter><StudentGrowthHeader summary={{ balance: { level: 2, total_xp: 120, points_balance: 107 } }} pointsAccess /></MemoryRouter>);
    expect(screen.getByText("Lv.2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /點數/ })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("AE Points");
});
