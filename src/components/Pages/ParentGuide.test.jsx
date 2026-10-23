import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import ParentGuide from "./ParentGuide";

test("says what the site is in one screen and points to the free lesson", () => {
    render(<MemoryRouter><ParentGuide /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("課本翻到哪一頁，網站就練哪一頁");
    ["看老師教", "聽課本", "自己說", "跟著課本走", "真的有聽才算", "家長看得到"].forEach(text => expect(screen.getByText(text)).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /免費試一課/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "聯絡我們" })).toHaveAttribute("href", "/support");
    // Short on purpose: one title, one closing heading, nothing to expand.
    expect(screen.getAllByRole("heading")).toHaveLength(2);
});

test("makes no price or result promises", () => {
    render(<MemoryRouter><ParentGuide /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/NT\$|元|保證|一定會|幾週內/);
});
