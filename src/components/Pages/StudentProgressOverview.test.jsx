import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentProgressOverview from "./StudentProgressOverview";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";
import { clearStudentPageCache, studentPageScope } from "../../services/studentPageCache";
import { saveStudentLearningResume } from "../../services/studentLearningResume";
import { getWeeklyReport } from "../../services/weeklyReportService";
import { getDashboardStats, getRecentListening } from "../../services/listeningService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/speakingChallengeService", () => ({ getSpeakingChallengeCatalog: jest.fn() }));
jest.mock("../../services/assignmentService", () => ({ getStudentAssignments: jest.fn(), getStudentAssignmentsV2: jest.fn() }));
jest.mock("../../services/weeklyReportService", () => ({ getWeeklyReport: jest.fn() }));
jest.mock("../../services/listeningService", () => ({ getRecentListening: jest.fn(), getDashboardStats: jest.fn() }));

const auth = (features, uid = "learner-a") => ({ firebaseUser: { uid }, role: "student", studentProfile: { membership: { is_active: true, effective_access: { features } } } });
const scopeOf = value => studentPageScope(value.firebaseUser, value.role, value.studentProfile);
const renderOverview = () => render(<MemoryRouter><StudentProgressOverview /></MemoryRouter>);

beforeEach(() => {
    clearStudentPageCache();
    localStorage.clear();
    jest.clearAllMocks();
    getAccessibleCatalog.mockResolvedValue({ categories: [{ id: 1, name: "Workbook", books: [
        { id: 10, code: "Workbook_1", name: "Workbook 1" },
        { id: 11, code: "Workbook_2", name: "Workbook 2", locked: true }
    ] }, { id: 2, name: "Phonics", books: [{ id: 12, code: "Phonics_1", name: "Phonics 1" }] }] });
    getStudentAssignments.mockResolvedValue({ assignments: [
        { id: 1, title: "過往任務", due_at: "2020-01-01T00:00:00Z", progress: {} },
        { id: 2, title: "這週的聽力", due_at: "2099-01-01T00:00:00Z", progress: {} },
        { id: 3, title: "已完成的作業", due_at: "2099-01-01T00:00:00Z", progress: { completed: true } }
    ] });
    getStudentAssignmentsV2.mockResolvedValue({ assignments: [] });
    getRecentListening.mockResolvedValue({ recent: [] });
    getDashboardStats.mockResolvedValue({ total_count: 1234 });
    getWeeklyReport.mockResolvedValue({ report: { attention: { available: false, focus_rate: null } } });
    getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [
        { id: 1, book: { id: 10, name: "Workbook 1" }, is_completed: true, sequence_order: 1, source_pages: [22] },
        { id: 2, book: { id: 10, name: "Workbook 1" }, is_completed: false, sequence_order: 2, source_pages: [23] },
        { id: 3, book: { id: 12, name: "Phonics 1" }, is_completed: false }
    ] });
});

const save = (student, book, track) => saveStudentLearningResume(scopeOf(student), book, track);

test("puts the next unfinished assignment on top as the one thing to do", async () => {
    const student = auth({ assignments: true, pronunciation: false });
    useAuth.mockReturnValue(student);
    save(student, { id: 10, code: "Workbook_1" }, { id: 22, title: "Unit 2", page: "P22" });
    renderOverview();
    const next = await screen.findByRole("link", { name: /這週的聽力/ });
    expect(next).toHaveClass("student-progress__next");
    expect(next).toHaveAttribute("href", "/student/assignments?task=v1-2");
    expect(next).toHaveTextContent("接下來：作業");
    const card = screen.getByRole("link", { name: /作業.*進行中 2 份/ });
    expect(card).toHaveAttribute("href", "/student/assignments");
    expect(card).toHaveTextContent("已完成 1 / 3");
    expect(within(card).getByRole("progressbar", { name: "作業完成進度" })).toHaveAttribute("value", "1");
    expect(screen.queryByText("已完成的作業")).not.toBeInTheDocument();
    // Right under the assignment: the page the student stopped at, as its own card.
    const listen = screen.getByRole("link", { name: "接著聽 Workbook 1 P22" });
    expect(listen).toHaveClass("student-progress__listen");
    expect(listen).toHaveAttribute("href", "/student/books/Workbook_1?resume=22");
});

