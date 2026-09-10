import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import AccountSecurity from "./AccountSecurity";
import { useAuth } from "../../auth/AuthContext";
import { reissueOwnAcademyRecoveryCodes } from "../../services/academyStudentService";

jest.mock("firebase/auth", () => ({
    EmailAuthProvider: { credential: jest.fn() },
    reauthenticateWithCredential: jest.fn(),
    updatePassword: jest.fn()
}));

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/academyStudentService", () => ({
    markAcademyPasswordChanged: jest.fn(),
    reissueOwnAcademyRecoveryCodes: jest.fn()
}));

describe("AccountSecurity", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({
            firebaseUser: { email: "student@login.alanenglish.com.tw" },
            role: "student",
            studentProfile: { authentication_method: "academy_username", login_username: "alanwang01" }
        });
    });

    it("requires the current password before an academy student can reissue recovery codes", async () => {
        const credential = { type: "password" };
        EmailAuthProvider.credential.mockReturnValue(credential);
        reauthenticateWithCredential.mockResolvedValue({});
        reissueOwnAcademyRecoveryCodes.mockResolvedValue({
            credentials: { recovery_codes: ["123456", "654321"] }
        });

        render(<AccountSecurity />);
        const currentPasswordFields = screen.getAllByLabelText("目前密碼");
        fireEvent.change(currentPasswordFields[1], { target: { value: "green7" } });
        fireEvent.click(screen.getByRole("button", { name: "重新產生我的復原碼" }));

        await waitFor(() => expect(reauthenticateWithCredential).toHaveBeenCalledWith(
            { email: "student@login.alanenglish.com.tw" },
            credential
        ));
        expect(reissueOwnAcademyRecoveryCodes).toHaveBeenCalledWith({ email: "student@login.alanenglish.com.tw" });
        expect(await screen.findByText(/123456/)).toHaveTextContent("654321");
    });
});
