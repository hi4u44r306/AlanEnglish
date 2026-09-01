import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminClassMaterials from "./AdminClassMaterials";
import { useAuth } from "../../auth/AuthContext";
import { loadCommerceAdmin, previewClassMaterials, saveClassMaterials } from "../../services/commerceService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/commerceService", () => ({
    loadCommerceAdmin: jest.fn(),
    previewClassMaterials: jest.fn(),
    saveClassMaterials: jest.fn()
}));

const adminData = {
    role: "admin",
    read_only: false,
    classes: [{ id: 1, code: "E1", name_zh: "E1" }],
    books: [
        { id: 1, name: "Workbook 1", code: "Workbook_1", book_categories: { name: "習作本" } },
        { id: 2, name: "Workbook 2", code: "Workbook_2", book_categories: { name: "習作本" } }
    ],
    settings: [{
        id: 10,
        class_id: 1,
        version: 1,
        note: "2026 春季",
        effective_from: "2026-02-01",
        academy_class_material_books: [{ book_id: 1 }]
    }],
    audit: []
};

describe("AdminClassMaterials term rollover wizard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({ firebaseUser: { uid: "admin-1" } });
        loadCommerceAdmin.mockResolvedValue(adminData);
        previewClassMaterials.mockResolvedValue({
            preview: true,
            previous_book_ids: [1],
            historical_book_ids: [1],
            next_book_ids: [1, 2],
            added_book_ids: [2],
            removed_book_ids: [],
            affected_student_count: 5,
            retained_student_count: 7,
            retained_entitlement_count: 7,
            affected_assignment_count: 2
        });
        saveClassMaterials.mockResolvedValue({ setting: { id: 11, version: 2 } });
    });

    it("separates retained old books from the new term selection", async () => {
        render(<AdminClassMaterials />);

        expect(await screen.findByText("E1 第 1 版")).toBeInTheDocument();
        expect(screen.getByText(/2026 春季/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", { name: /Workbook 2/ }));
        fireEvent.click(screen.getByRole("button", { name: "預覽影響" }));

        await waitFor(() => expect(previewClassMaterials).toHaveBeenCalledWith(
            { uid: "admin-1" },
            expect.objectContaining({ class_code: "E1", book_ids: [1, 2] })
        ));
        expect(await screen.findByText(/涵蓋曾在校使用的 7 位學生/)).toBeInTheDocument();
        expect(screen.getByText(/這些教材不會從舊生帳號移除/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "二次確認並建立版本" })).toBeEnabled();
    });

    it("invalidates an old preview when the new book selection changes", async () => {
        render(<AdminClassMaterials />);
        await screen.findByText("E1 第 1 版");
        fireEvent.click(screen.getByRole("button", { name: "預覽影響" }));
        expect(await screen.findByText("換版影響預覽")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", { name: /Workbook 2/ }));
        expect(screen.queryByText("換版影響預覽")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "二次確認並建立版本" })).toBeDisabled();
    });
});
