import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AcademyStudentCsvImport from "./AcademyStudentCsvImport";
import { previewAcademyStudents } from "../../services/academyStudentService";

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
            "中文姓名,英文姓名,可收信Email,班級,入班日期,權限截止日,備註",
            "王小明,Alan,parent@example.com,E1,2026-08-24,,"
        ].join("\n");
        const file = new File([csv], "students.csv", { type: "text/csv" });
        file.text = jest.fn().mockResolvedValue(csv);

        fireEvent.change(screen.getByLabelText("選擇 CSV 檔案"), {
            target: { files: [file] }
        });

        await waitFor(() => expect(previewAcademyStudents).toHaveBeenCalledTimes(1));
        expect(await screen.findByText("1 列可建立")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "建立 1 位學生" })).toBeEnabled();
        expect(screen.getByText("parent@example.com")).toBeInTheDocument();
    });
});
