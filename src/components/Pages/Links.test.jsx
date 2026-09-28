import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { getPublicLinks } from "../../services/linkService";
import Links from "./Links";

jest.mock("../../services/linkService", () => ({
    getPublicLinks: jest.fn()
}));

describe("public links page", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("shows the current textbook groups without Special or Discovery", async () => {
        getPublicLinks.mockResolvedValue([
            { id: 1, title: "精選內容", url: "https://example.com/special", category: "special" },
            { id: 2, title: "習作本 F1～F3 完整練習", url: "https://example.com/exercise", category: "exercise" },
            { id: 3, title: "聽力本 F1～F3", url: "https://example.com/listening", category: "listening" },
            { id: 4, title: "Discovery 1.1", url: "https://example.com/discovery", category: "discovery" },
            { id: 5, title: "Speed Phonics 1", url: "https://example.com/phonics", category: "speedphonics" }
        ]);

        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Links />
            </MemoryRouter>
        );

        expect(await screen.findByRole("link", { name: /習作本 F1～F3 完整練習/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Basic Reading 400～1200/ })).toHaveAttribute("href", "/basic-reading");
        expect(screen.getByRole("heading", { name: "Basic Reading" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "習作本" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "聽力本" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Speed Phonics" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Special" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Discovery" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /精選內容/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Discovery 1.1/ })).not.toBeInTheDocument();
    });
});
