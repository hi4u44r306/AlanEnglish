import React from "react";
import { render, screen } from "@testing-library/react";
import DepartedActivitySummary from "./DepartedActivitySummary";
import { loadDepartedStudentActivity } from "../../services/academyStudentService";

jest.mock("../../auth/AuthContext", () => {
    const value = { firebaseUser: { uid: "admin" } };
    return { useAuth: () => value };
});
jest.mock("../../services/academyStudentService", () => ({ loadDepartedStudentActivity: jest.fn() }));

describe("DepartedActivitySummary", () => {
    it("shows an empty state when nobody has departed", async () => {
        loadDepartedStudentActivity.mockResolvedValue({ summary: { total_departed: 0 }, students: [] });
        render(<DepartedActivitySummary />);
        expect(await screen.findByText(/目前還沒有離校生/)).toBeTruthy();
    });

    it("shows totals and whether each student came back", async () => {
        loadDepartedStudentActivity.mockResolvedValue({
            summary: { total_departed: 2, returned_after_departure: 1, never_returned: 1, logged_in_last_30_days: 1, logged_in_last_90_days: 1 },
            students: [
                { id: 1, display_name: "小明", class_code: "E3", departed_on: "2026-06-30", last_login_at: "2026-09-01T00:00:00Z", returned: true },
                { id: 2, display_name: "小華", class_code: "E1", departed_on: "2026-06-30", last_login_at: null, returned: false }
            ]
        });
        render(<DepartedActivitySummary />);
        expect(await screen.findByText("離校後有回來")).toBeTruthy();
        expect(screen.getByText("尚未回來")).toBeTruthy();
        expect(screen.getByText("離校後回來登入過")).toBeTruthy();
    });

    it("shows the error message when loading fails", async () => {
        loadDepartedStudentActivity.mockRejectedValue(new Error("只有管理員可以查看離校生統計"));
        render(<DepartedActivitySummary />);
        expect((await screen.findByRole("alert")).textContent).toContain("只有管理員");
    });
});
