import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import BasicReading from "./BasicReading";

const jsonResponse = (body, status = 200) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
});

describe("public Basic Reading player", () => {
    beforeAll(() => {
        Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
            configurable: true,
            value: jest.fn()
        });
        Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
            configurable: true,
            value: jest.fn().mockResolvedValue(undefined)
        });
        Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
            configurable: true,
            value: jest.fn()
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn(url => {
            if (url === "/api/basic-reading/catalog") {
                return jsonResponse({
                    collections: [
                        { id: "br400_1", level: 400, book: 1, title: "Basic Reading 400 第 1 冊", trackCount: 3 },
                        { id: "br800_1", level: 800, book: 1, title: "Basic Reading 800 第 1 冊", trackCount: 2 }
                    ]
                });
            }
            if (String(url).startsWith("/api/basic-reading/token?collection=")) {
                return jsonResponse({ token: "short-token", expires: 4102444800 });
            }
            return jsonResponse({ error: "not found" }, 404);
        });
    });

    it("shows compact level buttons and prepares a signed track URL", async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <BasicReading />
            </MemoryRouter>
        );

        expect(await screen.findByRole("heading", { name: "Basic Reading 400" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Basic Reading 800" })).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "第 1 冊 3 軌" })).toHaveLength(1);
        expect(screen.getByRole("button", { name: "播放 Track 3" })).toBeInTheDocument();

        const trackTwoButton = screen.getByRole("button", { name: "播放 Track 2" });
        await waitFor(() => expect(trackTwoButton).toBeEnabled());
        window.HTMLMediaElement.prototype.play.mockClear();
        await act(async () => {
            fireEvent.click(trackTwoButton);
            expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
            await Promise.resolve();
        });

        await waitFor(() => {
            const player = screen.getByLabelText("Basic Reading 400 第 1 冊 Track 2");
            expect(player).toHaveAttribute("src", expect.stringContaining("/api/basic-reading/audio/br400_1/Track2.mp3"));
            expect(player).toHaveAttribute("src", expect.stringContaining("token=short-token"));
        });
    });

    it("switches collections without squeezing all tracks into one row", async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <BasicReading />
            </MemoryRouter>
        );

        await screen.findByRole("heading", { name: "Basic Reading 400" });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "第 1 冊 2 軌" }));
            await Promise.resolve();
        });

        expect(screen.getByRole("heading", { name: "Basic Reading 800 第 1 冊" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "播放 Track 2" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "播放 Track 3" })).not.toBeInTheDocument();
    });
});
