import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import WeeklyReportParent, { WeeklyAttention, WeeklySpeakingAttention } from "./WeeklyReportParent";

const days = ["一", "二", "三", "四", "五", "六", "日"].map((weekday, index) => ({ date: `2026-09-${14 + index}`, weekday: `週${weekday}`, total: index === 0 ? 3 : 0 }));
const report = (overrides = {}) => ({
    metrics: { active_days: 2 },
    listening: { plays: 5 },
    speaking_challenge: { completed_questions: 3 },
    assignments: { assigned: 2, completed: 1 },
    review: { mastered: 4 },
    next_focus: ["優先完成 1 份尚未完成的老師作業", "每天聽 3 次", "完成 1 題口說大挑戰", "不該出現的第四項"],
    daily_breakdown: days,
    attention: { available: true, since: "2026-10-19", tracked_listens: 9, idle_pauses: 2, hidden_pauses: 3, focus_rate: 64, level: "ok" },
    ...overrides
});

describe("WeeklyReportParent", () => {
    it("shows what a parent wants first: days, listens, spoken, homework, mastered and what to improve", () => {
        render(<WeeklyReportParent report={report()} />);
        expect(screen.getByText("作業完成")).toBeInTheDocument();
        expect(screen.getByText("1 / 2")).toBeInTheDocument();
        expect(screen.getByText(/智慧複習這週新學會/)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "還可以加強" })).toBeInTheDocument();
        expect(screen.getByText("優先完成 1 份尚未完成的老師作業")).toBeInTheDocument();
        expect(screen.queryByText("不該出現的第四項")).not.toBeInTheDocument();
    });

    it("explains focus in plain words with both kinds of pause", () => {
        render(<WeeklyAttention attention={report().attention} />);
        expect(screen.getByText("普通")).toBeInTheDocument();
        expect(screen.getByText("60%")).toBeInTheDocument();
        expect(screen.getByText(/放著不動、系統自動暫停/)).toHaveTextContent("2 次");
        expect(screen.getByText(/切換頁面造成暫停/)).toHaveTextContent("3 次");
        expect(screen.getByRole("progressbar", { name: "專注率" })).toHaveAttribute("aria-valuenow", "60");
    });

    it("asks for a reminder when focus is low", () => {
        render(<WeeklyAttention attention={{ ...report().attention, focus_rate: 21, level: "needs_reminder" }} />);
        expect(screen.getByText("需要提醒")).toBeInTheDocument();
        expect(screen.getByText(/建議陪伴孩子一起練習/)).toBeInTheDocument();
        expect(screen.getByText("20%")).toBeInTheDocument();
    });

    it("says when tracking has not started instead of showing a misleading score", () => {
        render(<WeeklyAttention attention={{ available: false, since: "2026-10-19", focus_rate: null, level: null }} />);
        expect(screen.getByText(/專注度從 10\/19 起的那一週開始記錄/)).toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("says there is not enough listening data when the rate cannot be worked out", () => {
        render(<WeeklyAttention attention={{ available: true, since: "2026-10-19", focus_rate: null, level: null, idle_pauses: 0, hidden_pauses: 0 }} />);
        expect(screen.getByText(/還沒有足夠的聆聽紀錄/)).toBeInTheDocument();
    });

    it("tells parents when there was no homework", () => {
        render(<WeeklyReportParent report={report({ assignments: { assigned: 0, completed: 0 } })} />);
        expect(screen.getByText("這週沒有作業")).toBeInTheDocument();
    });
});

test("口說專注度卡片：整十、三種中斷次數；還沒開始記錄就不顯示", () => {
    const { rerender, container } = render(<WeeklySpeakingAttention attention={{ available: true, focus_rate: 86, hidden_pauses: 2, idle_pauses: 1, left_prep: 1 }} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("專注")).toBeInTheDocument();
    expect(screen.getByText(/關卡中切換頁面/)).toHaveTextContent("2 次");
    expect(screen.getByText(/想離開聽力準備頁/)).toHaveTextContent("1 次");
    rerender(<WeeklySpeakingAttention attention={{ available: false, focus_rate: null }} />);
    expect(container).toBeEmptyDOMElement();
});
