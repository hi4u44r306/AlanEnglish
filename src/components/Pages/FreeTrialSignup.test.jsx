import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { toast } from "react-toastify";
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

describe("FreeTrialSignup", () => {
    beforeEach(() => jest.clearAllMocks());

    it("shows an inline error and restores the button when the Email already exists", async () => {
        createUserWithEmailAndPassword.mockRejectedValue({ code: "auth/email-already-in-use" });

        render(<MemoryRouter><FreeTrialSignup /></MemoryRouter>);

        fireEvent.change(screen.getByLabelText("學生姓名"), { target: { value: "測試學生" } });
        fireEvent.change(screen.getByLabelText("登入 Email"), { target: { value: "existing@example.com" } });
        fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "secret123" } });
        fireEvent.change(screen.getByLabelText("再次輸入密碼"), { target: { value: "secret123" } });
        fireEvent.click(screen.getByRole("button", { name: "開始 7 天免費試用" }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("這個 Email 已經註冊，請直接登入。");
        expect(screen.getByRole("link", { name: "前往登入" })).toHaveAttribute("href", "/");
        await waitFor(() => expect(screen.getByRole("button", { name: "開始 7 天免費試用" })).toBeEnabled());
        expect(toast.error).toHaveBeenCalledWith("這個 Email 已經註冊，請直接登入。");
    });
});
