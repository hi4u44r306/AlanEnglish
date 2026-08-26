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

    it("accepts a student-chosen password with at least six characters", async () => {
        previewStudentActivation.mockResolvedValue({
            student: { name: "王小明", chinese_name: "王小明", english_name: "Alan Wang", username: "alanwang01" },
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
        const password = screen.getByLabelText("新的登入密碼");
        expect(password).toHaveAttribute("autocapitalize", "none");
        fireEvent.change(password, { target: { value: "green7" } });
        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "green7" } });
        fireEvent.click(screen.getByRole("button", { name: "顯示密碼" }));
        expect(password).toHaveAttribute("type", "text");
        fireEvent.click(screen.getByRole("button", { name: "完成啟用" }));

        await waitFor(() => expect(activateStudentLogin).toHaveBeenCalledWith("one-time-token", "green7", {
            chineseName: "王小明",
            englishName: "Alan Wang"
        }));
        expect(await screen.findByText("已前往登入")).toBeInTheDocument();
    });

    it("explains why a password shorter than six characters cannot be submitted", async () => {
        previewStudentActivation.mockResolvedValue({
            student: { name: "王小明", chinese_name: "王小明", english_name: "Alan Wang", username: "alanwang01" },
            expires_at: "2026-09-24T00:00:00.000Z"
        });

        render(
            <MemoryRouter initialEntries={["/academy/student-setup?token=one-time-token"]}>
                <Routes>
                    <Route path="/academy/student-setup" element={<AcademyStudentSetup />} />
                </Routes>
            </MemoryRouter>
        );

        fireEvent.change(await screen.findByLabelText("新的登入密碼"), { target: { value: "abc" } });
        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "abc" } });
        expect(screen.getByText("還需要 3 個字元。")).toBeInTheDocument();

        fireEvent.submit(screen.getByRole("button", { name: "完成啟用" }).closest("form"));
        expect(await screen.findByRole("alert")).toHaveTextContent("密碼至少需要 6 個字元");
        expect(activateStudentLogin).not.toHaveBeenCalled();
    });

    it("requires both Chinese and English names during first activation", async () => {
        previewStudentActivation.mockResolvedValue({
            student: { name: "王小明", chinese_name: "王小明", english_name: "", username: "alanwang01" },
            expires_at: "2026-09-24T00:00:00.000Z"
        });

        render(
            <MemoryRouter initialEntries={["/academy/student-setup?token=one-time-token"]}>
                <Routes><Route path="/academy/student-setup" element={<AcademyStudentSetup />} /></Routes>
            </MemoryRouter>
        );

        fireEvent.change(await screen.findByLabelText("新的登入密碼"), { target: { value: "green7" } });
        fireEvent.change(screen.getByLabelText("再輸入一次"), { target: { value: "green7" } });
        fireEvent.submit(screen.getByRole("button", { name: "完成啟用" }).closest("form"));

        expect(await screen.findByRole("alert")).toHaveTextContent("請輸入學生英文姓名");
        expect(activateStudentLogin).not.toHaveBeenCalled();
    });
});
