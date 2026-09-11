import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    createGuardianNotificationDraft,
    getTeacherStudentActivity
} from "../../services/learningActivityService";
import {
    previewGuardianNotificationClass,
    resendGuardianNotification,
    sendGuardianNotification,
    sendGuardianNotificationClass
} from "../../services/guardianEmailService";
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

jest.mock("../../services/guardianEmailService", () => ({
    previewGuardianNotificationClass: jest.fn(),
    resendGuardianNotification: jest.fn(),
    sendGuardianNotification: jest.fn(),
    sendGuardianNotificationClass: jest.fn()
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
                guardian: {
                    email: "guardian@example.invalid",
                    notification_enabled: true
                }
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

    test("opens the styled guardian reminder dialog", async () => {
        createGuardianNotificationDraft.mockResolvedValue({
            draft: {
                id: 501,
                email: "guardian@example.invalid",
                subject: "Alan English 學習提醒",
                message: "本週學習提醒"
            }
        });

        render(
            <MemoryRouter>
                <ManagementDashboard />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole("button", { name: "提醒家長" }));

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveClass("guardian-reminder-modal");
        expect(dialog.parentElement).toHaveClass("guardian-reminder-modal-backdrop");
        const mailLink = screen.getByRole("link", { name: "開啟 Email" });
        expect(mailLink).toHaveClass("open-mail-button");
        expect(mailLink).toHaveAttribute("href", expect.stringContaining("mailto:guardian%40example.invalid"));
        expect(screen.getByRole("button", { name: "已自行寄出" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "直接寄送" })).toHaveClass("primary");
    });

    test("copies the reminder when the browser cannot open an Email app", async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText }
        });
        createGuardianNotificationDraft.mockResolvedValue({
            draft: {
                id: 502,
                email: "guardian@example.invalid",
                subject: "Alan English 學習提醒",
                message: "本週學習提醒"
            }
        });

        render(
            <MemoryRouter>
                <ManagementDashboard />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole("button", { name: "提醒家長" }));
        fireEvent.click(await screen.findByRole("button", { name: "複製郵件內容" }));

        expect(await screen.findByRole("status")).toHaveTextContent("郵件內容已複製");
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining("guardian@example.invalid"));
    });

    test("sends the prepared notification directly from the admin dialog", async () => {
        createGuardianNotificationDraft.mockResolvedValue({
            draft: {
                id: 503,
                email: "guardian@example.invalid",
                subject: "Alan English 學習提醒",
                message: "本週學習提醒"
            }
        });
        sendGuardianNotification.mockResolvedValue({ success: true, status: "sent" });

        render(
            <MemoryRouter>
                <ManagementDashboard />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole("button", { name: "提醒家長" }));
        fireEvent.click(await screen.findByRole("button", { name: "直接寄送" }));

        expect(await screen.findByText("已直接寄送給 guardian@example.invalid")).toBeInTheDocument();
        expect(sendGuardianNotification).toHaveBeenCalledWith(expect.anything(), 503);
    });

    test("requires a reason and a second confirmation before resending", async () => {
        createGuardianNotificationDraft.mockResolvedValue({
            draft: {
                id: 504,
                email: "guardian@example.invalid",
                subject: "Alan English 學習提醒",
                message: "本週學習提醒",
                already_sent_today: true
            }
        });
        resendGuardianNotification.mockResolvedValue({ success: true, status: "sent" });

        render(
            <MemoryRouter>
                <ManagementDashboard />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole("button", { name: "提醒家長" }));
        fireEvent.click(await screen.findByRole("button", { name: "再次寄送" }));

        const confirmButton = screen.getByRole("button", { name: "確認再次寄送" });
        expect(confirmButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText("重寄原因（至少 3 個字）"), {
            target: { value: "家長表示未收到，確認信箱後補寄" }
        });
        expect(confirmButton).toBeEnabled();

        fireEvent.click(confirmButton);

        expect(resendGuardianNotification).toHaveBeenCalledWith(
            expect.anything(),
            504,
            "家長表示未收到，確認信箱後補寄",
            expect.stringMatching(/^[A-Za-z0-9_-]{16,100}$/)
        );
        expect(await screen.findByText(/已再次寄送給/)).toBeInTheDocument();
    });

    test("previews and confirms a class batch before sending", async () => {
        previewGuardianNotificationClass.mockResolvedValue({
            success: true,
            class_code: "E3",
            provider_configured: true,
            totals: {
                students: 8,
                ready_to_send: 6,
                already_sent_today: 1,
                missing_guardian_email: 1
            }
        });
        sendGuardianNotificationClass.mockResolvedValue({
            success: true,
            totals: { sent: 6, skipped: 0, failed: 0, missing_guardian_email: 1 }
        });

        render(
            <MemoryRouter>
                <ManagementDashboard />
            </MemoryRouter>
        );

        fireEvent.change(await screen.findByRole("combobox", { name: "選擇批量寄送班級" }), {
            target: { value: "E3" }
        });
        fireEvent.click(screen.getByRole("button", { name: "預覽寄送名單" }));

        expect(await screen.findByRole("button", { name: "確認寄送 6 封" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "確認寄送 6 封" }));

        expect(await screen.findByText(/E3 班批量寄送完成：成功 6/)).toBeInTheDocument();
        expect(sendGuardianNotificationClass).toHaveBeenCalledWith(expect.anything(), "E3");
    });
});
