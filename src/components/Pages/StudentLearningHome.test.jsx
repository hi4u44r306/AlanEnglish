import { clearStudentPageCache } from "../../services/studentPageCache";
beforeEach(() => clearStudentPageCache());
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentLearningHome from "./StudentLearningHome";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";
import { cacheStudentAvatarDisplayUrl } from "../../constants/studentAvatarCache";
import { loadStudentCommerceProfile } from "../../services/commerceService";
import { studentPageScope } from "../../services/studentPageCache";
import { saveStudentLearningResume } from "../../services/studentLearningResume";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/gamificationService", () => ({ getGamificationSummary: jest.fn() }));
jest.mock("../../services/assignmentService", () => ({ getStudentAssignments: jest.fn(), getStudentAssignmentsV2: jest.fn() }));
jest.mock("../../services/commerceService", () => ({ loadStudentCommerceProfile: jest.fn() }));

const renderHome = () => render(<MemoryRouter><StudentLearningHome /></MemoryRouter>);
const profile = assignments => ({ name: "小探險家", learner_type: assignments ? "academy_student" : "textbook_customer", membership: { is_active: true, effective_access: { features: { assignments, pronunciation: false } } } });

beforeEach(() => {
    localStorage.clear();
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
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        enrollment_status: "active",
        current_enrollment: { status: "active", academy_classes: { code: "E5" } },
        class_books: [{ id: 10, code: "Workbook_1", name: "Workbook 1" }]
    } });
});

test("shows the current student's local avatar pixels immediately on the home page", async () => {
    await cacheStudentAvatarDisplayUrl("https://example.com/photo.webp", {
        ownerUid: "learner-a", sourceKey: "avatars/photo.webp",
        previewBlob: new Blob(["avatar"], { type: "image/webp" })
    });
    useAuth.mockReturnValue({ firebaseUser: { uid: "learner-a" }, role: "student", studentProfile: { ...profile(true), user_image: "avatars/photo.webp" } });
    const view = renderHome();
    expect(view.container.querySelector(".ae-student-avatar-image img").getAttribute("src")).toMatch(/^data:image\/webp/);
    await screen.findByRole("link", { name: "打開這份任務" });
});

test("the material shelf appears without waiting for slow summary or assignment responses", async () => {
    getGamificationSummary.mockReturnValue(new Promise(() => {}));
    getStudentAssignments.mockReturnValue(new Promise(() => {}));
    getStudentAssignmentsV2.mockReturnValue(new Promise(() => {}));
    renderHome();
    expect(await screen.findByRole("link", { name: /Workbook Workbook 1/ })).toBeInTheDocument();
    expect(screen.getByText("正在整理作業…")).toBeInTheDocument();
    expect(screen.getByText("正在讀取成長資料…")).toBeInTheDocument();
});

test("returning to the home renders the existing shelf and tasks synchronously", async () => {
    const first = renderHome();
    await screen.findByRole("link", { name: "打開這份任務" });
    await screen.findByText("180 XP");
    first.unmount();
    renderHome();
    expect(screen.getByRole("link", { name: /Workbook Workbook 1/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打開這份任務" })).toBeInTheDocument();
    await waitFor(() => expect(getAccessibleCatalog).toHaveBeenCalledTimes(1));
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
    expect(loadStudentCommerceProfile).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /目前.*教材/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "老師的任務" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /口說冒險/ })).not.toBeInTheDocument();
});

test("a slow class lookup does not block the other shelf and keeps refresh busy", async () => {
    loadStudentCommerceProfile.mockImplementation(() => new Promise(() => {}));
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    renderHome();
    await screen.findByRole("link", { name: /Workbook Workbook 1/ });
    expect(screen.getByText("正在讀取目前班級教材…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新整理學習進度" })).toBeDisabled();
});

test("opens the current class material from the mission without a duplicate class shelf", async () => {
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        enrollment_status: "active", current_enrollment: { status: "active", academy_classes: { code: "E3" } },
        class_books: [{ id: 12, code: "Phonics_1", name: "Phonics 1" }],
        direct_entitlements: [{ source: "academy_history", books: { id: 10, name: "Workbook 1" } }]
    } });
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    const view = renderHome();
    expect(await screen.findByRole("link", { name: "打開 Phonics 1" })).toHaveAttribute("href", "/student/books/Phonics_1");
    expect(screen.getByRole("heading", { name: "一起學習 Phonics 1" })).toBeInTheDocument();
    expect(view.container.querySelector(".learning-home__class-books")).toBeNull();
    expect(screen.queryByRole("region", { name: "E3 班目前學習的教材" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "我的教材小書架" })).getByText("Workbook 1")).toBeInTheDocument();
});

