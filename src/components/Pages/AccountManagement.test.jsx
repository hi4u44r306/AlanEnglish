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
});
