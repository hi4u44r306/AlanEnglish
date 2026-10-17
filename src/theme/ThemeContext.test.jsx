import React from "react";
import { act, render, screen } from "@testing-library/react";
import ThemeSelect from "./ThemeSelect";
import { THEME_ADMIN_KEY, THEME_STORAGE_KEY, ThemeProvider, ThemeRoleSync, resolveTheme, useForcedLightTheme } from "./ThemeContext";

const LightOnlyPage = () => { useForcedLightTheme(); return <p>首頁</p>; };

const mockMatchMedia = matches => {
    window.matchMedia = jest.fn().mockReturnValue({ matches, addEventListener: jest.fn(), removeEventListener: jest.fn() });
};

describe("theme", () => {
    beforeEach(() => {
        window.localStorage.clear();
        // 以下多數案例是管理員（可以換外觀）。
        window.localStorage.setItem(THEME_ADMIN_KEY, "1");
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

    it("keeps a light-only page light and restores the saved choice after leaving", () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
        const { rerender } = render(<ThemeProvider><LightOnlyPage /></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
        rerender(<ThemeProvider><p>其他頁</p></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("students, teachers and signed-out visitors always get light, whatever was saved", () => {
        window.localStorage.removeItem(THEME_ADMIN_KEY);
        window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
        mockMatchMedia(true);
        render(<ThemeProvider><p>頁面</p></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("only an admin role unlocks the saved choice, and leaving admin locks it again", () => {
        window.localStorage.removeItem(THEME_ADMIN_KEY);
        window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
        const { rerender } = render(<ThemeProvider><ThemeRoleSync role="teacher" authLoading={false} /></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
        rerender(<ThemeProvider><ThemeRoleSync role="admin" authLoading={false} /></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
        expect(window.localStorage.getItem(THEME_ADMIN_KEY)).toBe("1");
        rerender(<ThemeProvider><ThemeRoleSync role="student" authLoading={false} /></ThemeProvider>);
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
        expect(window.localStorage.getItem(THEME_ADMIN_KEY)).toBeNull();
    });

    it("waits for sign-in to finish before changing anything", () => {
        render(<ThemeProvider><ThemeRoleSync role={null} authLoading /></ThemeProvider>);
        expect(window.localStorage.getItem(THEME_ADMIN_KEY)).toBe("1");
    });
});
