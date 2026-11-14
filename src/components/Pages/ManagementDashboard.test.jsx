import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createGuardianNotificationDraft, getTeacherStudentActivity } from "../../services/learningActivityService";
import { listWeeklyOptOuts, reenableWeeklyReport } from "../../services/guardianWeeklyUnsubscribeService";
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

jest.mock("../../services/guardianWeeklyUnsubscribeService", () => ({
    listWeeklyOptOuts: jest.fn(),
    reenableWeeklyReport: jest.fn()
}));

describe("ManagementDashboard", () => {
    beforeEach(() => {
        listWeeklyOptOuts.mockResolvedValue({ opted_out: [] });
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

    test("已有家長 Email 時唯讀並顯示驗證狀態，老師不能在這裡換信箱", async () => {
        const { students } = await getTeacherStudentActivity();
        getTeacherStudentActivity.mockResolvedValue({ students: [{ ...students[0], guardian: { email: "parent@example.invalid", email_verified_at: null, notification_enabled: true } }] });
        render(<MemoryRouter><ManagementDashboard /></MemoryRouter>);

        fireEvent.click(await screen.findByRole("button", { name: /已設定/ }));
        const emailInput = await screen.findByLabelText(/家長 Email（尚未驗證）/);
        expect(emailInput).toHaveAttribute("readonly");
        expect(screen.getByText(/變更須由管理員驗證/)).toBeInTheDocument();
    });

    test("家長在週報信裡取消後，編輯畫面顯示提示，老師可以重新開啟", async () => {
        const { students } = await getTeacherStudentActivity();
        getTeacherStudentActivity.mockResolvedValue({ students: [{ ...students[0], guardian: { email: "parent@example.invalid", email_verified_at: "2026-10-01T00:00:00Z", notification_enabled: true } }] });
        listWeeklyOptOuts.mockResolvedValue({ opted_out: [{ student_id: 101, opted_out_at: "2026-11-14T02:00:00Z" }] });
        reenableWeeklyReport.mockResolvedValue({ status: "re_enabled" });
        render(<MemoryRouter><ManagementDashboard /></MemoryRouter>);

        fireEvent.click(await screen.findByRole("button", { name: /已設定/ }));
        expect(await screen.findByText(/家長已在週報信裡取消每週學習週報/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "重新開啟每週週報" }));
        expect(await screen.findByText("已重新開啟每週學習週報")).toBeInTheDocument();
        expect(reenableWeeklyReport).toHaveBeenCalledWith({ uid: "admin-test-uid" }, 101);
        expect(screen.queryByText(/家長已在週報信裡取消每週學習週報/)).not.toBeInTheDocument();
    });

    test("讀不到取消名單時學生列表照常顯示、不顯示取消提示", async () => {
        const { students } = await getTeacherStudentActivity();
        getTeacherStudentActivity.mockResolvedValue({ students: [{ ...students[0], guardian: { email: "parent@example.invalid", notification_enabled: true } }] });
        listWeeklyOptOuts.mockRejectedValue(new Error("boom"));
        render(<MemoryRouter><ManagementDashboard /></MemoryRouter>);

        fireEvent.click(await screen.findByRole("button", { name: /已設定/ }));
        await screen.findByLabelText(/家長 Email/);
        expect(screen.queryByText(/家長已在週報信裡取消/)).not.toBeInTheDocument();
    });

    test("還沒有家長 Email 時可以第一次填入", async () => {
        render(<MemoryRouter><ManagementDashboard /></MemoryRouter>);

        fireEvent.click(await screen.findByRole("button", { name: /設定家長/ }));
        const emailInput = await screen.findByLabelText("家長 Email");
        expect(emailInput).not.toHaveAttribute("readonly");
    });
});
