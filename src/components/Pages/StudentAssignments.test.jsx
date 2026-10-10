import { clearStudentPageCache } from "../../services/studentPageCache";
beforeEach(() => clearStudentPageCache());
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentAssignments from "./StudentAssignments";
import { useAuth } from "../../auth/AuthContext";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/assignmentService", () => ({ getStudentAssignments: jest.fn(), getStudentAssignmentsV2: jest.fn(), submitAssignment: jest.fn(), submitAssignmentV2Ai: jest.fn() }));
jest.mock("./ListeningTTSPlayer", () => () => null);

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ firebaseUser: { uid: "test" } });
    getStudentAssignments.mockResolvedValue({ assignments: [{ id: 4, title: "過往聽力", due_at: "2020-01-01", source_type: "music_track", track: { id: 6, title: "P22", book: { code: "Workbook_1" } }, progress: {} }] });
    getStudentAssignmentsV2.mockResolvedValue({ assignments: [] });
});

test("labels overdue work honestly and retains the listening assignment context", async () => {
    render(<MemoryRouter><StudentAssignments /></MemoryRouter>);
    await screen.findByRole("heading", { name: "過往聽力" });
    expect(screen.getByText("已逾期", { selector: ".student-homework-status" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /查看指定音檔/ })[0]).toHaveAttribute("href", "/student/books/Workbook_1?assignment=4&tracks=6&required=3");
    expect(screen.getByText(/本次作業已聽 0 次，還需 3 次/)).toBeVisible();
    expect(screen.getByText(/請向老師確認是否可以補做/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "進行中 0" }));
    expect(screen.queryByRole("heading", { name: "過往聽力" })).not.toBeInTheDocument();
    expect(screen.getByText("目前沒有進行中的任務")).toBeInTheDocument();
});

test("shows a partial failure instead of claiming the task list is empty or complete", async () => {
    getStudentAssignments.mockResolvedValue({ assignments: [] });
    getStudentAssignmentsV2.mockRejectedValue(new Error("unavailable"));
    render(<MemoryRouter><StudentAssignments /></MemoryRouter>);
    await screen.findByText(/部分任務暫時無法讀取/);
    expect(screen.queryByText("目前沒有作業")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
