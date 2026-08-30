import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StoreCatalog from "./StoreCatalog";

const mockAddToCart = jest.fn();
jest.mock("../../store/StoreContext", () => ({
    useStore: () => ({ user: null, authLoading: false, cartCount: 0, signOut: jest.fn(), addToCart: mockAddToCart })
}));
jest.mock("../../services/commerceService", () => ({
    loadMaterialPackages: jest.fn().mockResolvedValue({ packages: [] }),
    loadPlacementAssessment: jest.fn().mockResolvedValue({ assessment: null }),
    submitPlacementAssessment: jest.fn()
}));
jest.mock("../fragment/Brand", () => () => <span>ALAN ENGLISH</span>);

const renderCatalog = () => render(<MemoryRouter initialEntries={["/shop"]}><Routes><Route path="/shop" element={<StoreCatalog />} /></Routes></MemoryRouter>);

describe("StoreCatalog", () => {
    beforeEach(() => mockAddToCart.mockClear());

    test("任何人可以看到商城導覽與登入入口", async () => {
        renderCatalog();
        expect(screen.getByRole("navigation", { name: "教材商城主要導覽" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "登入／註冊" })).toHaveAttribute("href", "/shop/login");
        await waitFor(() => expect(screen.getByText("商品包尚在整理，正式價格未確認前不會自行上架。")).toBeInTheDocument());
    });

    test("清楚說明商城與聽力平台帳號分離", async () => {
        renderCatalog();
        expect(await screen.findByText(/商城帳號不會登入聽力平台/)).toBeInTheDocument();
    });
});
