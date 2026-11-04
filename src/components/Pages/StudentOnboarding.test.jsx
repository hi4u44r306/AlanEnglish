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
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { markAcademyPasswordChanged } from "../../services/academyStudentService";

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

    it("shows only the first incomplete step and defers notifications until required setup is complete", () => {
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);
        expect(screen.getByRole("heading", { name: "設定自己的密碼" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "確認出生年月日" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "驗證家長 Email" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "開啟網頁通知" })).not.toBeInTheDocument();
        expect(getWebPushConfig).not.toHaveBeenCalled();
    });

    it("advances only after the profile confirms the prior step, preserving later form state", () => {
        const context = useAuth();
        const view = render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);
        useAuth.mockReturnValue({ ...context, studentProfile: { ...context.studentProfile, onboarding: { required: true, steps: { password_complete: true, guardian_email_complete: false } } } });
        view.rerender(<MemoryRouter><StudentOnboarding /></MemoryRouter>);
        expect(screen.getByRole("heading", { name: "驗證家長 Email" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "設定自己的密碼" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "確認出生年月日" })).not.toBeInTheDocument();
    });

    it("only requests browser notification permission after the student presses the opt-in button", async () => {
        getCurrentWebPushStatus
            .mockResolvedValueOnce({ supported: true, reason: "", active: false })
            .mockResolvedValueOnce({ supported: true, reason: "", active: true });
        const context = useAuth();
        useAuth.mockReturnValue({ ...context, studentProfile: { ...context.studentProfile, onboarding: { required: false, steps: { password_complete: true, guardian_email_complete: true } } } });
        render(<MemoryRouter initialEntries={[{ pathname: "/student/onboarding", state: { firstLogin: true } }]}><StudentOnboarding /></MemoryRouter>);

        expect(enableWebPush).not.toHaveBeenCalled();
        fireEvent.click(await screen.findByRole("button", { name: "開啟此裝置通知" }));

        await waitFor(() => expect(enableWebPush).toHaveBeenCalledWith(
            expect.objectContaining({ email: "student@example.com" }),
            "public-key"
        ));
        expect(await screen.findByText("已開啟")).toBeInTheDocument();
    });

    it("lets a student skip optional notifications after the two required steps", async () => {
        useAuth.mockReturnValue({
            firebaseUser: { email: "student@example.com", getIdToken: jest.fn() },
            studentProfile: {
                date_of_birth: "2015-04-08",
                guardian: { email: "parent@example.com", verified: true },
                onboarding: {
                    required: false,
                    steps: {
                        password_complete: true,
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
                    <Route path="/student/dashboard" element={<h1>學生首頁</h1>} />
                </Routes>
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: "稍後再說" }));
        expect(await screen.findByRole("heading", { name: "學生首頁" })).toBeInTheDocument();
        expect(enableWebPush).not.toHaveBeenCalled();
    });

    const guardianStepContext = () => {
        const context = useAuth();
        useAuth.mockReturnValue({ ...context, studentProfile: { ...context.studentProfile, onboarding: { required: true, steps: { password_complete: true, guardian_email_complete: false } } } });
    };

    it("does not ask for a birthday and shows a prominent notice about the weekly report and password recovery", () => {
        guardianStepContext();
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        expect(screen.queryByText(/出生年月日|生日/)).not.toBeInTheDocument();
        expect(screen.getByText("1／2 已完成")).toBeInTheDocument();
        const notice = screen.getByRole("note");
        expect(notice).toHaveClass("student-onboarding-critical");
        expect(notice).toHaveTextContent("每週學習進度報告");
        expect(notice).toHaveTextContent("忘記密碼");
        expect(notice).toHaveTextContent("填錯將收不到");
    });

    it("blocks sending when the two guardian emails differ", () => {
        guardianStepContext();
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        fireEvent.change(screen.getByLabelText("家長 Email"), { target: { value: "parent@example.com" } });
        fireEvent.change(screen.getByLabelText("再輸入一次家長 Email"), { target: { value: "parnet@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "下一步：確認信箱" }));

        expect(screen.getByRole("alert")).toHaveTextContent("兩次輸入的家長 Email 不一致");
        expect(requestGuardianEmailVerification).not.toHaveBeenCalled();
        expect(screen.queryByRole("group", { name: "確認家長 Email" })).not.toBeInTheDocument();
    });

    it("shows the full address for confirmation first and only sends after the student confirms", async () => {
        guardianStepContext();
        requestGuardianEmailVerification.mockResolvedValue({ request_id: 19, masked_email: "p***@example.com" });
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        fireEvent.change(screen.getByLabelText("家長 Email"), { target: { value: " Parent@Example.com " } });
        fireEvent.change(screen.getByLabelText("再輸入一次家長 Email"), { target: { value: "parent@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "下一步：確認信箱" }));

        const confirmBox = screen.getByRole("group", { name: "確認家長 Email" });
        expect(confirmBox).toHaveTextContent("驗證碼將寄到 parent@example.com");
        expect(requestGuardianEmailVerification).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "修改" }));
        expect(screen.getByLabelText("家長 Email")).toBeInTheDocument();
        expect(requestGuardianEmailVerification).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "下一步：確認信箱" }));
        fireEvent.click(screen.getByRole("button", { name: "確認寄出" }));
        await waitFor(() => expect(requestGuardianEmailVerification).toHaveBeenCalledWith(
            expect.objectContaining({ email: "student@example.com" }),
            "parent@example.com"
        ));
    });

    it("lets a student who just logged in with the temporary password set a new one directly, without typing the temporary password again", async () => {
        reauthenticateWithCredential.mockRejectedValue({ code: "auth/invalid-credential" });
        updatePassword.mockResolvedValue();
        markAcademyPasswordChanged.mockResolvedValue({ success: true });
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        expect(screen.queryByLabelText(/臨時密碼/)).not.toBeInTheDocument();
        expect(screen.getByText(/不用再輸入一次臨時密碼/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("新密碼"), { target: { value: "my-new-pass" } });
        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "my-new-pass" } });
        fireEvent.click(screen.getByRole("button", { name: "設定新密碼" }));

        await waitFor(() => expect(updatePassword).toHaveBeenCalledWith(expect.objectContaining({ email: "student@example.com" }), "my-new-pass"));
        await waitFor(() => expect(markAcademyPasswordChanged).toHaveBeenCalled());
        expect(refreshStudentProfile).toHaveBeenCalled();
    });

    it("does not allow the new password to be the same as the temporary password", async () => {
        reauthenticateWithCredential.mockResolvedValue({});
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        fireEvent.change(screen.getByLabelText("新密碼"), { target: { value: "48291357" } });
        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "48291357" } });
        fireEvent.click(screen.getByRole("button", { name: "設定新密碼" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("新密碼不可與一次性臨時密碼相同");
        expect(updatePassword).not.toHaveBeenCalled();
        expect(markAcademyPasswordChanged).not.toHaveBeenCalled();
    });

    it("only asks for the temporary password again when Firebase wants a fresh sign-in", async () => {
        reauthenticateWithCredential.mockRejectedValueOnce({ code: "auth/invalid-credential" });
        updatePassword
            .mockRejectedValueOnce({ code: "auth/requires-recent-login" })
            .mockResolvedValueOnce();
        markAcademyPasswordChanged.mockResolvedValue({ success: true });
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        fireEvent.change(screen.getByLabelText("新密碼"), { target: { value: "my-new-pass" } });
        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "my-new-pass" } });
        fireEvent.click(screen.getByRole("button", { name: "設定新密碼" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("請再輸入一次剛剛登入用的一次性臨時密碼");
        const current = await screen.findByLabelText("剛剛登入用的一次性臨時密碼");
        fireEvent.change(current, { target: { value: "48291357" } });
        reauthenticateWithCredential.mockResolvedValueOnce({});
        fireEvent.click(screen.getByRole("button", { name: "設定新密碼" }));

        await waitFor(() => expect(EmailAuthProvider.credential).toHaveBeenCalledWith("student@example.com", "48291357"));
        await waitFor(() => expect(updatePassword).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(markAcademyPasswordChanged).toHaveBeenCalled());
    });

    it("does not replace the guardian email until the code is confirmed", async () => {
        requestGuardianEmailVerification.mockResolvedValue({
            request_id: 19,
            masked_email: "p***@example.com"
        });
        confirmGuardianEmailVerification.mockResolvedValue({ success: true });
        guardianStepContext();
        render(<MemoryRouter><StudentOnboarding /></MemoryRouter>);

        fireEvent.change(screen.getByLabelText("家長 Email"), { target: { value: "parent@example.com" } });
        fireEvent.change(screen.getByLabelText("再輸入一次家長 Email"), { target: { value: "parent@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "下一步：確認信箱" }));
        fireEvent.click(screen.getByRole("button", { name: "確認寄出" }));
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