test("a single unfinished assignment is still summarised in the 作業 card", async () => {
    useAuth.mockReturnValue(auth({ assignments: true, pronunciation: false }));
    getStudentAssignments.mockResolvedValue({ assignments: [{ id: 2, title: "這週的聽力", due_at: "2099-01-01T00:00:00Z", progress: {} }] });
    renderOverview();
    await screen.findByRole("link", { name: /這週的聽力/ });
    expect(screen.getByRole("link", { name: /^作業.*進行中 1 份/ })).toBeInTheDocument();
});

test("marks an overdue-only assignment clearly", async () => {
    useAuth.mockReturnValue(auth({ assignments: true, pronunciation: false }));
    getStudentAssignments.mockResolvedValue({ assignments: [{ id: 1, title: "過往任務", due_at: "2020-01-01T00:00:00Z", progress: {} }] });
    renderOverview();
    const next = await screen.findByRole("link", { name: /過往任務/ });
    expect(next).toHaveClass("is-overdue");
    expect(next).toHaveTextContent("作業遲交");
    expect(next).toHaveTextContent("請向老師確認補做方式");
});

test("without assignments the latest authorized book leads, and only that one", async () => {
    const student = auth({ assignments: false, pronunciation: false }, "customer");
    useAuth.mockReturnValue(student);
    save(student, { id: 10, code: "Workbook_1" }, { id: 22, title: "Unit 2", page: "P22" });
    save(student, { id: 11, code: "Workbook_2" }, { id: 30, title: "鎖定教材音檔" });
    save(student, { id: 12, code: "Phonics_1" }, { id: 5, title: "Phonics Unit 1" });
    renderOverview();
    const next = await screen.findByRole("link", { name: "接著聽 Phonics 1 Phonics Unit 1" });
    expect(next).toHaveAttribute("href", "/student/books/Phonics_1?resume=5");
    expect(screen.queryByText("P22")).not.toBeInTheDocument();
    expect(screen.queryByText("選一本教材開始")).not.toBeInTheDocument();
    expect(screen.queryByText(/鎖定教材音檔/)).not.toBeInTheDocument();
    expect(getStudentAssignments).not.toHaveBeenCalled();
    expect(getSpeakingChallengeCatalog).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /^作業/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /口說大挑戰/ })).not.toBeInTheDocument();
});

test("with nothing started the next action opens the materials chooser", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: false }, "customer"));
    renderOverview();
    const opened = jest.fn();
    window.addEventListener("ae:open-student-menu", opened);
    fireEvent.click(await screen.findByRole("button", { name: /選一本教材開始/ }));
    window.removeEventListener("ae:open-student-menu", opened);
    expect(opened.mock.calls[0][0].detail).toBe("materials");
});

test("口說卡只放一本做到一半的書，並寫出下一關", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: true }));
    renderOverview();
    const card = await screen.findByRole("link", { name: /口說大挑戰.*1 \/ 2 關/ });
    expect(card).toHaveAttribute("href", "/student/speaking-challenges/book/book-10");
    expect(card).toHaveTextContent("下一關：P.23");
    expect(within(card).getByRole("progressbar", { name: "Workbook 1 口說進度" })).toHaveAttribute("value", "1");
    expect(screen.queryByText("Phonics 1")).not.toBeInTheDocument();
});

test("沒有做到一半的書時，口說卡放第一本還沒做完的書", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: true }));
    getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [{ id: 3, book: { id: 12, name: "Phonics 1" }, is_completed: false, title: "01 字母歌" }] });
    renderOverview();
    const card = await screen.findByRole("link", { name: /口說大挑戰.*0 \/ 1 關/ });
    expect(card).toHaveAttribute("href", "/student/speaking-challenges/book/book-12");
    expect(card).toHaveTextContent("下一關：字母歌");
});

test("聽力卡顯示累計有效聆聽次數，讀不到時照實說", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: false }));
    const first = renderOverview();
    expect(await screen.findByText("累計聽了 1,234 次")).toBeInTheDocument();
    first.unmount();
    clearStudentPageCache();
    getDashboardStats.mockRejectedValue(new Error("unavailable"));
    renderOverview();
    expect(await screen.findByText("無法讀取")).toBeInTheDocument();
});

