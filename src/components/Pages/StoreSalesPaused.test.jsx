import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StoreSalesPaused from "./StoreSalesPaused";

jest.mock("../../store/StoreContext", () => ({
    useStore: () => ({ user: null, authLoading: false, cartCount: 0, signOut: jest.fn() })
}));
jest.mock("../fragment/Brand", () => () => <span>ALAN ENGLISH</span>);

test("暫停販售頁不提供結帳，仍提供既有訂單查詢", () => {
    render(<MemoryRouter><StoreSalesPaused /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "教材包暫未開放販售" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查詢既有訂單" })).toHaveAttribute("href", "/shop/login?next=/shop/orders");
    expect(screen.queryByRole("link", { name: /購物車/ })).not.toBeInTheDocument();
});
