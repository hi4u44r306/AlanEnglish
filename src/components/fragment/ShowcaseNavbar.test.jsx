import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ShowcaseNavbar from "./ShowcaseNavbar";

beforeEach(() => {
    window.matchMedia = query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
    });
});

describe("ShowcaseNavbar navigation", () => {
    it("keeps purchase and membership destinations out of the public navigation", () => {
        render(
            <MemoryRouter>
                <ShowcaseNavbar nav1="#features" nav2="#learning" nav4="#faq" />
            </MemoryRouter>
        );

        expect(screen.queryByRole("link", { name: /教材商城/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /會員方案/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /免費試用/ })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: /常見問題/ })).toHaveAttribute("href", "#faq");
    });

    it("keeps login directly available when the navigation collapses", () => {
        render(
            <MemoryRouter>
                <ShowcaseNavbar nav1="#features" nav2="#learning" nav4="#faq" />
            </MemoryRouter>
        );

        const quickLogin = document.querySelector(".showcase-navbar-quick-login");
        expect(quickLogin).toBeInTheDocument();
        expect(quickLogin).toHaveAttribute("href", "/login");
        expect(quickLogin).toHaveTextContent("登入");
    });

    it("navigates from the desktop login action without waiting for an offcanvas exit", () => {
        render(
            <MemoryRouter initialEntries={["/"]}>
                <Routes>
                    <Route
                        path="/"
                        element={<ShowcaseNavbar nav1="#features" nav2="#learning" nav4="#faq" />}
                    />
                    <Route path="/login" element={<p>登入頁</p>} />
                </Routes>
            </MemoryRouter>
        );

        fireEvent.click(document.querySelector(".showcase-navbar-login"));

        expect(screen.getByText("登入頁")).toBeInTheDocument();
    });
});
