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
    reissueAcademyStudentLoginCard,
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
    reissueAcademyStudentLoginCard: jest.fn(),
    sendAcademyPasswordReset: jest.fn()
}));

jest.mock("qrcode", () => ({
    __esModule: true,
    default: {
        toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,test")
    }
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
    authentication_method: "academy_username",
    login_username: "e3teststudent",
    activated_at: null,
    must_change_password: false,
    membership: {
        is_active: true,
        plan: {
            code: "academy_internal",
            name: "英文班在學方案"
        }
    }
};

const archivedTrialStudent = {
    ...academyStudent,
    id: 68,
    firebase_uid: "archived-student-firebase-uid",
    name: "已停用試用學生",
    email: "archived@gmail.com",
    class: "E1",
    learner_type: "trial_user",
    account_status: "archived",
    must_change_password: true,
    membership: {
        is_active: false,
        plan: {
            code: "trial_7_day",
            name: "7 天免費試用"
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
        deleteAcademyInvitation.mockResolvedValue({ success: true });
        deleteAcademyStudentAccount.mockResolvedValue({ success: true });
        reissueAcademyStudentLoginCard.mockResolvedValue({
            success: true,
            account: { id: 67, name: "E3 測試學生", username: "e3teststudent" },
            credentials: {
                username: "e3teststudent",
                activation_url: "https://alanenglish.com.tw/academy/student-setup?token=test",
                recovery_codes: ["AE-AAAA-BBBB-CCCC", "AE-DDDD-EEEE-FFFF"]
            }
        });
        sendAcademyPasswordReset.mockResolvedValue({ success: true });
        jest.spyOn(window, "confirm").mockReturnValue(true);
    });

    afterEach(() => {
        window.confirm.mockRestore();
    });

    test("shows E3 students as academy members instead of the legacy allcover plan", async () => {
        renderPage();

        expect(await screen.findByText("E3 測試學生")).toBeInTheDocument();
        expect(screen.getAllByText("英文班在學方案")).toHaveLength(2);
        expect(screen.queryByText("全方位")).not.toBeInTheDocument();
        expect(screen.getByText("E3")).toBeInTheDocument();
    });

    test("hides an archived student by default and allows restoring it from the status filter", async () => {
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
        await waitFor(() => {
            expect(screen.queryByText("E3 測試學生")).not.toBeInTheDocument();
        });

        fireEvent.change(screen.getByRole("combobox", { name: "帳號狀態" }), {
            target: { value: "archived" }
        });
        expect(await screen.findByText("已停用帳號")).toBeInTheDocument();
        fireEvent.click(await screen.findByRole("button", { name: "恢復" }));
        await waitFor(() => {
            expect(restoreManagedAccount).toHaveBeenCalledWith(
                firebaseUser,
                academyStudent.id
            );
        });
        await waitFor(() => {
            expect(screen.queryByText("E3 測試學生")).not.toBeInTheDocument();
        });

        fireEvent.change(screen.getByRole("combobox", { name: "帳號狀態" }), {
            target: { value: "active" }
        });
        expect(await screen.findByText("使用中")).toBeInTheDocument();
    });

    test("allows an admin to permanently delete an academy student after entering the full username", async () => {
        renderPage();

        expect(await screen.findByText("E3 測試學生")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "永久刪除" }));
        expect(screen.getByText("永久刪除學生帳號")).toBeInTheDocument();
        expect(screen.getByText(/Stripe 測試模式付款可一併清理/)).toBeInTheDocument();
        expect(screen.getByText(/正式、無法確認模式的付款/)).toBeInTheDocument();

        const confirmButton = screen.getByRole("button", { name: "確認永久刪除帳號" });
        expect(confirmButton).toBeDisabled();
        fireEvent.change(screen.getByLabelText("輸入完整 登入名稱 確認"), {
            target: { value: "e3teststudent" }
        });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(deleteAcademyStudentAccount).toHaveBeenCalledWith(
                firebaseUser,
                academyStudent.id,
                "e3teststudent"
            );
        });
        await waitFor(() => {
            expect(screen.queryByText("E3 測試學生")).not.toBeInTheDocument();
        });
    });

    test("allows an admin to reissue a login card for an unactivated academy student", async () => {
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "重新發登入卡" }));
        await waitFor(() => {
            expect(reissueAcademyStudentLoginCard).toHaveBeenCalledWith(firebaseUser, 67);
        });
        expect(await screen.findByText("新的學生登入卡")).toBeInTheDocument();
        expect(screen.getByText(/AE-AAAA-BBBB-CCCC/)).toBeInTheDocument();
    });

    test("filters by role, class, plan, activation, account and access status", async () => {
        getManagedAccounts.mockResolvedValue({
            accounts: [academyStudent, archivedTrialStudent]
        });
        renderPage();

        expect(await screen.findByText("E3 測試學生")).toBeInTheDocument();
        expect(screen.queryByText("已停用試用學生")).not.toBeInTheDocument();

        fireEvent.change(screen.getByRole("combobox", { name: "Role" }), {
            target: { value: "student" }
        });
        fireEvent.change(screen.getByRole("combobox", { name: "Class" }), {
            target: { value: "E1" }
        });
        fireEvent.change(screen.getByRole("combobox", { name: "Plan" }), {
            target: { value: "trial_user" }
        });
        fireEvent.change(screen.getByRole("combobox", { name: "開通狀態" }), {
            target: { value: "direct_pending" }
        });
        fireEvent.change(screen.getByRole("combobox", { name: "帳號狀態" }), {
            target: { value: "archived" }
        });
        fireEvent.change(screen.getByRole("combobox", { name: "是否啟用" }), {
            target: { value: "disabled" }
        });

        expect(await screen.findByText("已停用試用學生")).toBeInTheDocument();
        expect(screen.queryByText("E3 測試學生")).not.toBeInTheDocument();
        expect(screen.getAllByText("未啟用")).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: "清除篩選" }));
        expect(await screen.findByText("E3 測試學生")).toBeInTheDocument();
        expect(screen.queryByText("已停用試用學生")).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole("button", { name: "確認刪除邀請" }));

        await waitFor(() => {
            expect(deleteAcademyInvitation).toHaveBeenCalledWith(
                firebaseUser,
                91,
                "pending@gmail.com"
            );
        });
    });
});
