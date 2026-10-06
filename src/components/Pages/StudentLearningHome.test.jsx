import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentLearningHome from "./StudentLearningHome";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({ getGamificationSummary: jest.fn() }));
jest.mock("../../services/assignmentService", () => ({ getStudentAssignments: jest.fn(), getStudentAssignmentsV2: jest.fn() }));

const renderHome = () => render(<MemoryRouter><StudentLearningHome /></MemoryRouter>);
const profile = assignments => ({ name: "小探險家", learner_type: assignments ? "academy_student" : "textbook_customer", membership: { is_active: true, effective_access: { features: { assignments, pronunciation: false } } } });

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ firebaseUser: { uid: "learner-a" }, role: "student", studentProfile: profile(true) });
    getAccessibleCatalog.mockResolvedValue({ categories: [
        { id: 1, name: "Workbook", books: [{ id: 10, code: "Workbook_1", name: "Workbook 1" }, { id: 11, code: "Workbook_2", name: "未授權教材", locked: true }] },
        { id: 2, name: "Phonics", books: [{ id: 12, code: "Phonics_1", name: "Phonics 1" }] }
    ] });
    getGamificationSummary.mockResolvedValue({ balance: { level: 2, total_xp: 180, next_level_xp: 250, progress_percent: 53 } });
    getStudentAssignments.mockResolvedValue({ assignments: [
        { id: 1, title: "過往任務", due_at: "2020-01-01T00:00:00Z", progress: {} },
        { id: 2, title: "這週的聽力", due_at: "2099-01-01T00:00:00Z", progress: {} }
    ] });
    getStudentAssignmentsV2.mockResolvedValue({ assignments: [] });
});

test("recommends an active task, keeps overdue tasks separate, and preserves the task destination", async () => {
    renderHome();
    expect(await screen.findByRole("link", { name: "打開這份任務" })).toHaveAttribute("href", "/student/assignments?task=v1-2");
    expect(screen.queryByText("過往任務")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "已逾期 1" }));
    expect(screen.getByRole("link", { name: /過往任務/ })).toHaveAttribute("href", "/student/assignments?task=v1-1");
});

test("searches and filters the authorized shelf without showing locked books", async () => {
    renderHome();
    await screen.findByRole("link", { name: /Workbook Workbook 1/ });
    expect(screen.queryByText("未授權教材")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "搜尋我的教材" }), { target: { value: "Phonics" } });
    expect(screen.getByRole("link", { name: /Phonics 1/ })).toHaveAttribute("href", "/student/books/Phonics_1");
    expect(screen.queryByRole("link", { name: /Workbook Workbook 1/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "找不到" } });
    fireEvent.click(screen.getByRole("button", { name: "顯示全部教材" }));
    expect(screen.getByRole("link", { name: /Workbook Workbook 1/ })).toBeInTheDocument();
});

test("does not request or expose assignments to a textbook customer", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "customer" }, role: "student", studentProfile: profile(false) });
    renderHome();
    await screen.findByRole("link", { name: "打開 Workbook 1" });
    expect(getStudentAssignments).not.toHaveBeenCalled();
    expect(getStudentAssignmentsV2).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "老師的任務" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /口說冒險/ })).not.toBeInTheDocument();
});

test("does not turn a partial assignment failure into an all-complete message", async () => {
    getStudentAssignmentsV2.mockRejectedValue(new Error("unavailable"));
    renderHome();
    await screen.findByText(/這裡可能不是完整清單/);
    fireEvent.click(screen.getByRole("button", { name: "已完成", exact: true }));
    expect(screen.queryByText("完成的任務會出現在這裡。")).not.toBeInTheDocument();
});

test("keeps independent sections usable and lets the student retry a catalog failure", async () => {
    getAccessibleCatalog.mockRejectedValueOnce(new Error("unavailable"));
    getGamificationSummary.mockRejectedValueOnce(new Error("unavailable"));
    renderHome();
    await screen.findByRole("link", { name: "打開這份任務" });
    expect(screen.queryByText("0 XP")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取教材" }));
    await screen.findByRole("link", { name: /Workbook Workbook 1/ });
    expect(getAccessibleCatalog).toHaveBeenCalledTimes(2);
});

test("discards a previous learner's late response after switching accounts", async () => {
    let resolveCatalog;
    getAccessibleCatalog.mockImplementationOnce(() => new Promise(resolve => { resolveCatalog = resolve; }));
    const view = renderHome();
    useAuth.mockReturnValue({ firebaseUser: { uid: "learner-b" }, role: "student", studentProfile: profile(false) });
    view.rerender(<MemoryRouter><StudentLearningHome /></MemoryRouter>);
    await screen.findByRole("link", { name: "打開 Workbook 1" });
    resolveCatalog({ categories: [{ id: 99, name: "old", books: [{ code: "old", name: "前一個帳號的教材" }] }] });
    await waitFor(() => expect(screen.queryByText("前一個帳號的教材")).not.toBeInTheDocument());
});
