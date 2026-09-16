import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StudentOnboarding from "./StudentOnboarding";
import { useAuth } from "../../auth/AuthContext";
import {
    confirmGuardianEmailVerification,
    requestGuardianEmailVerification
} from "../../services/membershipService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/membershipService", () => ({
    confirmGuardianEmailVerification: jest.fn(),
    requestGuardianEmailVerification: jest.fn(),
    updateStudentProfile: jest.fn()
}));
jest.mock("../../services/academyStudentService", () => ({
    markAcademyPasswordChanged: jest.fn()
}));
jest.mock("firebase/auth", () => ({
    EmailAuthProvider: { credential: jest.fn() },
    reauthenticateWithCredential: jest.fn(),
    updatePassword: jest.fn()
}));

describe("StudentOnboarding", () => {
    const refreshStudentProfile = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({
            firebaseUser: { email: "student@example.com", getIdToken: jest.fn() },
            studentProfile: {
                date_of_birth: null,
                guardian: { email: null, verified: false },
                onboarding: {
                    required: true,
                    steps: {
                        password_complete: false,
                        birthday_complete: false,
                        guardian_email_complete: false
                    }
                }
            },
            refreshStudentProfile,
            logout: jest.fn()
        });
    });

    it("shows all three required first-login steps", () => {
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);
        expect(screen.getByRole("heading", { name: "設定自己的密碼" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "確認出生年月日" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "驗證家長 Email" })).toBeInTheDocument();
    });

    it("does not replace the guardian email until the code is confirmed", async () => {
        requestGuardianEmailVerification.mockResolvedValue({
            request_id: 19,
            masked_email: "p***@example.com"
        });
        confirmGuardianEmailVerification.mockResolvedValue({ success: true });
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        fireEvent.change(screen.getByLabelText("家長 Email"), { target: { value: "parent@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "寄送驗證碼" }));
        await waitFor(() => expect(requestGuardianEmailVerification).toHaveBeenCalledWith(
            expect.objectContaining({ email: "student@example.com" }),
            "parent@example.com"
        ));

        fireEvent.change(await screen.findByLabelText("6 位數驗證碼"), { target: { value: "123456" } });
        fireEvent.click(screen.getByRole("button", { name: "確認驗證碼" }));
        await waitFor(() => expect(confirmGuardianEmailVerification).toHaveBeenCalledWith(
            expect.objectContaining({ email: "student@example.com" }),
            19,
            "123456"
        ));
        expect(refreshStudentProfile).toHaveBeenCalled();
    });
});
