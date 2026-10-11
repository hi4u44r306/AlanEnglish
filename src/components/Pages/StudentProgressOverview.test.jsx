import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentProgressOverview from "./StudentProgressOverview";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { clearStudentPageCache, studentPageScope } from "../../services/studentPageCache";
import { saveStudentLearningResume } from "../../services/studentLearningResume";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleCatalog: jest.fn() }));
jest.mock("../../services/speakingChallengeService", () => ({ getSpeakingChallengeCatalog: jest.fn() }));

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
    getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [
        { id: 1, book: { id: 10, name: "Workbook 1" }, is_completed: true },
        { id: 2, book: { id: 10, name: "Workbook 1" }, is_completed: false },
        { id: 3, book: { id: 12, name: "Phonics 1" }, is_completed: false }
    ] });
});

test("lists where the student stopped in each authorized book, newest first", async () => {
    const student = auth({ assignments: true, pronunciation: true });
    useAuth.mockReturnValue(student);
    saveStudentLearningResume(scopeOf(student), { id: 10, code: "Workbook_1" }, { id: 22, title: "Unit 2", page: "P.22" });
    saveStudentLearningResume(scopeOf(student), { id: 11, code: "Workbook_2" }, { id: 30, title: "鎖定教材音檔" });
    saveStudentLearningResume(scopeOf(student), { id: 12, code: "Phonics_1" }, { id: 5, title: "Phonics Unit 1" });
    saveStudentLearningResume(scopeOf(student), { id: 10, code: "Workbook_1" }, { id: 23, title: "Unit 3", page: "P.23" });
    renderOverview();
    const listening = within(await screen.findByRole("article", { name: "聽力：上次聽到這裡" }));
    const links = await listening.findAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual(["/student/books/Workbook_1?resume=23", "/student/books/Phonics_1?resume=5"]);
    expect(links[0]).toHaveTextContent("Workbook 1");
    expect(links[0]).toHaveTextContent("Unit 3");
    expect(screen.queryByText(/鎖定教材音檔/)).not.toBeInTheDocument();
});

test("shows speaking challenge progress per book", async () => {
    useAuth.mockReturnValue(auth({ assignments: true, pronunciation: true }));
    renderOverview();
    const speaking = within(await screen.findByRole("article", { name: "口說大挑戰" }));
    expect(await speaking.findByRole("link", { name: /Workbook 1/ })).toHaveTextContent("已完成 1 / 2 關");
    expect(speaking.getByRole("link", { name: /Phonics 1/ })).toHaveTextContent("已完成 0 / 1 關");
    expect(screen.getByRole("link", { name: "我的作業" })).toHaveAttribute("href", "/student/assignments");
});

test("does not load speaking progress or show assignments without those entitlements", async () => {
    useAuth.mockReturnValue(auth({ assignments: false, pronunciation: false }, "customer"));
    renderOverview();
    expect(await screen.findByText(/這台裝置還沒有聽力紀錄/)).toBeInTheDocument();
    expect(getSpeakingChallengeCatalog).not.toHaveBeenCalled();
    expect(screen.queryByRole("article", { name: "口說大挑戰" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "我的作業" })).not.toBeInTheDocument();
});
