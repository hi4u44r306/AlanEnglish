import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    archiveManagedAccount,
    getManagedAccounts,
    restoreManagedAccount
} from "../../services/membershipService";
import {
    deleteAcademyInvitation,
    deleteAcademyStudentAccount,
    listAcademyInvitations,
    sendAcademyPasswordReset
} from "../../services/academyStudentService";
import AccountManagement from "./AccountManagement";

jest.mock("../../auth/AuthContext", () => ({
    useAuth: jest.fn()
}));

jest.mock("../../services/membershipService", () => ({
    archiveManagedAccount: jest.fn(),
    getManagedAccounts: jest.fn(),
    restoreManagedAccount: jest.fn(),
    updateManagedAccount: jest.fn()
}));

jest.mock("../../services/academyStudentService", () => ({
    deleteAcademyInvitation: jest.fn(),
    deleteAcademyStudentAccount: jest.fn(),
    listAcademyInvitations: jest.fn(),
    sendAcademyPasswordReset: jest.fn()
}));

const firebaseUser = {
    uid: "admin-firebase-uid",
    getIdToken: jest.fn()
};

const academyStudent = {
    id: 67,
    firebase_uid: "student-firebase-uid",
    name: "E3 測試學生",
    email: "student@gmail.com",
    role: "student",
    class: "E3",
    plan: "allcover",
    learner_type: "academy_student",
    account_status: "active",
    must_change_password: false,
    membership: {
        plan: {
            code: "academy_internal",
            name: "英文班在學方案"
        }
    }
};

const renderPage = () => render(
    <MemoryRouter>
        <AccountManagement />
    </MemoryRouter>
);

describe("AccountManagement", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({
            firebaseUser,
            role: "admin",
            studentProfile: {
                firebase_uid: firebaseUser.uid
            }
        });
        getManagedAccounts.mockResolvedValue({
            accounts: [academyStudent]
        });
        listAcademyInvitations.mockResolvedValue([]);
        deleteAcademyStudentAccount.mockResolvedValue({ success: true });
        deleteAcademyInvitation.mockResolvedValue({ success: true });
        sendAcademyPasswordReset.mockResolvedValue({ success: true });
        jest.spyOn(window, "confirm").mockReturnValue(true);
    });

    afterEach(() => {
        window.confirm.mockRestore();
    });

    test("shows E3 students as academy members instead of the legacy allcover plan", async () => {
        renderPage();

        expect(await screen.findByText("E3 測試學生")).toBeInTheDocument();
        expect(screen.getByText("英文班在學方案")).toBeInTheDocument();
        expect(screen.queryByText("全方位")).not.toBeInTheDocument();
        expect(screen.getByText("E3")).toBeInTheDocument();
    });

    test("archives a student without deleting the row and then offers restore", async () => {
        archiveManagedAccount.mockResolvedValue({
            account: {
                ...academyStudent,
                account_status: "archived"
            }
        });
        restoreManagedAccount.mockResolvedValue({
            account: academyStudent
        });

        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: "停用" }));

        await waitFor(() => {
            expect(archiveManagedAccount).toHaveBeenCalledWith(
                firebaseUser,
                academyStudent.id,
                "由帳號管理頁停用"
            );
        });
        expect(await screen.findByText("已停用")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "恢復" }));
        await waitFor(() => {
            expect(restoreManagedAccount).toHaveBeenCalledWith(
                firebaseUser,
                academyStudent.id
            );
        });
        expect(await screen.findByText("使用中")).toBeInTheDocument();
    });

    test("requires the full email before permanently deleting an eligible student", async () => {
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "永久刪除" }));
        const dialog = screen.getByRole("dialog", { name: "永久刪除學生帳號" });
        const confirmButton = screen.getByRole("button", { name: "確認永久刪除" });

        expect(confirmButton).toBeDisabled();
        fireEvent.change(
            screen.getByLabelText("輸入完整 Email 確認"),
            { target: { value: academyStudent.email } }
        );
        expect(confirmButton).toBeEnabled();
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(deleteAcademyStudentAccount).toHaveBeenCalledWith(
                firebaseUser,
                academyStudent.id,
                academyStudent.email
            );
        });
        await waitFor(() => expect(dialog).not.toBeInTheDocument());
    });

    test("allows admin to delete an unclaimed pending invitation", async () => {
        getManagedAccounts.mockResolvedValue({ accounts: [] });
        listAcademyInvitations.mockResolvedValue([{
            id: 91,
            status: "expired",
            invited_email: "pending@gmail.com",
            chinese_name: "待開通學生",
            class_code: "E1",
            expires_at: "2026-08-01T00:00:00Z",
            claimed_by_student_id: null
        }]);
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "刪除邀請" }));
        fireEvent.change(
            screen.getByLabelText("輸入完整 Email 確認"),
            { target: { value: "pending@gmail.com" } }
        );
        fireEvent.click(screen.getByRole("button", { name: "確認永久刪除" }));

        await waitFor(() => {
            expect(deleteAcademyInvitation).toHaveBeenCalledWith(
                firebaseUser,
                91,
                "pending@gmail.com"
            );
        });
    });
});
