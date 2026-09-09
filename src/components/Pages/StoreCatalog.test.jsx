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
        expect(screen.getByRole("navigation", { name: "教材商城導覽" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "查詢既有訂單" })).toHaveAttribute("href", "/shop/login?next=/shop/orders");
        await waitFor(() => expect(screen.getByText("教材包正在準備中，目前暫不販售。")).toBeInTheDocument());
    });

    test("清楚說明既有訂單仍可查詢", async () => {
        renderCatalog();
        expect(await screen.findByText("既有訂單仍可登入商城後查詢。")).toBeInTheDocument();
    });
});
