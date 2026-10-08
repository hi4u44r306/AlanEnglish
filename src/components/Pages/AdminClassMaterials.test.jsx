import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminClassMaterials from "./AdminClassMaterials";
import { useAuth } from "../../auth/AuthContext";
import {
    correctCurrentClassMaterials,
    loadCommerceAdmin,
    previewClassMaterials,
    previewCurrentClassMaterials,
    saveClassMaterials
} from "../../services/commerceService";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/commerceService", () => ({
    loadCommerceAdmin: jest.fn(),
    previewClassMaterials: jest.fn(),
    saveClassMaterials: jest.fn(),
    previewCurrentClassMaterials: jest.fn(),
    correctCurrentClassMaterials: jest.fn()
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
        is_active: true,
        effective_to: null,
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
        correctCurrentClassMaterials.mockResolvedValue({ setting: { id: 10, version: 1 } });
        window.confirm = jest.fn(() => true);
    });

    it("shows current books per class and switches locally while invalidating the preview", async () => {
        loadCommerceAdmin.mockResolvedValue({ ...adminData, classes: [...adminData.classes, { id: 3, code: "E3" }],
            settings: [...adminData.settings, { ...adminData.settings[0], id: 30, class_id: 3, academy_class_material_books: [{ book_id: 2 }] }] });
        render(<AdminClassMaterials />);
        expect(screen.getByRole("heading", { name: "班級教材設定", level: 1 })).toBeInTheDocument();
        const e1 = await screen.findByRole("button", { name: "查看 E1 班目前教材" });
        await waitFor(() => expect(e1).toBeEnabled());
        expect(e1).toHaveTextContent("Workbook 1");
        expect(screen.getByRole("button", { name: "查看 E3 班目前教材" })).toHaveTextContent("Workbook 2");
        fireEvent.click(screen.getByRole("button", { name: "預覽換版影響" }));
        await screen.findByText("換版影響預覽");
        fireEvent.click(screen.getByRole("button", { name: "查看 E3 班目前教材" }));
        expect(screen.getByLabelText("班級")).toHaveValue("E3");
        expect(screen.queryByText("換版影響預覽")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "二次確認並建立版本" })).toBeDisabled();
        expect(loadCommerceAdmin).toHaveBeenCalledTimes(1);
        expect(saveClassMaterials).not.toHaveBeenCalled();
    });

    it("keeps teacher viewing read-only and only shows returned authorized classes", async () => {
        loadCommerceAdmin.mockResolvedValue({ ...adminData, read_only: true, classes: [{ id: 1, code: "E3" }],
            settings: [{ ...adminData.settings[0], class_id: 1 }] });
        render(<AdminClassMaterials />);
        await screen.findByText("老師為唯讀模式，不能修改班級教材設定。");
        expect(screen.queryByRole("button", { name: "查看 E1 班目前教材" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "查看 E3 班目前教材" })).toBeInTheDocument();
        screen.getAllByRole("checkbox").forEach(input => expect(input).toBeDisabled());
        expect(screen.queryByRole("button", { name: "預覽換版影響" })).not.toBeInTheDocument();
        expect(loadCommerceAdmin).toHaveBeenCalledTimes(1);
    });

    it("requires confirmation after preview and does not save when canceled", async () => {
        window.confirm.mockReturnValue(false);
        render(<AdminClassMaterials />);
        await screen.findByText("E1 第 1 版");
        expect(screen.getByRole("button", { name: "二次確認並建立版本" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "預覽換版影響" }));
        await screen.findByText("換版影響預覽");
        fireEvent.click(screen.getByRole("button", { name: "二次確認並建立版本" }));
        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(saveClassMaterials).not.toHaveBeenCalled();
    });

    it("distinguishes a loading failure from an unconfigured class and supports retry", async () => {
        loadCommerceAdmin.mockRejectedValueOnce(new Error("連線失敗"));
        render(<AdminClassMaterials />);
        expect(await screen.findByRole("alert")).toHaveTextContent("連線失敗");
        expect(screen.queryByRole("button", { name: "查看 E1 班目前教材" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "重新讀取班級教材" }));
        expect(await screen.findByRole("button", { name: "查看 E1 班目前教材" })).toHaveTextContent("Workbook 1");
    });

    it("separates retained old books from the new term selection", async () => {
        render(<AdminClassMaterials />);

        expect(await screen.findByText("E1 第 1 版")).toBeInTheDocument();
        expect(screen.getByText(/2026 春季/, { selector: ".commerce-current-term span" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", { name: /Workbook 2/ }));
        fireEvent.click(screen.getByRole("button", { name: "預覽換版影響" }));

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
        fireEvent.click(screen.getByRole("button", { name: "預覽換版影響" }));
        expect(await screen.findByText("換版影響預覽")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", { name: /Workbook 2/ }));
        expect(screen.queryByText("換版影響預覽")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "二次確認並建立版本" })).toBeDisabled();
    });

    it("lets an administrator replace a mistakenly selected current book", async () => {
        const effectiveToday = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
        }).format(new Date());
        loadCommerceAdmin.mockResolvedValue({
            ...adminData,
            settings: [{
                ...adminData.settings[0],
                version: 2,
                note: "2026 秋季",
                effective_from: effectiveToday,
                updated_at: "2026-09-01T11:33:45.348652+00:00"
            }]
        });
        previewCurrentClassMaterials.mockResolvedValue({
            preview: true,
            correction: true,
            setting_id: 10,
            setting_updated_at: "2026-09-01T11:33:45.348652+00:00",
            previous_book_ids: [1],
            next_book_ids: [2],
            added_book_ids: [2],
            removed_book_ids: [1],
            affected_student_count: 5,
            affected_assignment_count: 0,
            has_changes: true
        });

        render(<AdminClassMaterials />);

        expect(await screen.findByText("修正後保留的教材")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("checkbox", { name: /Workbook 2/ }));
        fireEvent.click(screen.getByRole("button", { name: "從本版本移除 Workbook 1" }));
        fireEvent.click(screen.getByRole("button", { name: "預覽修正影響" }));

        await waitFor(() => expect(previewCurrentClassMaterials).toHaveBeenCalledWith(
            { uid: "admin-1" },
            expect.objectContaining({ setting_id: 10, book_ids: [2] })
        ));
        expect(await screen.findByText(/上述移除教材不再由目前班級版本提供/)).toBeInTheDocument();
        expect(screen.getByText(/本次移除：/).parentElement).toHaveTextContent("Workbook 1");
    });

    it("allows an administrator to preview and correct today's version more than once", async () => {
        const effectiveToday = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
        }).format(new Date());
        loadCommerceAdmin.mockResolvedValue({
            ...adminData,
            settings: [{
                ...adminData.settings[0],
                version: 2,
                note: "2026 秋季",
                effective_from: effectiveToday,
                updated_at: "2026-09-01T11:33:45.348652+00:00"
            }]
        });
        previewCurrentClassMaterials
            .mockResolvedValueOnce({
                preview: true,
                correction: true,
                setting_id: 10,
                setting_updated_at: "2026-09-01T11:33:45.348652+00:00",
                previous_book_ids: [1],
                next_book_ids: [1, 2],
                added_book_ids: [2],
                removed_book_ids: [],
                affected_student_count: 5,
                affected_assignment_count: 2,
                has_changes: true
            })
            .mockResolvedValueOnce({
                preview: true,
                correction: true,
                setting_id: 10,
                setting_updated_at: "2026-09-01T11:34:45.348652+00:00",
                previous_book_ids: [1, 2],
                next_book_ids: [1],
                added_book_ids: [],
                removed_book_ids: [2],
                affected_student_count: 5,
                affected_assignment_count: 2,
                has_changes: true
            });

        render(<AdminClassMaterials />);

        expect(await screen.findByText("E1 第 2 版")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "建立新學期版本" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "修正目前版本" })).toBeEnabled();

        fireEvent.click(screen.getByRole("checkbox", { name: /Workbook 2/ }));
        fireEvent.click(screen.getByRole("button", { name: "預覽修正影響" }));
        expect(await screen.findByText("目前版本修正預覽")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "二次確認並修正目前版本" }));

        await waitFor(() => expect(correctCurrentClassMaterials).toHaveBeenCalledTimes(1));
        expect(correctCurrentClassMaterials).toHaveBeenLastCalledWith(
            { uid: "admin-1" },
            expect.objectContaining({ setting_id: 10, book_ids: [1, 2], expected_updated_at: "2026-09-01T11:33:45.348652+00:00" })
        );

        fireEvent.click(screen.getByRole("checkbox", { name: /Workbook 2/ }));
        fireEvent.click(screen.getByRole("button", { name: "預覽修正影響" }));
        await waitFor(() => expect(previewCurrentClassMaterials).toHaveBeenCalledTimes(2));
        fireEvent.click(screen.getByRole("button", { name: "二次確認並修正目前版本" }));

        await waitFor(() => expect(correctCurrentClassMaterials).toHaveBeenCalledTimes(2));
    });
});
