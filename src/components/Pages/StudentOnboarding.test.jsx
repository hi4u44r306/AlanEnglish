import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StudentOnboarding from "./StudentOnboarding";
import { useAuth } from "../../auth/AuthContext";
import {
    confirmGuardianEmailVerification,
    requestGuardianEmailVerification
} from "../../services/membershipService";
import { enableWebPush, getCurrentWebPushStatus, getWebPushAvailability, getWebPushConfig } from "../../services/webPushService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/membershipService", () => ({
    confirmGuardianEmailVerification: jest.fn(),
    requestGuardianEmailVerification: jest.fn(),
    updateStudentProfile: jest.fn()
}));
jest.mock("../../services/academyStudentService", () => ({
    markAcademyPasswordChanged: jest.fn()
}));
jest.mock("../../services/webPushService", () => ({
    enableWebPush: jest.fn(),
    getCurrentWebPushStatus: jest.fn(),
    getWebPushAvailability: jest.fn(),
    getWebPushConfig: jest.fn()
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
        getWebPushAvailability.mockReturnValue({ supported: true, reason: "" });
        getWebPushConfig.mockResolvedValue({ enabled: true, public_key: "public-key" });
        getCurrentWebPushStatus.mockResolvedValue({ supported: true, reason: "", active: false });
        enableWebPush.mockResolvedValue();
    });

    it("shows all three required steps and the optional notification choice", async () => {
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);
        expect(screen.getByRole("heading", { name: "設定自己的密碼" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "確認出生年月日" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "驗證家長 Email" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "開啟網頁通知" })).toBeInTheDocument();
        expect(await screen.findByRole("button", { name: "稍後再說" })).toBeInTheDocument();
    });

    it("only requests browser notification permission after the student presses the opt-in button", async () => {
        getCurrentWebPushStatus
            .mockResolvedValueOnce({ supported: true, reason: "", active: false })
            .mockResolvedValueOnce({ supported: true, reason: "", active: true });
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        expect(enableWebPush).not.toHaveBeenCalled();
        fireEvent.click(await screen.findByRole("button", { name: "開啟此裝置通知" }));

        await waitFor(() => expect(enableWebPush).toHaveBeenCalledWith(
            expect.objectContaining({ email: "student@example.com" }),
            "public-key"
        ));
        expect(await screen.findByText("已開啟")).toBeInTheDocument();
    });

    it("lets a student skip optional notifications after the three required steps", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { email: "student@example.com", getIdToken: jest.fn() },
            studentProfile: {
                date_of_birth: "2015-04-08",
                guardian: { email: "parent@example.com", verified: true },
                onboarding: {
                    required: false,
                    steps: {
                        password_complete: true,
                        birthday_complete: true,
                        guardian_email_complete: true
                    }
                }
            },
            refreshStudentProfile,
            logout: jest.fn()
        });
        render(
            <MemoryRouter initialEntries={[{ pathname: "/student/onboarding", state: { firstLogin: true } }]}>
                <Routes>
                    <Route path="/student/onboarding" element={<StudentOnboarding />} />
                    <Route path="/student/leaderboard" element={<h1>學生首頁</h1>} />
                </Routes>
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: "稍後再說" }));
        expect(await screen.findByRole("heading", { name: "學生首頁" })).toBeInTheDocument();
        expect(enableWebPush).not.toHaveBeenCalled();
    });

    it("does not replace the guardian email until the code is confirmed", async () => {
        requestGuardianEmailVerification.mockResolvedValue({
            request_id: 19,
            masked_email: "p***@example.com"
        });
        confirmGuardianEmailVerification.mockResolvedValue({ success: true });
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);
        await screen.findByRole("button", { name: "稍後再說" });

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
