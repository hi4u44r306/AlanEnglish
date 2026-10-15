import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEME_STORAGE_KEY = "ae-theme";
export const THEME_CHOICES = ["light", "dark", "system"];
const THEME_COLORS = { light: "#073763", dark: "#0b1626" };

const readStoredChoice = () => {
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        return THEME_CHOICES.includes(stored) ? stored : "system";
    } catch (error) {
        return "system";
    }
};

const systemPrefersDark = () => {
    try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (error) {
        return false;
    }
};

export const resolveTheme = (choice, prefersDark) => (choice === "system" ? (prefersDark ? "dark" : "light") : choice);

// 把解析後的主題寫到 <html>，同時讓 Bootstrap 元件與手機網址列顏色一起換。
export const applyTheme = resolved => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-bs-theme", resolved);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
};

const ThemeContext = createContext({ choice: "system", resolved: "light", setChoice: () => {} });

export function ThemeProvider({ children }) {
    const [choice, setChoiceState] = useState(readStoredChoice);
    const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
    const resolved = resolveTheme(choice, prefersDark);

    useEffect(() => {
        let media;
        try { media = window.matchMedia("(prefers-color-scheme: dark)"); } catch (error) { return undefined; }
        const onChange = event => setPrefersDark(event.matches);
        media.addEventListener?.("change", onChange);
        return () => media.removeEventListener?.("change", onChange);
    }, []);

    useEffect(() => { applyTheme(resolved); }, [resolved]);

    const setChoice = useCallback(next => {
        if (!THEME_CHOICES.includes(next)) return;
        setChoiceState(next);
        try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch (error) { /* 無痕模式存不了時，本次仍然有效 */ }
    }, []);

    const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
