import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ListeningRewardFeedback from "./ListeningRewardFeedback";

test.each([
    [{ source: "self_practice", mastery_count: 9 }, "自主熟練度 9/10 次", "累計 10 次可得 10 XP"],
    [{ source: "self_practice", mastery_count: 10, mastery_rewarded: true }, "本音檔熟練獎勵已領取", "仍可繼續練習"],
    [{ source: "self_practice", mastery_count: 10, limit_reached: true }, "自主熟練度 10/10 次", "隔天再有效聽一次"],
    [{ source: "assignment", valid_listen_count: 2, required_listens: 3 }, "老師指定 2/3 次", "不另計自主獎勵"],
    [{ source: "assignment", valid_listen_count: 3, required_listens: 3, completion_reward_granted: true }, "老師指定 3/3 次", "整份作業完成：+30 XP、+5 AE Points"]
])("新版獎勵狀態呈現：%s", (status, title, detail) => {
    render(<ListeningRewardFeedback reward={{
        policy_version: 3, reward_status: { policy_version: 3, ...status },
        daily_rewarded_tracks: 1, daily_track_limit: 3
    }} onDismiss={jest.fn()} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(detail.replaceAll("+", "\\+")))).toBeInTheDocument();
    expect(screen.queryByText("這首今天已領過獎勵")).not.toBeInTheDocument();
});

test("第10次自主熟練顯示10XP與1點", () => {
    render(<ListeningRewardFeedback reward={{
        eligible: true, listening_xp_added: 10, listening_points_added: 1,
        reward_status: { policy_version: 3, source: "self_practice", mastery_count: 10, mastery_rewarded: true },
        daily_rewarded_tracks: 1, daily_track_limit: 3
    }} onDismiss={jest.fn()} />);
    expect(screen.getByText("自主熟練達成 +10 XP")).toBeInTheDocument();
    expect(screen.getByText("獲得 +1 AE Point，每檔熟練獎勵限領一次")).toBeInTheDocument();
});

test("有效聆聽會顯示 XP、點數進度與每日上限", () => {
    render(<ListeningRewardFeedback reward={{
        eligible: true,
        listening_xp_added: 5,
        listening_points_added: 0,
        next_point_in: 2,
        daily_rewarded_tracks: 3,
        daily_track_limit: 10,
        levels_gained: []
    }} onDismiss={jest.fn()} />);

    expect(screen.getByText("有效聆聽 +5 XP")).toBeInTheDocument();
    expect(screen.getByText("再聽 2 首不同音檔可得 1 點")).toBeInTheDocument();
    expect(screen.getByText("今日 3 / 10 首")).toBeInTheDocument();
});

test("升等會顯示一次性 AE Points 動畫並可關閉", () => {
    const onDismiss = jest.fn();
    render(<ListeningRewardFeedback reward={{
        total_xp_added: 5,
        level_before: 1,
        level_after: 2,
        level_points_added: 5,
        levels_gained: [{ level: 2, points: 5 }]
    }} onDismiss={onDismiss} />);

    expect(screen.getByRole("dialog", { name: "升等成功" })).toBeInTheDocument();
    expect(screen.getByText("Lv.2")).toBeInTheDocument();
    expect(screen.getByText("+5 AE Points")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "繼續學習" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
});
