import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
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
    it("links the public navigation to the physical-material store", () => {
        render(
            <MemoryRouter>
                <ShowcaseNavbar nav1="#features" nav2="#learning" nav3="#plans" nav4="#faq" />
            </MemoryRouter>
        );

        expect(screen.getByRole("link", { name: /教材商城/ })).toHaveAttribute("href", "/shop");
    });

    it("keeps a direct mobile login link beside the menu toggle", () => {
        render(
            <MemoryRouter>
                <ShowcaseNavbar nav1="#features" nav2="#learning" nav3="#plans" nav4="#faq" />
            </MemoryRouter>
        );

        const mobileLogin = screen.getAllByRole("link", { name: /^登入$/ })
            .find(link => link.classList.contains("showcase-navbar-mobile-login"));
        expect(mobileLogin).toHaveAttribute("href", "/login");
    });
});
