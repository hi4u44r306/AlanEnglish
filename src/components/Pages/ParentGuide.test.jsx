import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import ParentGuide from "./ParentGuide";

test("explains the site, what comes with the books and how it helps, and points to the free lesson", () => {
    render(<MemoryRouter><ParentGuide /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("課本翻到哪一頁，網站就練哪一頁");
    ["孩子每天做三件事", "一套教材裡有什麼", "對孩子有什麼幫助", "常見問題"].forEach(name => expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "免費試一課：顏色" })).toHaveAttribute("href", "/try");
    expect(screen.getByRole("link", { name: /聯絡我們/ })).toHaveAttribute("href", "/support");
});

test("makes no price or result promises", () => {
    render(<MemoryRouter><ParentGuide /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/NT$|元|保證|一定會|幾週內/);
});
