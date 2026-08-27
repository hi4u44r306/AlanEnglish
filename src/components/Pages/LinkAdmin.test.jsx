import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    bootstrapManagedLinks,
    getManagedLinks,
    updateManagedLink
} from "../../services/linkService";
import LinkAdmin from "./LinkAdmin";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/linkService", () => ({
    LINK_CATEGORIES: [
        { value: "exercise", label: "習作本" },
        { value: "listening", label: "聽力本" }
    ],
    bootstrapManagedLinks: jest.fn(),
    createManagedLink: jest.fn(),
    deleteManagedLink: jest.fn(),
    getManagedLinks: jest.fn(),
    updateManagedLink: jest.fn()
}));

describe("LinkAdmin editing", () => {
    const firebaseUser = { uid: "admin-test" };
    const originalLink = {
        id: 7,
        title: "習作本 2",
        url: "https://example.com/original",
        category: "exercise",
        sort_order: 20,
        is_active: true
    };

    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({ firebaseUser });
        bootstrapManagedLinks.mockResolvedValue({ links: [originalLink], migration: null });
        getManagedLinks.mockResolvedValue({
            links: [{ ...originalLink, title: "習作本 3", url: "https://example.com/updated" }]
        });
        updateManagedLink.mockResolvedValue({ success: true });
    });

    it("edits a link title and URL without changing its category or ordering fields", async () => {
        render(<LinkAdmin />);

        fireEvent.click(await screen.findByRole("button", { name: "編輯 習作本 2" }));
        fireEvent.change(screen.getByLabelText("編輯連結名稱"), { target: { value: " 習作本 3 " } });
        fireEvent.change(screen.getByLabelText("編輯連結網址"), { target: { value: " https://example.com/updated " } });
        fireEvent.click(screen.getByRole("button", { name: "儲存 習作本 2" }));

        await waitFor(() => expect(updateManagedLink).toHaveBeenCalledWith(firebaseUser, {
            id: 7,
            title: "習作本 3",
            url: "https://example.com/updated",
            category: "exercise",
            sort_order: 20,
            is_active: true
        }));
        expect(await screen.findByText("已更新「習作本 3」，公開頁面會直接顯示新名稱與網址。")).toBeInTheDocument();
        expect(screen.getByText("習作本 3")).toBeInTheDocument();
    });

    it("rejects an invalid edited URL before calling the backend", async () => {
        render(<LinkAdmin />);

        fireEvent.click(await screen.findByRole("button", { name: "編輯 習作本 2" }));
        fireEvent.change(screen.getByLabelText("編輯連結網址"), { target: { value: "javascript:alert(1)" } });
        fireEvent.click(screen.getByRole("button", { name: "儲存 習作本 2" }));

        expect(await screen.findByText("網址格式不正確，請輸入以 http:// 或 https:// 開頭的完整網址。")).toBeInTheDocument();
        expect(updateManagedLink).not.toHaveBeenCalled();
    });
});
