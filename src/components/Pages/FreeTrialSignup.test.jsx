import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { toast } from "react-toastify";
import { completePublicSignup } from "../../services/membershipService";
import FreeTrialSignup from "./FreeTrialSignup";

jest.mock("firebase/auth", () => ({
    browserLocalPersistence: {},
    createUserWithEmailAndPassword: jest.fn(),
    sendEmailVerification: jest.fn(),
    setPersistence: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("react-toastify", () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn()
    }
}));

jest.mock("./firebase-config", () => ({ authentication: {} }));
jest.mock("../../services/membershipService", () => ({ completePublicSignup: jest.fn() }));
jest.mock("../../auth/authService", () => ({ saveStudentSession: jest.fn() }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: null }) }));

describe("FreeTrialSignup", () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => consoleErrorSpy.mockRestore());

    const renderSignup = () => render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <FreeTrialSignup />
        </MemoryRouter>
    );

    const completeForm = (email = "student@example.com") => {
        fireEvent.change(screen.getByLabelText("學生姓名"), { target: { value: "測試學生" } });
        fireEvent.change(screen.getByLabelText("登入 Email"), { target: { value: email } });
        fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "secret123" } });
        fireEvent.change(screen.getByLabelText("再次輸入密碼"), { target: { value: "secret123" } });
    };

    it("shows an inline error and restores the button when the Email already exists", async () => {
        createUserWithEmailAndPassword.mockRejectedValue({ code: "auth/email-already-in-use" });

        renderSignup();

        completeForm("existing@example.com");
        fireEvent.click(screen.getByRole("button", { name: "開始 7 天免費試用" }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("這個 Email 已經註冊，請直接登入。");
        expect(screen.getByRole("link", { name: "前往登入" })).toHaveAttribute("href", "/");
        await waitFor(() => expect(screen.getByRole("button", { name: "開始 7 天免費試用" })).toBeEnabled());
        expect(toast.error).toHaveBeenCalledWith("這個 Email 已經註冊，請直接登入。");
    });

    it("keeps the created account recoverable when the first verification email fails", async () => {
        const user = { email: "student@example.com", emailVerified: false };
        createUserWithEmailAndPassword.mockResolvedValue({ user });
        completePublicSignup.mockResolvedValue({
            profile: { id: 123, role: "student" },
            email_verification_required: true
        });
        sendEmailVerification.mockRejectedValueOnce({ code: "auth/network-request-failed" });

        renderSignup();
        completeForm();
        fireEvent.click(screen.getByRole("button", { name: "開始 7 天免費試用" }));

        expect(await screen.findByRole("heading", { name: "請先驗證 Email" })).toBeInTheDocument();
        expect(await screen.findByRole("status")).toHaveTextContent("網路連線失敗，請確認連線後重新寄送。");
        expect(screen.getByRole("button", { name: "重新寄送驗證信" })).toBeEnabled();

        sendEmailVerification.mockResolvedValueOnce(undefined);
        fireEvent.click(screen.getByRole("button", { name: "重新寄送驗證信" }));

        await waitFor(() => expect(sendEmailVerification).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole("status")).toHaveTextContent("驗證信已寄出");
        expect(screen.getByRole("button", { name: /秒後可重新寄送/ })).toBeDisabled();
    });
});
