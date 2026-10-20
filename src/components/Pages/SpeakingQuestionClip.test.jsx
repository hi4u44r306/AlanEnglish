import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SpeakingQuestionClip from "./SpeakingQuestionClip";
import { SpeakingActivityContext } from "./SpeakingActivityContext";

const clip = { type: "audio", url: "https://r2.example/wb3-p4.mp3?sig=1", start_ms: 6280, end_ms: 11580 };

describe("SpeakingQuestionClip", () => {
    let playSpy;
    let pauseSpy;
    let loadSpy;
    let fetchSpy;

    beforeEach(() => {
        playSpy = jest.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
        pauseSpy = jest.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(function pause() {});
        loadSpy = jest.spyOn(window.HTMLMediaElement.prototype, "load").mockImplementation(function load() {
            this.dispatchEvent(new Event("loadedmetadata"));
        });
        fetchSpy = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
        global.fetch = fetchSpy;
        jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
        jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it("renders nothing without an audio clip", () => {
        const { container, rerender } = render(<SpeakingQuestionClip clip={null} />);
        expect(container.innerHTML).toBe("");
        rerender(<SpeakingQuestionClip clip={{ type: "video", youtube_video_id: "dQw4w9WgXcQ", start_ms: 0, end_ms: 900 }} />);
        expect(container.innerHTML).toBe("");
        rerender(<SpeakingQuestionClip clip={{ ...clip, end_ms: 100 }} />);
        expect(container.innerHTML).toBe("");
    });

    it("plays only this question's part and stops at its end without sending any listening record", async () => {
        const setBusy = jest.fn();
        render(<SpeakingActivityContext.Provider value={setBusy}><SpeakingQuestionClip clip={clip} /></SpeakingActivityContext.Provider>);
        const audio = document.querySelector("audio");
        expect(audio.getAttribute("preload")).toBe("none");

        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "聽這題" })); });
        expect(loadSpy).toHaveBeenCalled();
        expect(audio.currentTime).toBeCloseTo(6.28);
        expect(playSpy).toHaveBeenCalledTimes(1);
        expect(setBusy).toHaveBeenLastCalledWith(true);
        expect(screen.getByRole("button", { name: "停止" }).getAttribute("aria-pressed")).toBe("true");

        Object.defineProperty(audio, "paused", { configurable: true, get: () => false });
        audio.currentTime = 11.6;
        act(() => { fireEvent.timeUpdate(audio); });
        expect(pauseSpy).toHaveBeenCalled();
        expect(setBusy).toHaveBeenLastCalledWith(false);
        expect(screen.getByRole("button", { name: "聽這題" })).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("tells the child to try again when the audio cannot play", async () => {
        playSpy.mockImplementation(() => Promise.reject(new Error("blocked")));
        render(<SpeakingQuestionClip clip={clip} />);
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "聽這題" })); });
        expect(screen.getByRole("alert").textContent).toContain("請再按一次");
        expect(screen.getByRole("button", { name: "聽這題" })).toBeTruthy();
    });

    it("is disabled while the microphone is busy", () => {
        render(<SpeakingQuestionClip clip={clip} disabled />);
        expect(screen.getByRole("button", { name: "聽這題" }).disabled).toBe(true);
    });
});
