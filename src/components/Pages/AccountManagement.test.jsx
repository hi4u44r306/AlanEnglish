import { clearStaffPageCache } from "../../services/staffPageCache";
beforeEach(() => clearStaffPageCache());
import React from "react";
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    archiveManagedAccount,
    getGuardianEmailStatus,
    getManagedAccounts,
    getManagedBirthDateHistory,
    getManagedNicknameHistory,
    restoreManagedAccount,
    setGuardianEmail
} from "../../services/membershipService";
import {
    adminResetAcademyStudentPassword,
    deleteAcademyInvitation,
    deleteAcademyStudentAccount,
    listAcademyInvitations,
    reissueAcademyStudentLoginCard,
    sendAcademyPasswordReset
} from "../../services/academyStudentService";
import { sendGuardianReportBatch } from "../../services/guardianEmailService";
import AccountManagement from "./AccountManagement";

jest.mock("../../services/guardianEmailService", () => ({
    sendGuardianReportBatch: jest.fn()
}));

jest.mock("../../auth/AuthContext", () => ({
    useAuth: jest.fn()
}));

jest.mock("../../services/membershipService", () => ({
    archiveManagedAccount: jest.fn(),
    getGuardianEmailStatus: jest.fn(),
    setGuardianEmail: jest.fn(),
    getManagedAccounts: jest.fn(),
    getManagedNicknameHistory: jest.fn(),
    restoreManagedAccount: jest.fn(),
    getManagedBirthDateHistory: jest.fn(),
    correctManagedBirthDate: jest.fn(),
    updateManagedAccount: jest.fn()
}));

