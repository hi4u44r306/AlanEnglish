import React from "react";
import { render, waitFor } from "@testing-library/react";
import useStudentWarmup from "./useStudentWarmup";
import { useAuth } from "../auth/AuthContext";
import { getAccessibleBook } from "../services/contentAccessService";
import { getGamificationLeaderboard } from "../services/gamificationService";
import { clearStudentPageCache, readStudentPageCache, studentPageScope } from "../services/studentPageCache";
import { saveStudentLearningResume } from "../services/studentLearningResume";

jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../services/contentAccessService", () => ({ getAccessibleBook: jest.fn() }));
jest.mock("../services/gamificationService", () => ({ getGamificationLeaderboard: jest.fn() }));

const student = { firebaseUser: { uid: "learner" }, role: "student", studentProfile: { class: "E1", membership: { is_active: true, effective_access: { features: {} } } } };
const catalog = { categories: [{ id: 1, name: "Workbook", books: [
    { id: 10, code: "Workbook_1", name: "Workbook 1" },
    { id: 11, code: "Workbook_2", name: "Workbook 2", locked: true },
    { id: 12, code: "Workbook_3", name: "Workbook 3" }
] }] };
const Probe = ({ data }) => { useStudentWarmup(data); return null; };

beforeEach(() => {
    clearStudentPageCache();
    localStorage.clear();
    jest.clearAllMocks();
    getAccessibleBook.mockImplementation((user, code) => Promise.resolve({ book: { code }, tracks: [] }));
    getGamificationLeaderboard.mockResolvedValue({ leaderboard: [] });
    window.requestIdleCallback = callback => window.setTimeout(callback, 0);
    window.cancelIdleCallback = handle => window.clearTimeout(handle);
});

test("warms the ranking and the unlocked books, the one being listened to first", async () => {
    useAuth.mockReturnValue(student);
    const scope = studentPageScope(student.firebaseUser, student.role, student.studentProfile);
    saveStudentLearningResume(scope, { id: 12, code: "Workbook_3" }, { id: 5, title: "P4", page: "P4" });
    render(<Probe data={catalog} />);
    await waitFor(() => expect(getAccessibleBook).toHaveBeenCalledTimes(2));
    expect(getAccessibleBook.mock.calls.map(call => call[1])).toEqual(["Workbook_3", "Workbook_1"]);
    expect(getGamificationLeaderboard).toHaveBeenCalledWith(student.firebaseUser, "week", null, "class");
    await waitFor(() => expect(readStudentPageCache(scope, "book:Workbook_1")?.value).toBeTruthy());
    expect(readStudentPageCache(scope, "book:Workbook_2")).toBeNull();
});

test("does nothing for staff, and does not refetch what is already cached", async () => {
    useAuth.mockReturnValue({ ...student, role: "teacher" });
    const staff = render(<Probe data={catalog} />);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(getAccessibleBook).not.toHaveBeenCalled();
    staff.unmount();
    useAuth.mockReturnValue(student);
    const first = render(<Probe data={catalog} />);
    await waitFor(() => expect(getAccessibleBook).toHaveBeenCalledTimes(2));
    first.unmount();
    render(<Probe data={{ ...catalog }} />);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(getAccessibleBook).toHaveBeenCalledTimes(2);
    expect(getGamificationLeaderboard).toHaveBeenCalledTimes(1);
});
