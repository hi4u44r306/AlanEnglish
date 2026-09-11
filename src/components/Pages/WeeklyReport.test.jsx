import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import WeeklyReport from "./WeeklyReport";
import { getWeeklyReport } from "../../services/weeklyReportService";

const mockFirebaseUser = { getIdToken: jest.fn() };

jest.mock("../../auth/AuthContext", () => ({
    useAuth: () => ({ firebaseUser: mockFirebaseUser, role: "student" })
}));
jest.mock("../../services/weeklyReportService", () => ({
    getWeeklyReport: jest.fn(),
    createWeeklyReportGuardianDraft: jest.fn()
}));
jest.mock("../../services/learningActivityService", () => ({
    markGuardianNotificationSent: jest.fn()
}));

const report = {
    student: { id: 1, name: "小安", class: "E1", plan: "trial" },
    guardian: { configured: false, name: "", email: "", notification_enabled: false },
    week: { start_date: "2026-09-07", end_date: "2026-09-13", can_go_previous: true, can_go_next: false },
    status: { code: "steady", label: "穩定累積中", message: "保持每天一點點的節奏。", score: 62 },
    comparison: { change: 2, text: "比上週多 2 次學習活動" },
    metrics: { active_days: 3, total_actions: 8, answer_accuracy: 88 },
    listening: { plays: 4, goal_days: 1 },
    assignments: { assigned: 1, completed: 1, completion_rate: 100, attempts: 1, best_score: 100 },
    ai_practice: { attempts: 1, average_score: 90, passed: 1 },
    review: { attempts: 1, mastered: 1, learning: 2, accuracy: 100, weaknesses: [] },
    conversation: { practice_steps: 1, completed_steps: 2, total_steps: 9 },
    daily_breakdown: [{ date: "2026-09-07", weekday: "週一", total: 1 }],
    highlights: ["維持 3 天學習節奏"],
    next_focus: ["下週固定 3 天練習"],
    family_message: "家長您好：這是小安的學習摘要。"
};

describe("WeeklyReport", () => {
    beforeEach(() => {
        getWeeklyReport.mockResolvedValue({ report });
    });

    it("renders a parent-ready report for the signed-in student without exposing email delivery", async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <WeeklyReport />
            </MemoryRouter>
        );

        expect(await screen.findByRole("heading", { name: /小安.*家長學習報告/ })).toBeInTheDocument();
        expect(screen.getByText("家長看得懂的學習摘要")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "複製家長版" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "列印／存 PDF" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "寄給家長" })).not.toBeInTheDocument();
        expect(getWeeklyReport).toHaveBeenCalledWith(expect.anything(), {
            studentId: undefined,
            weekOffset: 0
        });
    });
});
