import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import LessonVideoDialog from "./LessonVideoDialog";
import { recordVideoWatch } from "../../services/learningActivityService";

let mockRole = "student";
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: { uid: "s1" }, role: mockRole }) }));
jest.mock("../../services/learningActivityService", () => ({ recordVideoWatch: jest.fn() }));

const segment = { videoId: "zqgkmTWoTYc", start: 0, end: 100 };

describe("LessonVideoDialog", () => {
    let player;
    let events;
    let currentTime;

    beforeEach(() => {
        jest.useFakeTimers();
        mockRole = "student";
        currentTime = 0;
        recordVideoWatch.mockReset();
        recordVideoWatch.mockResolvedValue({ success: true });
        window.YT = {
            Player: jest.fn((element, options) => {
                events = options.events;
                player = {
                    options,
                    getCurrentTime: () => currentTime,
                    getDuration: () => 7000,
                    pauseVideo: jest.fn(),
                    destroy: jest.fn()
                };
                return player;
            })
        };
    });
    afterEach(() => {
        jest.useRealTimers();
        delete window.YT;
    });

    const open = async () => {
        await act(async () => { render(<LessonVideoDialog segment={segment} title="P4" trackId={114} onClose={jest.fn()} />); });
        act(() => { events.onReady({ target: player }); });
    };
    const play = () => act(() => { events.onStateChange({ data: 1, target: player }); });
    const watch = seconds => {
        for (let index = 0; index < seconds; index += 1) {
            currentTime += 1;
            act(() => { jest.advanceTimersByTime(1000); });
        }
    };

    it("plays only this page's part inside the platform without YouTube suggestions or fullscreen", async () => {
        await open();
        expect(window.YT.Player).toHaveBeenCalledTimes(1);
        const { playerVars, host, videoId } = player.options;
        expect(host).toBe("https://www.youtube-nocookie.com");
        expect(videoId).toBe("zqgkmTWoTYc");
        expect(playerVars).toMatchObject({ start: 0, end: 100, rel: 0, fs: 0, playsinline: 1 });
        expect(screen.getByRole("dialog", { name: "P4 教學影片" })).toBeInTheDocument();
    });

    it("records start, then complete only after 80% was really watched", async () => {
        await open();
        play();
        expect(recordVideoWatch).toHaveBeenCalledWith({ uid: "s1" }, expect.objectContaining({ phase: "start", video_id: "zqgkmTWoTYc", start_seconds: 0, end_seconds: 100, track_id: 114, context: "playlist" }));
        currentTime = 90; // 拖曳到後面，不算
        watch(1);
        expect(recordVideoWatch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ phase: "complete" }));
        currentTime = 0;
        act(() => { events.onStateChange({ data: 2, target: player }); });
        play();
        watch(80);
        expect(recordVideoWatch).toHaveBeenCalledWith({ uid: "s1" }, expect.objectContaining({ phase: "complete" }));
        expect(screen.getByText("看完了！")).toBeInTheDocument();
        watch(5);
        expect(recordVideoWatch.mock.calls.filter(([, payload]) => payload.phase === "complete")).toHaveLength(1);
    });

    it("pauses and records when the child switches away while playing", async () => {
        await open();
        play();
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        act(() => { document.dispatchEvent(new Event("visibilitychange")); });
        expect(player.pauseVideo).toHaveBeenCalled();
        expect(recordVideoWatch).toHaveBeenCalledWith({ uid: "s1" }, expect.objectContaining({ phase: "pause_hidden" }));
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    });

    it("teachers can watch but nothing is recorded", async () => {
        mockRole = "teacher";
        await open();
        play();
        watch(90);
        expect(recordVideoWatch).not.toHaveBeenCalled();
    });

    it("closes with the X button or Escape", async () => {
        const onClose = jest.fn();
        await act(async () => { render(<LessonVideoDialog segment={segment} title="P4" onClose={onClose} />); });
        fireEvent.click(screen.getByRole("button", { name: "關閉影片" }));
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
