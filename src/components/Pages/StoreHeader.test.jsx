import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import StoreHeader from "./StoreHeader";
import { useStore } from "../../store/StoreContext";

jest.mock("../../store/StoreContext", () => ({ useStore: jest.fn() }));

describe("StoreHeader navigation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useStore.mockReturnValue({ user: null, authLoading: false, cartCount: 2, signOut: jest.fn() });
    });

    it("provides routes back to the public site and learning platform", () => {
        render(<MemoryRouter><StoreHeader /></MemoryRouter>);

        expect(screen.getByRole("link", { name: "網站首頁" })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: "學習平台" })).toHaveAttribute("href", "/userinfo");
        expect(screen.getByRole("link", { name: "購物車，目前有 2 件商品" })).toHaveAttribute("href", "/shop/cart");
        expect(screen.getByRole("link", { name: "商城登入" })).toHaveAttribute("href", "/shop/login");
    });

    it("shows order history and signs a store user out", () => {
        const signOut = jest.fn();
        useStore.mockReturnValue({ user: { id: "store-user" }, authLoading: false, cartCount: 0, signOut });
        render(<MemoryRouter><StoreHeader /></MemoryRouter>);

        expect(screen.getByRole("link", { name: "我的訂單" })).toHaveAttribute("href", "/shop/orders");
        fireEvent.click(screen.getByRole("button", { name: "商城登出" }));
        expect(signOut).toHaveBeenCalledTimes(1);
    });
});
