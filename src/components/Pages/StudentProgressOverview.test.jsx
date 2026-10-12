import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentProgressOverview from "./StudentProgressOverview";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getBookPlaybackProgress } from "../../services/listeningService";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";
import { clearStudentPageCache, studentPageScope } from "../../services/studentPageCache";
import { saveStudentLearningResume } from "../../services/studentLearningResume";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/listeningService", () => ({ getBookPlaybackProgress: jest.fn() }));
jest.mock("../../services/speakingChallengeService", () => ({ getSpeakingChallengeCatalog: jest.fn() }));
jest.mock("../../services/assignmentService", () => ({ getStudentAssignments: jest.fn(), getStudentAssignmentsV2: jest.fn() }));

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
    getBookPlaybackProgress.mockResolvedValue({ progress: [], daily_count: 1 });
    getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [
        { id: 1, book: { id: 10, name: "Workbook 1" }, is_completed: true },
        { id: 2, book: { id: 10, name: "Workbook 1" }, is_completed: false },
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
    expect(screen.getByRole("link", { name: /作業.*還有 1 份/ })).toHaveAttribute("href", "/student/assignments");
    expect(screen.queryByText("已完成的作業")).not.toBeInTheDocument();
    // Right under the assignment: the page the student stopped at, as its own card.
    const listen = screen.getByRole("link", { name: "接著聽 Workbook 1 P22" });
    expect(listen).toHaveClass("student-progress__listen");
    expect(listen).toHaveAttribute("href", "/student/books/Workbook_1?resume=22");
});

test("a single unfinished assignment is not repeated as a row", async () => {
    useAuth.mockReturnValue(auth({ assignments: true, pronunciation: false }));
    getStudentAssignments.mockResolvedValue({ assignments: [{ id: 2, title: "這週的聽力", due_at: "2099-01-01T00:00:00Z", progress: {} }] });
    renderOverview();
    await screen.findByRole("link", { name: /這週的聽力/ });
    expect(screen.queryByRole("link", { name: /^作業/ })).not.toBeInTheDocument();
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

test("shows only speaking books in progress, with their level count", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: true }));
    renderOverview();
    const row = await screen.findByRole("link", { name: /Workbook 1.*1 \/ 2 關/ });
    expect(row).toHaveAttribute("href", "/student/speaking-challenges");
    expect(within(row).getByRole("progressbar", { name: "Workbook 1 口說進度" })).toHaveAttribute("value", "1");
    expect(screen.queryByText("Phonics 1")).not.toBeInTheDocument();
});

test("offers one speaking entry when no book has been started", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: true }));
    getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [{ id: 3, book: { id: 12, name: "Phonics 1" }, is_completed: false }] });
    renderOverview();
    expect(await screen.findByRole("link", { name: /口說大挑戰.*還沒開始/ })).toHaveAttribute("href", "/student/speaking-challenges");
});

test("says assignments are done, and does not hide a failed load", async () => {
    useAuth.mockReturnValue(auth({ assignments: true, pronunciation: false }));
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    const first = renderOverview();
    expect(await screen.findByRole("link", { name: /作業.*都完成了/ })).toBeInTheDocument();
    first.unmount();
    clearStudentPageCache();
    getStudentAssignmentsV2.mockRejectedValue(new Error("unavailable"));
    renderOverview();
    expect(await screen.findByText(/部分作業未能讀取/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /作業.*都完成了/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取" }));
    await waitFor(() => expect(getStudentAssignmentsV2).toHaveBeenCalledTimes(3));
});

test("shows today's listens against the daily goal, read from an unlocked book", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: false }, "customer"));
    renderOverview();
    const today = await screen.findByRole("status", { name: "今天聽了 1 首，目標 3 首" });
    expect(today).toHaveTextContent("1 / 3 首");
    expect(today.querySelectorAll(".student-progress__today-dots > .is-on")).toHaveLength(1);
    // Workbook 2 is locked, so the first unlocked book is the one asked for.
    expect(getBookPlaybackProgress).toHaveBeenCalledWith(expect.objectContaining({ uid: "customer" }), 10);
});

test("celebrates a met goal, and shows nothing rather than a made-up zero when the count is unknown", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: false }, "customer"));
    getBookPlaybackProgress.mockResolvedValue({ progress: [], daily_count: 5 });
    const first = renderOverview();
    const done = await screen.findByRole("status", { name: "今天聽了 5 首，今天的目標完成了" });
    expect(done).toHaveClass("is-done");
    expect(done).toHaveTextContent("今天的目標完成了！");
    first.unmount();
    clearStudentPageCache();
    getBookPlaybackProgress.mockRejectedValue(new Error("offline"));
    renderOverview();
    await screen.findByRole("button", { name: /選一本教材開始/ });
    await waitFor(() => expect(getBookPlaybackProgress).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/今天聽了/)).not.toBeInTheDocument();
});
