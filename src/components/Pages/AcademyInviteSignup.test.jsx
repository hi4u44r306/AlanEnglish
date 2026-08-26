import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AcademyInviteSignup from "./AcademyInviteSignup";
import { previewAcademyInvitation } from "../../services/academyStudentService";

jest.mock("./firebase-config", () => ({ authentication: {} }));

jest.mock("firebase/auth", () => ({
    browserLocalPersistence: {},
    createUserWithEmailAndPassword: jest.fn(),
    deleteUser: jest.fn(),
    setPersistence: jest.fn()
}));

jest.mock("../../auth/AuthContext", () => ({
    useAuth: () => ({
        firebaseUser: null,
        logout: jest.fn()
    })
}));

jest.mock("../../services/academyStudentService", () => ({
    activateAcademyInvitation: jest.fn(),
    claimAcademyInvitation: jest.fn(),
    previewAcademyInvitation: jest.fn()
}));
jest.mock("../../services/authEmailService", () => ({ sendBrandedVerificationEmail: jest.fn() }));

describe("AcademyInviteSignup manual activation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("requires an account email and one-time activation code before password setup", async () => {
        previewAcademyInvitation.mockResolvedValue({
            invitation: {
                status: "active",
                invited_email: "student@gmail.com",
                chinese_name: "王小明",
                class_code: "E7"
            }
        });

        render(
            <MemoryRouter>
                <AcademyInviteSignup manualEntry />
            </MemoryRouter>
        );

        expect(screen.getByRole("heading", { name: "開通英文班帳號" })).toBeTruthy();

        fireEvent.change(screen.getByPlaceholderText("name@gmail.com"), {
            target: { value: "student@gmail.com" }
        });
        fireEvent.change(screen.getByPlaceholderText("AE-XXXX-XXXX-XXXX"), {
            target: { value: "ae-abcd-2345-wxyz" }
        });
        fireEvent.click(screen.getByRole("button", { name: "確認帳號並設定密碼" }));

        await waitFor(() => {
            expect(previewAcademyInvitation).toHaveBeenCalledWith(
                "AE-ABCD-2345-WXYZ",
                "student@gmail.com"
            );
        });

        expect(await screen.findByRole("heading", { name: "設定你的英文班帳號" })).toBeTruthy();
        expect(screen.getByText(/王小明，你受邀加入 E7 班/)).toBeTruthy();
        expect(screen.getByLabelText("出生年月日").type).toBe("date");
    });
});