test("聽力卡有接著聽的音檔就直接帶過去，沒有就打開教材選單", async () => {
    const student = auth({ assignments: false, pronunciation: false });
    useAuth.mockReturnValue(student);
    save(student, { id: 10, code: "Workbook_1" }, { id: 22, title: "Unit 2", page: "P22" });
    const first = renderOverview();
    expect(await screen.findByRole("link", { name: /聽力.*累計聽了/ })).toHaveAttribute("href", "/student/books/Workbook_1?resume=22");
    first.unmount();
    localStorage.clear();
    clearStudentPageCache();
    renderOverview();
    const opened = jest.fn();
    window.addEventListener("ae:open-student-menu", opened);
    fireEvent.click(await screen.findByRole("button", { name: /聽力.*累計聽了/ }));
    window.removeEventListener("ae:open-student-menu", opened);
    expect(opened.mock.calls[0][0].detail).toBe("materials");
});

test("作業全部完成、沒有作業與讀取失敗各自照實顯示", async () => {
    useAuth.mockReturnValue(auth({ assignments: true, pronunciation: false }));
    getStudentAssignments.mockResolvedValue({ assignments: [{ id: 3, title: "已完成的作業", due_at: "2099-01-01T00:00:00Z", progress: { completed: true } }] });
    const done = renderOverview();
    expect(await screen.findByRole("link", { name: /作業.*都完成了/ })).toBeInTheDocument();
    done.unmount();
    clearStudentPageCache();
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    const none = renderOverview();
    expect(await screen.findByRole("link", { name: /作業.*目前沒有作業/ })).toBeInTheDocument();
    none.unmount();
    clearStudentPageCache();
    getStudentAssignmentsV2.mockRejectedValue(new Error("unavailable"));
    renderOverview();
    expect(await screen.findByText(/部分作業未能讀取/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /作業.*(都完成了|目前沒有作業)/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取" }));
    await waitFor(() => expect(getStudentAssignmentsV2).toHaveBeenCalledTimes(4));
});

test("每週報告列顯示本週專注度，數字四捨五入到整十；還沒有資料時不顯示", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: false }));
    getWeeklyReport.mockResolvedValue({ report: { attention: { available: true, focus_rate: 94 } } });
    renderOverview();
    expect(await screen.findByRole("link", { name: /每週報告.*本週專注度 90%/ })).toHaveAttribute("href", "/student/weekly-report");
});

test("專注度還沒開始記錄時，每週報告列不顯示數字", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: false }));
    renderOverview();
    await waitFor(() => expect(getWeeklyReport).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /每週報告/ })).not.toHaveTextContent("專注度");
});

test("接著聽：登出清掉本機紀錄後，仍從伺服器記得最近完整聽過的一首", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: false }));
    getRecentListening.mockResolvedValue({ recent: [
        { book_id: 10, book_code: "Workbook_1", track_id: 22, track_title: "Unit 2", page: "P22", last_played_at: "2020-01-05T00:00:00Z" },
        { book_id: 11, book_code: "Workbook_2", track_id: 5, track_title: "鎖住的書", page: "P1", last_played_at: "2026-10-01T00:00:00Z" }
    ] });
    renderOverview();
    const listen = await screen.findByRole("link", { name: "接著聽 Workbook 1 P22" });
    expect(listen).toHaveAttribute("href", "/student/books/Workbook_1?resume=22");
    expect(screen.queryByText("鎖住的書")).not.toBeInTheDocument();
});

test("接著聽：本機比伺服器新時用本機的", async () => {
    const student = auth({ assignments: false, pronunciation: false });
    useAuth.mockReturnValue(student);
    getRecentListening.mockResolvedValue({ recent: [
        { book_id: 10, book_code: "Workbook_1", track_id: 22, track_title: "Unit 2", page: "P22", last_played_at: "2020-01-05T00:00:00Z" }
    ] });
    save(student, { id: 10, code: "Workbook_1" }, { id: 30, title: "Unit 9", page: "P30" });
    renderOverview();
    expect(await screen.findByRole("link", { name: "接著聽 Workbook 1 P30" })).toHaveAttribute("href", "/student/books/Workbook_1?resume=30");
});