test("keeps assignment priority and only links class books authorized by the catalog", async () => {
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        enrollment_status: "active", current_enrollment: { status: "active", academy_classes: { code: "E5" } },
        class_books: [{ id: 10, name: "Workbook 1" }, { id: 11, name: "未授權教材" }, { id: 99, name: "停用教材" }]
    } });
    renderHome();
    expect(await screen.findByRole("link", { name: "打開這份任務" })).toHaveAttribute("href", "/student/assignments?task=v1-2");
    expect(screen.queryByRole("link", { name: /未授權教材|停用教材/ })).not.toBeInTheDocument();
});

test("does not label paused or departed enrollment materials as currently learning", async () => {
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        enrollment_status: "departed", current_enrollment: null,
        class_books: [{ id: 10, name: "Workbook 1" }]
    } });
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    renderHome();
    await screen.findByText(/目前沒有有效在校班級/);
    expect(screen.queryByRole("link", { name: "打開 Workbook 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看我的教材" })).toHaveAttribute("href", "#learning-books");
});

test("updates the mission after settings change, preserves it offline and clears denied data", async () => {
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    renderHome();
    await screen.findByRole("link", { name: "打開 Workbook 1" });
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        enrollment_status: "active", current_enrollment: { status: "active", academy_classes: { code: "E5" } },
        class_books: [{ id: 12, code: "Phonics_1", name: "Phonics 1" }]
    } });
    await waitFor(() => expect(screen.getByRole("button", { name: "重新整理學習進度" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "重新整理學習進度" }));
    await screen.findByRole("link", { name: "打開 Phonics 1" });
    expect(screen.queryByRole("link", { name: "打開 Workbook 1" })).not.toBeInTheDocument();
    loadStudentCommerceProfile.mockRejectedValue(new Error("offline"));
    await waitFor(() => expect(screen.getByRole("button", { name: "重新整理學習進度" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "重新整理學習進度" }));
    await screen.findByText(/目前顯示上次班級教材/);
    expect(screen.getByRole("link", { name: "打開 Phonics 1" })).toHaveAttribute("href", "/student/books/Phonics_1");
    loadStudentCommerceProfile.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "重新整理學習進度" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "重新整理學習進度" }));
    await screen.findByText(/班級教材暫時無法讀取/);
    expect(screen.queryByRole("link", { name: "打開 Phonics 1" })).not.toBeInTheDocument();
});

test("restores the class material mission on reload while waiting for current data", async () => {
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    const first = renderHome();
    await screen.findByRole("link", { name: "打開 Workbook 1" });
    await act(async () => {});
    first.unmount();
    const snapshots = Object.keys(localStorage).filter(key => key.startsWith("ae-student-pages-v1:")).map(key => [key, localStorage.getItem(key)]);
    clearStudentPageCache();
    snapshots.forEach(([key, value]) => localStorage.setItem(key, value));
    loadStudentCommerceProfile.mockImplementation(() => new Promise(() => {}));
    renderHome();
    expect(screen.getByRole("link", { name: "打開 Workbook 1" })).toHaveAttribute("href", "/student/books/Workbook_1");
    await act(async () => {});
    expect(loadStudentCommerceProfile).toHaveBeenCalledTimes(2);
});

test("does not display another class's delayed response after switching learners", async () => {
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    let finish;
    loadStudentCommerceProfile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = renderHome();
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        enrollment_status: "active", current_enrollment: { status: "active", academy_classes: { code: "E7" } },
        class_books: [{ id: 12, name: "Phonics 1" }]
    } });
    useAuth.mockReturnValue({ firebaseUser: { uid: "learner-b" }, role: "student", studentProfile: profile(true) });
    view.rerender(<MemoryRouter><StudentLearningHome /></MemoryRouter>);
    await screen.findByRole("link", { name: "打開 Phonics 1" });
    await act(async () => finish({ profile: { enrollment_status: "active", current_enrollment: { status: "active", academy_classes: { code: "E1" } }, class_books: [{ id: 10, name: "Workbook 1" }] } }));
    expect(screen.queryByRole("link", { name: "打開 Workbook 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打開 Phonics 1" })).toHaveAttribute("href", "/student/books/Phonics_1");
});

