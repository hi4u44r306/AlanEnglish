import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MusicPlayer from "./MusicPlayer";
import { recordTrackPlay, startListeningSession } from "../../services/listeningService";

// noInteraction idle check (MusicPlayer.jsx handleEnd L1020-1134, handlePlay L1140-1185,
// handlePause L1191-1210): after 5 tracks finish with no user action, a student must confirm.
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

// Opt-in switch to execute the KNOWN BUG cases: RUN_KNOWN_BUGS=1
const knownBugTest = process.env.RUN_KNOWN_BUGS === "1" ? test : test.skip;
const queue = [1, 2, 3, 4, 5, 6, 7].map(id => ({ id, page: `P${id}`, bookname: "Workbook 2", audioURL: `local-${id}.wav` }));
const attentionDialog = () => screen.queryByRole("dialog", { name: "確認仍在學習" });

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    startListeningSession.mockResolvedValue({ session: { id: "session" } });
    recordTrackPlay.mockResolvedValue({ counted: true, progress: { track_id: 1, play_count: 1 } });
    // Run the "play after source change" frame immediately, like a browser autoplay.
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 0; });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () {
        Object.defineProperty(this, "paused", { configurable: true, value: false });
        fireEvent.play(this);
        return Promise.resolve();
    });
    jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function () {
        Object.defineProperty(this, "paused", { configurable: true, value: true });
        fireEvent.pause(this);
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const begin = async () => {
    render(<MusicPlayer music={{ ...queue[0], playbackQueue: queue }} />);
    const audio = screen.getByTestId("audio");
    Object.defineProperty(audio, "duration", { configurable: true, value: 100 });
    await act(() => audio.play()); // the student's own Play click
    return audio;
};

// What a browser does when a non-looping track reaches its end (HTML spec "reaches the end":
// paused becomes true and `pause` fires, then `ended` fires).
const naturalEnd = async (audio, { withPauseEvent }) => {
    await act(async () => {
        if (withPauseEvent) {
            Object.defineProperty(audio, "paused", { configurable: true, value: true });
            fireEvent.pause(audio);
        }
        fireEvent.ended(audio);
    });
};
const finishTracks = async (audio, count, options) => {
    for (let index = 0; index < count; index += 1) await naturalEnd(audio, options);
};
const turnOnRepeat = () => {
    const expand = screen.queryByRole("button", { name: "展開播放器" });
    if (expand) fireEvent.click(expand);
    fireEvent.click(screen.getAllByRole("button", { name: "更多播放設定" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /重複播放/ }));
    expect(screen.getByRole("button", { name: /重複播放/ })).toHaveAttribute("aria-pressed", "true");
};

test("five automatically advanced tracks with no user action open the attention check (ended only)", async () => {
    const audio = await begin();
    await finishTracks(audio, 4, { withPauseEvent: false });
    expect(attentionDialog()).not.toBeInTheDocument();
    await finishTracks(audio, 1, { withPauseEvent: false });
    expect(attentionDialog()).toBeInTheDocument();
    expect(audio.paused).toBe(true);
    expect(localStorage.getItem("ae-no-interaction")).toBe("5");
});

test("a manual pause and play by the student resets the idle count", async () => {
    const audio = await begin();
    await finishTracks(audio, 4, { withPauseEvent: false });
    act(() => audio.pause());
    await act(() => audio.play());
    await finishTracks(audio, 1, { withPauseEvent: false });
    expect(attentionDialog()).not.toBeInTheDocument();
    expect(localStorage.getItem("ae-no-interaction")).toBe("1");
});

// KNOWN BUG: in a real browser every natural track end fires `pause` before `ended`.
// handlePause (L1191-1210) cannot tell that apart from a manual pause and calls
// resetNoInteraction(), so the count goes 0 -> 1 on every track and never reaches 5.
// Confirmed with RUN_KNOWN_BUGS=1: no attention dialog after 5 tracks.
knownBugTest("five natural track ends (pause then ended) open the attention check", async () => {
    const audio = await begin();
    await finishTracks(audio, 5, { withPauseEvent: true });
    expect(attentionDialog()).toBeInTheDocument();
});

// KNOWN BUG: in repeat mode handleEnd (L1079-1094) replays with audio.play() without marking the
// play as automatic, so handlePlay (L1184) calls resetNoInteraction() after every repeat and the
// idle check can never fire, even without any pause event. Confirmed with RUN_KNOWN_BUGS=1.
knownBugTest("five repeats of one track in repeat mode open the attention check", async () => {
    const audio = await begin();
    turnOnRepeat();
    await finishTracks(audio, 5, { withPauseEvent: false });
    expect(attentionDialog()).toBeInTheDocument();
});

knownBugTest("five natural repeats in repeat mode (pause then ended) open the attention check", async () => {
    const audio = await begin();
    turnOnRepeat();
    await finishTracks(audio, 5, { withPauseEvent: true });
    expect(attentionDialog()).toBeInTheDocument();
});

test("repeat mode replays the same track from the start", async () => {
    const audio = await begin();
    turnOnRepeat();
    const src = audio.getAttribute("src");
    audio.currentTime = 99;
    await naturalEnd(audio, { withPauseEvent: false });
    expect(audio.getAttribute("src")).toBe(src);
    expect(audio.currentTime).toBe(0);
    expect(audio.paused).toBe(false);
});
