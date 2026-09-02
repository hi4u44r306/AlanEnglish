import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ListeningRewardFeedback from "./ListeningRewardFeedback";

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
