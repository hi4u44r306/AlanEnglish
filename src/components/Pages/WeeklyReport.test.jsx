import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import WeeklyReport from "./WeeklyReport";
import { useAuth } from "../../auth/AuthContext";
import { getWeeklyReport } from "../../services/weeklyReportService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/weeklyReportService", () => ({
    getWeeklyReport: jest.fn(),
    createWeeklyReportGuardianDraft: jest.fn()
}));
jest.mock("../../services/learningActivityService", () => ({
    markGuardianNotificationSent: jest.fn()
}));

const emptyDay = (date, weekday) => ({
    date,
    weekday,
    listening: 0,
    assignments: 0,
    ai: 0,
    review: 0,
    conversation: 0,
    speaking_challenge: 0,
    total: 0
});

const report = {
    student: { id: 7, name: "小安", class: "E3", plan: "academy" },
    guardian: { configured: false, name: "", email: "" },
    week: {
        start_date: "2026-09-14",
        end_date: "2026-09-20",
        can_go_next: false,
        can_go_previous: true
    },
    status: { code: "steady", label: "持續累積", message: "這週繼續進步。", score: 72 },
    comparison: { change: 2, text: "比上週多 2 次學習活動" },
    metrics: { active_days: 2, total_actions: 8, answer_accuracy: 80 },
    listening: { plays: 2, goal_days: 0 },
    assignments: { assigned: 1, completed: 1, attempts: 1, best_score: 90, completion_rate: 100 },
    ai_practice: { attempts: 1, average_score: 85, passed: 1 },
    review: { attempts: 1, mastered: 1, learning: 2, accuracy: 100, weaknesses: [] },
    conversation: { practice_steps: 1, completed_steps: 2, total_steps: 9 },
    speaking_challenge: {
        completed_questions: 2,
        completed_challenges: 1,
        all_time_completed_challenges: 3,
        xp_awarded: 30,
        ae_points_awarded: 3,
        current_challenge: {
            title: "P28 顏色",
            book_name: "Workbook 1",
            completed_questions: 5,
            total_questions: 5,
            progress_percent: 100,
            completed_at: "2026-09-18T03:00:00.000Z"
        },
        recent_clears: []
    },
    daily_breakdown: [
        { ...emptyDay("2026-09-14", "週一"), listening: 2, speaking_challenge: 2, total: 4 },
        emptyDay("2026-09-15", "週二"),
        emptyDay("2026-09-16", "週三"),
        emptyDay("2026-09-17", "週四"),
        emptyDay("2026-09-18", "週五"),
        emptyDay("2026-09-19", "週六"),
        emptyDay("2026-09-20", "週日")
    ],
    highlights: ["口說大挑戰通過 1 關，獲得 30 XP"],
    next_focus: ["保持目前節奏"],
    family_message: "本週完成口說大挑戰。"
};

test("每週成長報告獨立顯示口說大挑戰進度與實際獎勵", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "student-7" }, role: "student" });
    getWeeklyReport.mockResolvedValue({ report, students: [] });

    const { container } = render(
        <MemoryRouter
            initialEntries={["/student/weekly-report"]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <WeeklyReport />
        </MemoryRouter>
    );

    const challengeHeading = await screen.findByRole("heading", { name: "口說大挑戰" });
    const challengeCard = challengeHeading.closest("article");
    expect(challengeCard).toHaveTextContent("2 題新完成");
    expect(screen.getByText("本週通過 1 關，獲得 30 XP、3 AE Points")).toBeInTheDocument();
    expect(screen.getByText("Workbook 1")).toBeInTheDocument();
    expect(screen.getByText("P28 顏色")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /再次挑戰/ })).toHaveAttribute("href", "/student/speaking-challenges");
    expect(container.querySelector(".weekly-report-day__segment--speaking_challenge")).toBeInTheDocument();
});