test("keeps unset and locked class materials recoverable from the mission and existing shelf", async () => {
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        enrollment_status: "active", current_enrollment: { status: "active", academy_classes: { code: "E5" } }, class_books: []
    } });
    renderHome();
    await screen.findByText("班級目前尚未設定學習教材，請老師確認。");
    expect(screen.getByRole("link", { name: "查看我的教材" })).toHaveAttribute("href", "#learning-books");
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        enrollment_status: "active", current_enrollment: { status: "active", academy_classes: { code: "E5" } },
        class_books: [{ id: 11, code: "locked", name: "未授權教材" }, { id: 99, code: "disabled", name: "停用教材" }]
    } });
    await waitFor(() => expect(screen.getByRole("button", { name: "重新整理學習進度" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "重新整理學習進度" }));
    await screen.findByText(/目前班級教材無法開啟/);
    expect(screen.queryByRole("link", { name: /未授權教材|停用教材/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看我的教材" })).toHaveAttribute("href", "#learning-books");
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

test("resumes a currently assigned book at the last track without replacing pending assignments", async () => {
    const auth = { firebaseUser: { uid: "learner-a" }, role: "student", studentProfile: profile(true) };
    saveStudentLearningResume(studentPageScope(auth.firebaseUser, auth.role, auth.studentProfile),
        { id: 10, code: "Workbook_1" }, { id: 22, title: "Unit 2", page: "P.22" });
    const first = renderHome();
    expect(await screen.findByRole("link", { name: "打開這份任務" })).toHaveAttribute("href", "/student/assignments?task=v1-2");
    first.unmount();
    clearStudentPageCache();
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    saveStudentLearningResume(studentPageScope(auth.firebaseUser, auth.role, auth.studentProfile),
        { id: 10, code: "Workbook_1" }, { id: 22, title: "Unit 2", page: "P.22" });
    renderHome();
    expect(await screen.findByRole("link", { name: "繼續 Workbook 1 · P.22" })).toHaveAttribute("href", "/student/books/Workbook_1?resume=22");
    expect(screen.getByText(/上次音檔：Unit 2/)).toBeInTheDocument();
});

test("does not resume an old class, unavailable material or another student's bookmark", async () => {
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    const scope = studentPageScope({ uid: "learner-a" }, "student", profile(true));
    saveStudentLearningResume(scope, { id: 12, code: "Phonics_1" }, { id: 2, page: "P.2" });
    const first = renderHome();
    await screen.findByRole("link", { name: "打開 Workbook 1" });
    expect(screen.queryByRole("link", { name: /繼續 Phonics/ })).not.toBeInTheDocument();
    first.unmount();
    useAuth.mockReturnValue({ firebaseUser: { uid: "learner-b" }, role: "student", studentProfile: profile(true) });
    renderHome();
    await screen.findByRole("link", { name: "打開 Workbook 1" });
    expect(screen.queryByRole("link", { name: /^繼續 / })).not.toBeInTheDocument();
});

test("textbook customers can resume their authorized material", async () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "customer" }, role: "student", studentProfile: profile(false) });
    saveStudentLearningResume(studentPageScope({ uid: "customer" }, "student", profile(false)),
        { id: 12, code: "Phonics_1" }, { id: 2, title: "Phonics Unit 1" });
    renderHome();
    expect(await screen.findByRole("link", { name: "繼續 Phonics 1" })).toHaveAttribute("href", "/student/books/Phonics_1?resume=2");
});

test("home displays the server birthday benefit without adding another endpoint request", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    getGamificationSummary.mockResolvedValue({ balance: { level: 2, total_xp: 180 }, birthday: { enabled: true, is_birthday_month: true, evaluated_on: today, ends_on: "2026-10-31", xp_multiplier: 2, gift_status: "received", gift_points: 150 } });
    renderHome();
    await screen.findByText("生日月快樂！");
    expect(screen.getByText("150 AE Points")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "關閉生日月祝福" }));
    fireEvent.click(screen.getByRole("button", { name: /不再顯示/ }));
    expect(localStorage.getItem("ae-birthday-notice-hidden-v1:learner-a")).toBe("1");
    expect(screen.queryByText("生日月快樂！")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "今天，一起探索英文！" })).toHaveFocus();
    expect(screen.getByText("180 XP")).toBeInTheDocument();
    expect(getGamificationSummary).toHaveBeenCalledTimes(1);
});


test("shows overdue-only work before birthday and links straight to the matching assignment", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    getGamificationSummary.mockResolvedValue({ birthday: { enabled: true, is_birthday_month: true, evaluated_on: today } });
    getStudentAssignments.mockResolvedValue({ assignments: [{ id: 4, title: "P22 聽力", source_type: "music_track", due_at: "2020-01-01", tracks: [{ track: { id: 22 }, required_listens: 3, play_count: 1 }], progress: {} }] });
    renderHome();
    const reminder = await screen.findByRole("region", { name: "待完成作業提醒" });
    expect(reminder).toHaveTextContent("目前沒有新的作業，你還有 1 份逾期作業尚未完成");
    expect(reminder).toHaveTextContent("指定音檔：已完成 0 / 1 個");
    expect(within(reminder).getByRole("link", { name: "查看待補作業" })).toHaveAttribute("href", "/student/assignments?task=v1-4");
    expect(screen.queryByText(/目前沒有待處理作業/)).not.toBeInTheDocument();
    expect(reminder.compareDocumentPosition(await screen.findByRole("region", { name: "生日月快樂！" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "查看作業與補做方式" })).toHaveAttribute("href", "/student/assignments?task=v1-4");
});

test("completed overdue work does not appear as outstanding work", async () => {
    getStudentAssignments.mockResolvedValue({ assignments: [{ id: 4, title: "已完成作業", due_at: "2020-01-01", progress: { completed: true } }] });
    renderHome();
    await screen.findByText(/目前沒有待處理作業/);
    expect(screen.queryByRole("region", { name: "待完成作業提醒" })).not.toBeInTheDocument();
});
