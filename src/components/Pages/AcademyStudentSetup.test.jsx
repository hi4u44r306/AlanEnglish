import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AcademyStudentSetup from "./AcademyStudentSetup";
import { activateStudentLogin, previewStudentActivation } from "../../services/academyStudentService";

jest.mock("../../services/academyStudentService", () => ({
    activateStudentLogin: jest.fn(),
    previewStudentActivation: jest.fn(),
    recoverStudentLogin: jest.fn()
}));

describe("AcademyStudentSetup", () => {
    beforeEach(() => jest.clearAllMocks());

    it("previews a one-time login card and activates a non-weak six-digit PIN", async () => {
        previewStudentActivation.mockResolvedValue({
            student: { name: "王小明", username: "alanwang01" },
            expires_at: "2026-09-24T00:00:00.000Z"
        });
        activateStudentLogin.mockResolvedValue({ username: "alanwang01" });

        render(
            <MemoryRouter initialEntries={["/academy/student-setup?token=one-time-token"]}>
                <Routes>
                    <Route path="/academy/student-setup" element={<AcademyStudentSetup />} />
                    <Route path="/login" element={<p>已前往登入</p>} />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByDisplayValue("alanwang01")).toHaveAttribute("readonly");
        fireEvent.change(screen.getByLabelText("新的 6 位數字"), { target: { value: "482731" } });
        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "482731" } });
        fireEvent.click(screen.getByRole("button", { name: "完成啟用" }));

        await waitFor(() => expect(activateStudentLogin).toHaveBeenCalledWith("one-time-token", "482731"));
        expect(await screen.findByText("已前往登入")).toBeInTheDocument();
    });
});
