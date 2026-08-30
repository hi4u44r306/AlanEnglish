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

    it("prioritizes store actions and keeps cross-site routes clear", () => {
        render(<MemoryRouter initialEntries={["/shop/login"]}><StoreHeader /></MemoryRouter>);

        expect(screen.getByRole("link", { name: "返回 Alan English 網站首頁" })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: "回到教材商城" })).toHaveAttribute("href", "/shop");
        expect(screen.getByRole("link", { name: "聽力學習平台" })).toHaveAttribute("href", "/userinfo");
        expect(screen.getAllByRole("link", { name: "購物車，目前有 2 件商品" })[0]).toHaveAttribute("href", "/shop/cart");
        expect(screen.getByRole("link", { name: "登入／註冊" })).toHaveAttribute("href", "/shop/login");
        expect(screen.getByRole("link", { name: "登入／註冊" })).toHaveAttribute("aria-current", "page");
    });

    it("shows order history and signs a store user out", () => {
        const signOut = jest.fn();
        useStore.mockReturnValue({ user: { id: "store-user" }, authLoading: false, cartCount: 0, signOut });
        render(<MemoryRouter><StoreHeader /></MemoryRouter>);

        expect(screen.getByRole("link", { name: "我的訂單" })).toHaveAttribute("href", "/shop/orders");
        fireEvent.click(screen.getByText("我的帳號"));
        fireEvent.click(screen.getByRole("button", { name: "商城登出" }));
        expect(signOut).toHaveBeenCalledTimes(1);
    });

    it("opens a grouped mobile menu and locks background scrolling", () => {
        render(<MemoryRouter><StoreHeader /></MemoryRouter>);

        fireEvent.click(screen.getByRole("button", { name: "開啟商城選單" }));
        expect(screen.getByRole("dialog", { name: "教材商城選單" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "商城功能" })).toBeInTheDocument();
        expect(screen.getByText("查看付款與出貨進度")).toBeInTheDocument();
        expect(screen.getByText("免費註冊")).toBeInTheDocument();
        expect(document.body).toHaveStyle({ overflow: "hidden" });

        fireEvent.click(screen.getAllByRole("button", { name: "關閉商城選單" })[1]);
        expect(screen.queryByRole("dialog", { name: "教材商城選單" })).not.toBeInTheDocument();
        expect(document.body.style.overflow).toBe("");
    });
});
