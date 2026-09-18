import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AcademyStudentCsvImport from "./AcademyStudentCsvImport";
import {
    createAcademyStudentsBatch,
    previewAcademyStudents
} from "../../services/academyStudentService";

jest.mock("qrcode", () => ({
    toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,one-pixel")
}));

jest.mock("../../utils/academyStudentLoginCardsDocx", () => ({
    downloadAcademyStudentLoginCardsDocx: jest.fn()
}));

jest.mock("../../utils/academyStudentLoginCardsPdf", () => ({
    downloadAcademyStudentLoginCardsPdf: jest.fn()
}));

jest.mock("../../auth/AuthContext", () => ({
    useAuth: () => ({
        firebaseUser: { getIdToken: jest.fn() }
    })
}));

jest.mock("../../services/academyStudentService", () => ({
    createAcademyStudentsBatch: jest.fn(),
    previewAcademyStudents: jest.fn()
}));

describe("AcademyStudentCsvImport", () => {
    test("選擇有效 CSV 後顯示伺服器預覽並允許建立", async () => {
        previewAcademyStudents.mockResolvedValue({
            summary: { total: 1, valid: 1, invalid: 0 },
            rows: [{ row_number: 1, valid: true, errors: [] }]
        });

        render(
            <MemoryRouter>
                <AcademyStudentCsvImport />
            </MemoryRouter>
        );

        const csv = [
            "中文姓名,英文姓名,登入帳號(選填),班級,入班日期,權限截止日,備註",
            "王小明,Alan,alanwang,E1,2026-08-24,,"
        ].join("\n");
        const file = new File([csv], "students.csv", { type: "text/csv" });
        file.text = jest.fn().mockResolvedValue(csv);

        fireEvent.change(screen.getByLabelText("選擇 CSV 檔案"), {
            target: { files: [file] }
        });

        await waitFor(() => expect(previewAcademyStudents).toHaveBeenCalledTimes(1));
        expect(await screen.findByText("1 列可建立")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "建立 1 位學生" })).toBeEnabled();
        expect(screen.getByText("alanwang")).toBeInTheDocument();
    });

    test("建立成功後同時顯示 Word、PDF 與列印入口", async () => {
        previewAcademyStudents.mockResolvedValue({
            summary: { total: 1, valid: 1, invalid: 0 },
            rows: [{ row_number: 1, valid: true, errors: [] }]
        });
        createAcademyStudentsBatch.mockResolvedValue({
            summary: { succeeded: 1, failed: 0 },
            results: [{
                row_number: 1,
                status: "success",
                credentials: {
                    username: "alanwang",
                    temporary_password: "AB12-CD34",
                    activation_url: "https://example.test/setup",
                    recovery_codes: ["123456", "654321"]
                }
            }]
        });
        window.confirm = jest.fn().mockReturnValue(true);

        render(
            <MemoryRouter>
                <AcademyStudentCsvImport />
            </MemoryRouter>
        );

        const csv = [
            "中文姓名,英文姓名,登入帳號(選填),班級,入班日期,權限截止日,備註",
            "王小明,Alan,alanwang,E1,2026-08-24,,"
        ].join("\n");
        const file = new File([csv], "students.csv", { type: "text/csv" });
        file.text = jest.fn().mockResolvedValue(csv);
        fireEvent.change(screen.getByLabelText("選擇 CSV 檔案"), { target: { files: [file] } });

        fireEvent.click(await screen.findByRole("button", { name: "建立 1 位學生" }));

        expect(await screen.findByRole("button", { name: "下載 Word 登入卡" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "下載 PDF 登入卡" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "列印 A4 登入卡" })).toBeInTheDocument();
    });
});
