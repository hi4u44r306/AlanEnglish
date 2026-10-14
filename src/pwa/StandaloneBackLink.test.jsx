import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StandaloneBackLink from "./StandaloneBackLink";

const mockStandalone = matches => {
    window.matchMedia = jest.fn().mockReturnValue({ matches });
};

describe("StandaloneBackLink", () => {
    afterEach(() => { delete window.matchMedia; });

    it("shows a visible way home only when opened from the home screen", () => {
        mockStandalone(true);
        render(<MemoryRouter><StandaloneBackLink /></MemoryRouter>);
        expect(screen.getByRole("link", { name: /回首頁/ })).toHaveAttribute("href", "/");
    });

    it("stays hidden in a normal browser tab", () => {
        mockStandalone(false);
        render(<MemoryRouter><StandaloneBackLink /></MemoryRouter>);
        expect(screen.queryByRole("link", { name: /回首頁/ })).not.toBeInTheDocument();
    });
});
