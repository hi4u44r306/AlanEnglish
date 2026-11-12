import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LearningStreakCard from "./LearningStreakCard";
import { STREAK_BADGES, getStreakBadgeState } from "../../utils/learningStreakBadges";

const week = statuses => statuses.map((status, index) => ({ date: `2026-11-${String(9 + index).padStart(2, "0")}`, status }));

describe("getStreakBadgeState", () => {
    test("不到 3 天沒有徽章，下一枚是 3 天", () => {
        const state = getStreakBadgeState({ current: 2, longest: 2 });
        expect(state.top).toBeNull();
        expect(state.next.days).toBe(3);
        expect(state.remaining).toBe(1);
    });

    test("連續 8 天拿到 7 天徽章，下一枚是 14 天（還差 6 天）", () => {
        const state = getStreakBadgeState({ current: 8, longest: 8 });
        expect(state.top.days).toBe(7);
        expect(state.next.days).toBe(14);
        expect(state.remaining).toBe(6);
    });

    test("中斷後歷史最長仍保留已拿過的徽章", () => {
        const state = getStreakBadgeState({ current: 1, longest: 120 });
        expect(state.top.days).toBe(100);
        expect(state.earned.map(badge => badge.days)).toEqual([3, 7, 14, 30, 60, 100]);
        expect(state.next.days).toBe(3);
    });

    test("超過 365 天只留最後一枚，沒有下一枚", () => {
        const state = getStreakBadgeState({ current: 412, longest: 412 });
        expect(state.top.days).toBe(365);
        expect(state.next).toBeNull();
    });

    test("壞資料一律當作 0", () => {
        expect(getStreakBadgeState({ current: "abc", longest: -5 }).current).toBe(0);
        expect(getStreakBadgeState(null).top).toBeNull();
    });

    test("共有 8 枚徽章，天數由小到大", () => {
        expect(STREAK_BADGES.map(badge => badge.days)).toEqual([3, 7, 14, 30, 60, 100, 180, 365]);
    });
});

describe("LearningStreakCard", () => {
    test("沒有資料（讀取失敗）時整張卡不顯示", () => {
        const { container } = render(<LearningStreakCard streak={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    test("顯示目前連續天數、下一枚徽章與本週狀況", () => {
        render(<LearningStreakCard streak={{ current: 8, longest: 8, today_done: true, week: week(["done", "done", "shield", "done", "done", "done", "future"]) }} />);
        expect(screen.getByText("連續 8 天")).toBeInTheDocument();
        expect(screen.getByText(/再 6 天拿到「兩週達人」徽章/)).toBeInTheDocument();
        expect(screen.getByAltText("一週達人徽章，7 天")).toBeInTheDocument();
        expect(screen.getByLabelText("本週練習狀況").querySelectorAll("li")).toHaveLength(7);
        expect(screen.getByLabelText("免死金牌")).toHaveTextContent("盾");
    });

    test("今天還沒練習會提醒；歷史最長比目前高時一併顯示", () => {
        render(<LearningStreakCard streak={{ current: 2, longest: 20, today_done: false, week: week(["done", "done", "today", "future", "future", "future", "future"]) }} />);
        expect(screen.getByText("今天練習一下，連續就不會中斷。")).toBeInTheDocument();
        expect(screen.getByText("歷史最長：連續 20 天")).toBeInTheDocument();
    });

    test("「看全部徽章」可以展開、收起，沒拿到的標示為尚未達成", () => {
        render(<LearningStreakCard streak={{ current: 8, longest: 8, today_done: true, week: [] }} />);
        const toggle = screen.getByRole("button", { name: "看全部徽章" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(toggle);
        expect(screen.getByRole("button", { name: "收起全部徽章" })).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("7 天 已拿到")).toBeInTheDocument();
        expect(screen.getByText("365 天")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "收起全部徽章" }));
        expect(screen.queryByText("7 天 已拿到")).not.toBeInTheDocument();
    });
});
