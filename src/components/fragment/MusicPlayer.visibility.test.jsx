import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import MusicPlayer from "./MusicPlayer";
import { startListeningSession } from "../../services/listeningService";

const mockDispatch = jest.fn();
jest.mock("react-redux", () => ({ useDispatch: () => mockDispatch }));
jest.mock("../../auth/AuthContext", () => {
    const user = {};
    return { useAuth: () => ({ firebaseUser: user, role: "student" }) };
});
jest.mock("../../services/listeningService", () => ({ startListeningSession: jest.fn(), recordTrackPlay: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleBook: jest.fn() }));
jest.mock("react-h5-audio-player", () => {
    const React = require("react");
    return {
        __esModule: true, RHAP_UI: {},
        default: React.forwardRef((props, ref) => {
            const audio = React.useRef(null);
            React.useImperativeHandle(ref, () => ({ audio }));
            return <audio data-testid="audio" ref={audio} src={props.src} onPlay={props.onPlay} onPause={props.onPause} onEnded={props.onEnded} />;
        })
    };
});
const track = { id: 1, page: "P4", bookname: "Workbook 2", audioURL: "local-test.wav" };
const visibility = state => act(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    document.dispatchEvent(new Event("visibilitychange"));
});
beforeEach(() => {
    jest.clearAllMocks();
    visibility("visible");
    localStorage.clear();
    startListeningSession.mockResolvedValue({ session: { id: "session", reward_status: {
        policy_version: 3, track_id: 1, source: "self_practice", mastery_count: 6, daily_rewarded_tracks: 1, daily_track_limit: 3
    } } });
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () {
        Object.defineProperty(this, "paused", { configurable: true, value: false });
        fireEvent.play(this);
        return Promise.resolve();
    });
    jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function () {
        Object.defineProperty(this, "paused", { configurable: true, value: true });
        fireEvent.pause(this);
    });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const begin = async () => {
    const result = render(<MusicPlayer music={track} />);
    const audio = screen.getByTestId("audio");
    Object.defineProperty(audio, "duration", { configurable: true, value: 100 });
    await act(() => audio.play());
    return { ...result, audio };
};

test("切換分頁立即暫停，回來不自動播，確認後從原位置繼續", async () => {
    const { audio } = await begin();
    audio.currentTime = 42;
    expect(screen.getByText("自主熟練度 6/10 次")).toBeInTheDocument();
    visibility("hidden");
    expect(audio.paused).toBe(true);
    visibility("visible");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(audio.paused).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "我知道了，繼續播放" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(42);
    expect(startListeningSession).toHaveBeenCalledTimes(1);
});

test("原本手動暫停者不會看到切換分頁提示", async () => {
    const { audio } = await begin();
    act(() => audio.pause());
    visibility("hidden");
    visibility("visible");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(audio.paused).toBe(true);
});

test("未確認前換檔或外部播放事件都不能繞過暫停提示", async () => {
    const { audio, rerender } = await begin();
    visibility("hidden");
    rerender(<MusicPlayer music={{ ...track, id: 2, page: "P6" }} />);
    visibility("visible");
    await act(() => audio.play());
    expect(audio.paused).toBe(true);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});

test("注意力確認不可藉離開分頁略過，逾時必須從頭開始新session", async () => {
    jest.useFakeTimers();
    const { audio } = await begin();
    audio.currentTime = 60;
    act(() => jest.advanceTimersByTime(15 * 60 * 1000));
    expect(screen.getByRole("dialog", { name: "確認仍在學習" })).toBeInTheDocument();
    visibility("hidden");
    act(() => jest.advanceTimersByTime(30 * 1000));
    visibility("visible");
    await act(() => audio.play());
    expect(audio.paused).toBe(true);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "重新開始這首" })));
    expect(audio.currentTime).toBe(0);
    expect(audio.paused).toBe(false);
    expect(startListeningSession).toHaveBeenCalledTimes(2);
});

test("續播失敗時仍鎖定確認，可再次點擊成功續播", async () => {
    const { audio } = await begin();
    visibility("hidden");
    visibility("visible");
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(new Error("Network unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "我知道了，繼續播放" }));
    await screen.findByRole("alert");
    expect(audio.paused).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "我知道了，繼續播放" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(audio.paused).toBe(false);
});
