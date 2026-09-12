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

    it("keeps login directly available when the navigation collapses", () => {
        render(
            <MemoryRouter>
                <ShowcaseNavbar nav1="#features" nav2="#learning" nav3="#plans" nav4="#faq" />
            </MemoryRouter>
        );

        const quickLogin = document.querySelector(".showcase-navbar-quick-login");
        expect(quickLogin).toBeInTheDocument();
        expect(quickLogin).toHaveAttribute("href", "/login");
        expect(quickLogin).toHaveTextContent("登入");
    });
});
