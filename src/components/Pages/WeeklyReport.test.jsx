import { clearStudentPageCache } from "../../services/studentPageCache";
beforeEach(() => clearStudentPageCache());
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import WeeklyReport from "./WeeklyReport";
import WeeklyReportOverview from "./WeeklyReportOverview";
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
    generated_at: "2026-09-20T08:00:00Z",
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
    expect(screen.getByRole("link", { name: "查看口說功能權限" })).toHaveAttribute("href", "/student/membership");
    expect(screen.queryByRole("link", { name: /再次挑戰|繼續挑戰/ })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "每日有效聆聽折線圖" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "口說大挑戰累計進度折線圖" })).toBeInTheDocument();
    expect(container.querySelector(".weekly-report-day__segment--speaking_challenge")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "目前口說關卡完成率" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.queryByRole("heading", { name: "AI 專屬練習" })).not.toBeInTheDocument();
    const listening = screen.getByRole("region", { name: "每日有效聆聽" });
    fireEvent.click(within(listening).getByRole("button", { name: "週一 2026-09-14，2 次" }));
    expect(within(listening).getByRole("status")).toHaveTextContent("週一（2026-09-14）：2 次");
    const speaking = screen.getByRole("region", { name: "口說大挑戰累計進度" });
    expect(within(speaking).getByRole("button", { name: "週二 2026-09-15，2 題" })).toBeInTheDocument();
});

test("週報切換週次後重新取得該週的統計", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "student-7" }, role: "student" });
    getWeeklyReport.mockResolvedValue({ report, students: [] });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WeeklyReport /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "查看前一週" }));
    await screen.findByRole("img", { name: "每日有效聆聽折線圖" });
    expect(getWeeklyReport).toHaveBeenLastCalledWith(expect.anything(), { studentId: undefined, weekOffset: -1 });
});

test("讀取失敗顯示錯誤與重試，不能當作零次週報", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "student-7" }, role: "student" });
    getWeeklyReport.mockRejectedValue(new Error("報表服務暫時無法連線"));
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WeeklyReport /></MemoryRouter>);
    expect(await screen.findByText("報表服務暫時無法連線")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重新整理/ })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "每日有效聆聽折線圖" })).not.toBeInTheDocument();
});

test("先呈現週報摘要與既有練習方向，分享文字不藏在收合區", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "student-7" }, role: "student" });
    getWeeklyReport.mockResolvedValue({ report, students: [] });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WeeklyReport /></MemoryRouter>);
    const overview = await screen.findByRole("region", { name: "本週學習摘要" });
    expect(within(overview).getByText("2 次")).toBeInTheDocument();
    expect(within(overview).getByText("2 題")).toBeInTheDocument();
    expect(within(overview).getByText("保持目前節奏")).toBeInTheDocument();
    expect(overview.compareDocumentPosition(screen.getByRole("img", { name: "每日有效聆聽折線圖" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const family = screen.getByRole("region", { name: "家長文字摘要與分享" });
    expect(family.closest("details")).toBeNull();
    expect(within(family).getByText(report.family_message)).toBeVisible();
    expect(screen.getByRole("link", { name: "文字摘要與分享" })).toHaveAttribute("href", `#${family.id}`);
    expect(screen.getByRole("link", { name: "查看每日圖表" })).toHaveAttribute("href", "#weekly-report-trends");
    expect(screen.queryByRole("button", { name: "寄給家長" })).not.toBeInTheDocument();
});

test("已確認零次與缺少資料分開顯示，不推論成績或編造練習建議", () => {
    const { rerender } = render(<WeeklyReportOverview report={{ listening: { plays: 0 }, speaking_challenge: { completed_questions: 0, completed_challenges: 0, all_time_completed_challenges: 0 }, next_focus: [] }} />);
    expect(screen.getByText("0 次")).toBeInTheDocument();
    expect(screen.getByText("0 題")).toBeInTheDocument();
    expect(screen.queryByText("尚無資料")).not.toBeInTheDocument();
    expect(screen.getByText("目前沒有練習建議，先查看下方的學習紀錄。")).toBeInTheDocument();
    rerender(<WeeklyReportOverview report={{ listening: { plays: null }, speaking_challenge: { completed_questions: -1, completed_challenges: Infinity }, next_focus: [] }} />);
    expect(screen.getAllByText("尚無資料")).toHaveLength(4);
    expect(screen.queryByText("0 次")).not.toBeInTheDocument();
    expect(screen.queryByText("0 題")).not.toBeInTheDocument();
});

test("舊報告缺少口說欄位時不顯示虛假零題與通關獎勵", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "student-7" }, role: "student" });
    getWeeklyReport.mockResolvedValue({ report: { ...report, speaking_challenge: undefined }, students: [] });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WeeklyReport /></MemoryRouter>);
    const heading = await screen.findByRole("heading", { name: "口說大挑戰" });
    expect(heading.closest("article")).toHaveTextContent("本週口說紀錄尚無資料");
    expect(heading.closest("article")).not.toHaveTextContent("0 題新完成");
    expect(heading.closest("article")).not.toHaveTextContent("通關獎勵");
    expect(screen.getByRole("link", { name: "查看口說功能權限" })).toHaveAttribute("href", "/student/membership");
});

test("老師仍能切換學生，未設定家長信箱時不能準備寄信", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "teacher-test" }, role: "teacher" });
    getWeeklyReport.mockResolvedValue({ report, students: [{ id: 7, name: "小安", class: "E3" }, { id: 8, name: "小樂", class: "E1" }] });
    render(<MemoryRouter initialEntries={["/teacher/weekly-report?student=7"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WeeklyReport /></MemoryRouter>);
    const selector = await screen.findByRole("combobox");
    expect(screen.getByRole("button", { name: "寄給家長" })).toBeDisabled();
    fireEvent.change(selector, { target: { value: "8" } });
    await waitFor(() => expect(getWeeklyReport).toHaveBeenLastCalledWith(expect.anything(), { studentId: "8", weekOffset: 0 }));
});
