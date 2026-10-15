import React from "react";
import { act, render, screen } from "@testing-library/react";
import ThemeSelect from "./ThemeSelect";
import { THEME_STORAGE_KEY, ThemeProvider, resolveTheme } from "./ThemeContext";

const mockMatchMedia = matches => {
    window.matchMedia = jest.fn().mockReturnValue({ matches, addEventListener: jest.fn(), removeEventListener: jest.fn() });
};

describe("theme", () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.removeAttribute("data-theme");
        mockMatchMedia(false);
    });

    it("resolves system choice from the device setting", () => {
        expect(resolveTheme("system", true)).toBe("dark");
        expect(resolveTheme("system", false)).toBe("light");
        expect(resolveTheme("light", true)).toBe("light");
    });

    it("applies the saved choice on load", () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
        render(<ThemeProvider><ThemeSelect /></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
        expect(screen.getByRole("radio", { name: "深色" }).getAttribute("aria-checked")).toBe("true");
    });

    it("remembers a new choice", () => {
        render(<ThemeProvider><ThemeSelect /></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
        act(() => { screen.getByRole("radio", { name: "深色" }).click(); });
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    });

    it("follows the system when set to system", () => {
        mockMatchMedia(true);
        render(<ThemeProvider><ThemeSelect /></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
});