jest.mock("../../services/academyStudentService", () => ({
    adminResetAcademyStudentPassword: jest.fn(),
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

const alumniWithAiStudent = {
    ...academyStudent,
    id: 69,
    name: "離校 AI 測試學生",
    class: null,
    learner_type: "academy_student",
    membership: {
        status: "expired",
        is_active: true,
        plan: {
            code: "all_access_monthly",
            name: "全方位月訂閱"
        },
        effective_access: {
            plan_codes: ["basic_membership_monthly", "ai_materials_addon_monthly"],
            grants: [{
                plan_code: "basic_membership_monthly",
                plan_name: "基本自主學習會員"
            }]
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
        getManagedNicknameHistory.mockResolvedValue({
            student: { id: 67, name: "E3 測試學生", class: "E3", nickname: "Brave Owl" },
            nickname_history: [{
                id: 4,
                previous_nickname: "Sunny Fox",
                new_nickname: "Brave Owl",
                change_source: "student_settings",
                changed_at: "2026-09-18T03:00:00Z"
            }]
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
        expect(screen.getAllByText("英文班在學權限")).toHaveLength(2);
        expect(screen.queryByText("全方位")).not.toBeInTheDocument();
        expect(screen.getByText("E3")).toBeInTheDocument();
    });

    test("shows an alumnus effective membership instead of a stale legacy plan", async () => {
        getManagedAccounts.mockResolvedValue({ accounts: [alumniWithAiStudent] });
        renderPage();

        expect(await screen.findByText("離校 AI 測試學生")).toBeInTheDocument();
        expect(screen.getAllByText("基本自主學習會員")).toHaveLength(2);
        expect(screen.queryByText("全方位月訂閱")).not.toBeInTheDocument();
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

    test("lets an admin reset an activated student's password and shows the temporary password only once", async () => {
        getManagedAccounts.mockResolvedValue({ accounts: [{ ...academyStudent, activated_at: "2026-10-01T00:00:00Z" }] });
        adminResetAcademyStudentPassword.mockResolvedValue({
            success: true,
            account: { id: 67, name: "E3 測試學生", username: "e3teststudent" },
            credentials: { username: "e3teststudent", temporary_password: "48291357", shown_once: true }
        });
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "重設密碼" }));
        const submit = screen.getByRole("button", { name: "產生新的臨時密碼" });
        expect(submit).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/輸入這位學生的登入帳號/), { target: { value: "E3TestStudent" } });
        fireEvent.change(screen.getByLabelText(/重設原因/), { target: { value: "家長說孩子忘記密碼" } });
        fireEvent.click(submit);

        await waitFor(() => expect(adminResetAcademyStudentPassword).toHaveBeenCalledWith(
            firebaseUser, 67, "E3TestStudent", "家長說孩子忘記密碼"
        ));
        expect(await screen.findByText("48291357")).toBeInTheDocument();
        expect(screen.getByText(/只在目前畫面顯示一次/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "已抄下，關閉" }));
        expect(screen.queryByText("48291357")).not.toBeInTheDocument();
    });

    test("does not offer a password reset for an unactivated student or to a teacher", async () => {
        renderPage();
        await screen.findByText("E3 測試學生");
        expect(screen.queryByRole("button", { name: "重設密碼" })).not.toBeInTheDocument();

        useAuth.mockReturnValue({ firebaseUser, role: "teacher", studentProfile: { firebase_uid: firebaseUser.uid } });
        getManagedAccounts.mockResolvedValue({ accounts: [{ ...academyStudent, activated_at: "2026-10-01T00:00:00Z" }] });
        cleanup();
        renderPage();
        await screen.findByText("E3 測試學生");
        expect(screen.queryByRole("button", { name: "重設密碼" })).not.toBeInTheDocument();
        expect(adminResetAcademyStudentPassword).not.toHaveBeenCalled();
    });

    test("lets an admin change a guardian email directly, without a code, after confirming the address", async () => {
        getGuardianEmailStatus.mockResolvedValue({
            success: true,
            current_email_masked: "d**@old.com",
            current_email_verified: true,
            set_by_admin: false
        });
        setGuardianEmail.mockResolvedValue({ success: true, new_email_masked: "m***@new.com" });
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "更換家長 Email" }));
        expect(await screen.findByText("d**@old.com")).toBeInTheDocument();
        expect(getGuardianEmailStatus).toHaveBeenCalledWith(firebaseUser, 67);
        expect(screen.getByText(/不需要驗證碼/)).toBeInTheDocument();
        expect(screen.queryByLabelText(/驗證碼/)).not.toBeInTheDocument();

        const panel = within(await screen.findByRole("region", { name: /更換 .* 的家長 Email/ }));
        const submit = panel.getByRole("button", { name: "更換家長 Email" });
        expect(submit).toBeDisabled();
        fireEvent.change(screen.getByLabelText("新的家長 Email"), { target: { value: "Mom@New.com" } });
        fireEvent.change(screen.getByLabelText("再輸入一次新的家長 Email"), { target: { value: "mom@new.com" } });
        fireEvent.change(screen.getByLabelText(/更換原因/), { target: { value: "父母離婚，改掛媽媽" } });
        fireEvent.click(submit);

        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("mom@new.com"));
        await waitFor(() => expect(setGuardianEmail).toHaveBeenCalledWith(firebaseUser, {
            studentId: 67,
            newEmail: "mom@new.com",
            confirmEmail: "mom@new.com",
            reason: "父母離婚，改掛媽媽"
        }));
        await waitFor(() => expect(screen.queryByText(/的家長 Email$/)).not.toBeInTheDocument());
    });

    test("does not change the guardian email when the two addresses differ or the admin cancels the confirmation", async () => {
        getGuardianEmailStatus.mockResolvedValue({ success: true, current_email_masked: null, current_email_verified: false });
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "更換家長 Email" }));
        const panel = within(await screen.findByRole("region", { name: /更換 .* 的家長 Email/ }));
        fireEvent.change(await screen.findByLabelText("新的家長 Email"), { target: { value: "mom@new.com" } });
        fireEvent.change(screen.getByLabelText("再輸入一次新的家長 Email"), { target: { value: "mon@new.com" } });
        fireEvent.change(screen.getByLabelText(/更換原因/), { target: { value: "改掛媽媽" } });
        fireEvent.click(panel.getByRole("button", { name: "更換家長 Email" }));
        expect(window.confirm).not.toHaveBeenCalled();
        expect(setGuardianEmail).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("再輸入一次新的家長 Email"), { target: { value: "mom@new.com" } });
        window.confirm.mockReturnValueOnce(false);
        fireEvent.click(panel.getByRole("button", { name: "更換家長 Email" }));
        expect(setGuardianEmail).not.toHaveBeenCalled();
    });

    test("does not offer the guardian email change to a teacher", async () => {
        useAuth.mockReturnValue({ firebaseUser, role: "teacher", studentProfile: { firebase_uid: firebaseUser.uid } });
        renderPage();
        await screen.findByText("E3 測試學生");
        expect(screen.queryByRole("button", { name: "更換家長 Email" })).not.toBeInTheDocument();
        expect(getGuardianEmailStatus).not.toHaveBeenCalled();
    });

    test("lets an admin open one student's nickname change history", async () => {
        renderPage();

        fireEvent.click(await screen.findByRole("button", { name: "暱稱紀錄" }));
        await waitFor(() => expect(getManagedNicknameHistory).toHaveBeenCalledWith(firebaseUser, 67));
        expect(await screen.findByRole("dialog", { name: "暱稱更改紀錄" })).toBeInTheDocument();
        expect(screen.getByText("目前暱稱：Brave Owl")).toBeInTheDocument();
        expect(screen.getByText("Sunny Fox")).toBeInTheDocument();
        expect(screen.getByText("Brave Owl")).toBeInTheDocument();
    });

    test("lets an admin send this week's parent reports to all active parents after confirming", async () => {
        sendGuardianReportBatch.mockResolvedValue({ totals: { sent: 3, skipped: 1, failed: 0 } });
        renderPage();
        await screen.findByText(academyStudent.name);

        fireEvent.click(screen.getByRole("button", { name: "寄送本週家長週報" }));

        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("寄出後無法收回"));
        await waitFor(() => expect(sendGuardianReportBatch).toHaveBeenCalledTimes(1));
        expect(sendGuardianReportBatch).toHaveBeenCalledWith(firebaseUser);
        await waitFor(() => expect(screen.getByRole("button", { name: "寄送本週家長週報" })).toBeEnabled());
    });

    test("does not send parent reports when the admin cancels the confirmation", async () => {
        window.confirm.mockReturnValue(false);
        renderPage();
        await screen.findByText(academyStudent.name);

        fireEvent.click(screen.getByRole("button", { name: "寄送本週家長週報" }));

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(sendGuardianReportBatch).not.toHaveBeenCalled();
    });

    test("hides the parent report button from teachers", async () => {
        useAuth.mockReturnValue({ firebaseUser, role: "teacher", studentProfile: { firebase_uid: firebaseUser.uid } });
        renderPage();
        await screen.findByText(academyStudent.name);

        expect(screen.queryByRole("button", { name: "寄送本週家長週報" })).not.toBeInTheDocument();
    });

    test("filters by role, class, plan, activation, account and access status", async () => {
        getManagedAccounts.mockResolvedValue({
            accounts: [academyStudent, archivedTrialStudent]
        });
        renderPage();

        expect(await screen.findByText("E3 測試學生")).toBeInTheDocument();
        expect(screen.queryByText("已停用試用學生")).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("進階篩選", { exact: true }));
        fireEvent.change(screen.getByRole("combobox", { name: "角色" }), {
            target: { value: "student" }
        });
        fireEvent.change(screen.getByRole("combobox", { name: "班級" }), {
            target: { value: "E1" }
        });
        fireEvent.change(screen.getByRole("combobox", { name: "方案" }), {
            target: { value: "trial_7_day" }
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

        expect(screen.getByText("進階篩選（已套用 4 項）")).toBeInTheDocument();
        fireEvent.click(screen.getByText("進階篩選（已套用 4 項）"));
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


test("account management no longer has a birthday correction entry, even for an admin", async () => {
    useAuth.mockReturnValue({firebaseUser,role:"admin",studentProfile:{firebase_uid:firebaseUser.uid}});
    getManagedAccounts.mockResolvedValue({accounts:[academyStudent]});listAcademyInvitations.mockResolvedValue([]);
    render(<MemoryRouter><AccountManagement /></MemoryRouter>);await screen.findByText(academyStudent.name);
    expect(screen.queryByRole("button",{name:"更正生日"})).not.toBeInTheDocument();
    expect(getManagedBirthDateHistory).not.toHaveBeenCalled();
});
test("teacher account management has no birthday correction entry", async () => {
    useAuth.mockReturnValue({firebaseUser,role:"teacher",studentProfile:{firebase_uid:firebaseUser.uid}});
    getManagedAccounts.mockResolvedValue({accounts:[academyStudent]});listAcademyInvitations.mockResolvedValue([]);
    render(<MemoryRouter><AccountManagement /></MemoryRouter>);await screen.findByText(academyStudent.name);
    expect(screen.queryByRole("button",{name:"更正生日"})).not.toBeInTheDocument();
});


test("page navigation is cached and restores the filtered page on return", async () => {
    const accounts = Array.from({ length: 60 }, (_, i) => ({ ...academyStudent, id: i + 100, name: `Student ${String(i + 1).padStart(2, "0")}` }));
    getManagedAccounts.mockResolvedValue({ accounts }); listAcademyInvitations.mockResolvedValue([]);
    useAuth.mockReturnValue({ firebaseUser, role: "admin", studentProfile: { firebase_uid: firebaseUser.uid } });
    const first = renderPage(); await screen.findByText("Student 01"); expect(within(screen.getByRole("table", { name: "帳號清單" })).getAllByRole("row")).toHaveLength(26);
    fireEvent.click(screen.getByRole("button", { name: "下一頁" })); expect(screen.getByText("Student 26")).toBeInTheDocument(); first.unmount();
    renderPage(); expect(screen.getByText("Student 26")).toBeInTheDocument(); await waitFor(() => expect(getManagedAccounts).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText("姓名或 Email"), { target: { value: "Student 60" } }); expect(screen.getByText("Student 60")).toBeInTheDocument(); expect(screen.queryByRole("navigation", { name: "帳號清單分頁" })).not.toBeInTheDocument();
});

test("failed background reload retains accounts, and explicit retry recovers", async () => {
    clearStaffPageCache(); getManagedAccounts.mockResolvedValue({ accounts: [academyStudent] }); listAcademyInvitations.mockResolvedValue([]);
    useAuth.mockReturnValue({ firebaseUser, role: "admin", studentProfile: { firebase_uid: firebaseUser.uid } });
    renderPage(); await screen.findByText(academyStudent.name);
    const clock = Date.now(); const now = jest.spyOn(Date, "now").mockReturnValue(clock + 31000);
    getManagedAccounts.mockRejectedValueOnce(new TypeError("offline")); await act(async () => window.dispatchEvent(new Event("focus")));
    expect(await screen.findByText("目前顯示上次帳號清單，最新資料暫時無法同步。")).toBeInTheDocument(); expect(screen.getByText(academyStudent.name)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取" })); await waitFor(() => expect(screen.queryByText("目前顯示上次帳號清單，最新資料暫時無法同步。")).not.toBeInTheDocument()); now.mockRestore();
});
