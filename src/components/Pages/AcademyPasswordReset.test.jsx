import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AcademyPasswordReset from "./AcademyPasswordReset";
import {
    completeGuardianPasswordReset,
    previewGuardianPasswordReset
} from "../../services/academyStudentService";

jest.mock("../../services/academyStudentService", () => ({
    previewGuardianPasswordReset: jest.fn(),
    completeGuardianPasswordReset: jest.fn()
}));

const renderPage = (entry = "/academy/reset-password?token=abc123") => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/academy/reset-password" element={<AcademyPasswordReset />} />
            <Route path="/login" element={<h1>登入頁</h1>} />
        </Routes>
    </MemoryRouter>
);

describe("AcademyPasswordReset", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        previewGuardianPasswordReset.mockResolvedValue({ success: true, username: "xiaoming", sent_to_masked: "p***@gmail.com" });
        completeGuardianPasswordReset.mockResolvedValue({ success: true, username: "xiaoming" });
        window.history.replaceState = jest.fn();
    });

    it("previews the link, removes the token from the address bar, and shows only the masked email", async () => {
        renderPage();
        expect(await screen.findByRole("heading", { name: "設定新的登入密碼" })).toBeInTheDocument();
        expect(previewGuardianPasswordReset).toHaveBeenCalledWith("abc123");
        expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/academy/reset-password");
        expect(screen.getByText(/xiaoming/)).toBeInTheDocument();
        expect(screen.getByText(/p\*\*\*@gmail\.com/)).toBeInTheDocument();
    });

    it("checks the two passwords before calling the server, then goes to login with the username", async () => {
        renderPage();
        fireEvent.change(await screen.findByLabelText("新的登入密碼"), { target: { value: "newpass1" } });
        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "newpass2" } });
        fireEvent.click(screen.getByRole("button", { name: "設定新密碼" }));
        expect(screen.getByRole("alert")).toHaveTextContent("兩次輸入的密碼不一致");
        expect(completeGuardianPasswordReset).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "newpass1" } });
        fireEvent.click(screen.getByRole("button", { name: "設定新密碼" }));
        await waitFor(() => expect(completeGuardianPasswordReset).toHaveBeenCalledWith("abc123", "newpass1"));
        expect(await screen.findByRole("heading", { name: "登入頁" })).toBeInTheDocument();
    });

    it("shows a helpful page with the two other ways when the link is invalid or missing", async () => {
        previewGuardianPasswordReset.mockRejectedValueOnce(new Error("重設連結無效或已過期。"));
        renderPage();
        expect(await screen.findByRole("heading", { name: "重設連結無法使用" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "重新要求" })).toHaveAttribute("href", "/forgot-password");
        expect(screen.getByRole("link", { name: "使用復原碼" })).toHaveAttribute("href", "/academy/recover");
    });

    it("does not call the server when there is no token", async () => {
        renderPage("/academy/reset-password");
        expect(await screen.findByRole("heading", { name: "重設連結無法使用" })).toBeInTheDocument();
        expect(previewGuardianPasswordReset).not.toHaveBeenCalled();
    });
});
