import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createGuardianNotificationDraft, getTeacherStudentActivity } from "../../services/learningActivityService";
import ManagementDashboard from "./ManagementDashboard";

jest.mock("../../auth/AuthContext", () => ({
    useAuth: jest.fn()
}));

jest.mock("../../services/learningActivityService", () => ({
    createGuardianNotificationDraft: jest.fn(),
    getTeacherStudentActivity: jest.fn(),
    markGuardianNotificationSent: jest.fn(),
    upsertGuardianContact: jest.fn()
}));

describe("ManagementDashboard", () => {
    beforeEach(() => {
        useAuth.mockReturnValue({
            role: "admin",
            studentProfile: { name: "管理員" },
            firebaseUser: { uid: "admin-test-uid" }
        });
        getTeacherStudentActivity.mockResolvedValue({
            students: [{
                id: 101,
                name: "行動版測試學生",
                email: "mobile-test@example.invalid",
                class: "E3",
                last_login_at: null,
                last_active_at: null,
                last_learning_at: null,
                status: {
                    code: "never",
                    label: "從未使用",
                    inactive_days: null
                },
                conversation: {
                    completed: false,
                    completed_steps: 0,
                    total_steps: 9
                },
                listening: { completed: 0 },
                guardian: null
            }]
        });
    });

    test("adds mobile labels to every student activity card field", async () => {
        render(
            <MemoryRouter>
                <ManagementDashboard />
            </MemoryRouter>
        );

        const row = (await screen.findByText("行動版測試學生")).closest("tr");

        expect(row).toHaveClass("student-activity-row", "activity-attention-row");
        expect(row.querySelector('[data-label="學生"]')).toBeInTheDocument();
        expect(row.querySelector('[data-label="最近動態"]')).toBeInTheDocument();
        expect(row.querySelector('[data-label="學習進度"]')).toBeInTheDocument();
        expect(row.querySelector('[data-label="狀態"]')).toBeInTheDocument();
        expect(row.querySelector('[data-label="家長"]')).toBeInTheDocument();
        expect(row.querySelector('[data-label="操作"]')).toBeInTheDocument();
    });

    test("家長提醒要先開啟 Email，才能按我已寄出", async () => {
        const { students } = await getTeacherStudentActivity();
        getTeacherStudentActivity.mockResolvedValue({ students: [{ ...students[0], guardian: { email: "parent@example.invalid", is_primary: true, notification_enabled: true } }] });
        createGuardianNotificationDraft.mockResolvedValue({ draft: { id: 9, email: "parent@example.invalid", subject: "提醒", message: "內容" } });
        render(<MemoryRouter><ManagementDashboard /></MemoryRouter>);

        fireEvent.click(await screen.findByRole("button", { name: "提醒家長" }));
        const openMail = await screen.findByRole("button", { name: "開啟 Email" });
        expect(openMail).toHaveClass("primary");
        expect(screen.getByRole("button", { name: "我已寄出" })).toBeDisabled();
    });
});
