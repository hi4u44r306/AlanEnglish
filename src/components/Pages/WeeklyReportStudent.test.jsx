import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeeklyReportStudent from "./WeeklyReportStudent";

const week = active => ["一", "二", "三", "四", "五", "六", "日"].map((label, index) => ({
    date: `2020-01-${String(6 + index).padStart(2, "0")}`, weekday: `週${label}`, total: active.includes(index) ? 2 : 0
}));
const report = overrides => ({
    metrics: { active_days: 3 }, listening: { plays: 12 }, speaking_challenge: { completed_questions: 9 },
    assignments: { assigned: 2, completed: 1 }, daily_breakdown: week([0, 2, 3]), ...overrides
});

test("shows the week as three numbers: days, listens and sentences spoken", () => {
    render(<WeeklyReportStudent report={report()} />);
    const tiles = screen.getAllByRole("listitem").slice(0, 3).map(item => item.textContent);
    expect(tiles).toEqual(["學了3天", "聽了12次", "會說9句"]);
    expect(screen.getByText("作業完成")).toHaveTextContent("作業完成 1 / 2");
});

test("marks which days had any learning", () => {
    render(<WeeklyReportStudent report={report()} />);
    expect(screen.getByLabelText("週一有學習")).toHaveClass("is-active");
    expect(screen.getByLabelText("週二沒有學習")).not.toHaveClass("is-active");
    expect(document.querySelectorAll(".weekly-student__days .is-active")).toHaveLength(3);
});

test("shows a dash, never a made-up zero, when a figure is missing, and no homework line without homework", () => {
    render(<WeeklyReportStudent report={report({ speaking_challenge: null, assignments: { assigned: 0, completed: 0 }, daily_breakdown: [] })} />);
    expect(screen.getAllByRole("listitem")[2]).toHaveTextContent("會說—句");
    expect(screen.queryByText("作業完成")).not.toBeInTheDocument();
    expect(document.querySelector(".weekly-student__days")).toBeNull();
});

test("孩子的每週報告顯示整十的專注度與鼓勵話；老師版可以關掉", () => {
    const { rerender } = render(<WeeklyReportStudent report={report({ attention: { available: true, focus_rate: 95 } })} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("很專心，繼續保持！")).toBeInTheDocument();
    rerender(<WeeklyReportStudent report={report({ attention: { available: true, focus_rate: 34 } })} />);
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText(/要加油/)).toBeInTheDocument();
    rerender(<WeeklyReportStudent report={report({ attention: { available: true, focus_rate: 95 } })} showAttention={false} />);
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    rerender(<WeeklyReportStudent report={report({ attention: { available: false, focus_rate: null } })} />);
    expect(screen.queryByText(/專注度/)).not.toBeInTheDocument();
});
