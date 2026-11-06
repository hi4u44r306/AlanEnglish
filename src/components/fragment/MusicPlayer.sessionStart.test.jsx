import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MusicPlayer from "./MusicPlayer";
import { startListeningSession } from "../../services/listeningService";

// Server listening sessions (record-play "start") for a track picked from the book list.
// Production 2026-11-06: only the first track after page load and auto-advanced tracks got a
// session; a track clicked in the list while the player was already mounted never did.
const mockDispatch = jest.fn();
let mockRole = "student";
jest.mock("react-redux", () => ({ useDispatch: () => mockDispatch }));
jest.mock("../../auth/AuthContext", () => {
    const user = {};
    return { useAuth: () => ({ firebaseUser: user, role: mockRole }) };
});
jest.mock("../../services/listeningService", () => ({ startListeningSession: jest.fn(), recordTrackPlay: jest.fn() }));
jest.mock("../../services/contentAccessService", () => ({ getAccessibleBook: jest.fn() }));
// Mirrors react-h5-audio-player 3.x: componentDidUpdate calls audio.play() as soon as `src`
// changes (autoPlayAfterSrcChange), i.e. during React's commit, before the parent's useEffect.
// A new src runs the browser's media load algorithm first, which sets `paused` back to true.
jest.mock("react-h5-audio-player", () => {
    const React = require("react");
    class MockAudioPlayer extends React.Component {
        audio = React.createRef();
        componentDidUpdate(prevProps) {
            if (prevProps.src !== this.props.src) {
                Object.defineProperty(this.audio.current, "paused", { configurable: true, value: true });
                if (this.props.autoPlayAfterSrcChange) void this.audio.current.play();
            }
        }
        render() {
            const p = this.props;
            return <audio data-testid="audio" ref={this.audio} src={p.src} onPlay={p.onPlay} onPause={p.onPause}
                onEnded={p.onEnded} onTimeUpdate={p.onListen} onCanPlay={p.onCanPlay} />;
        }
    }
    return { __esModule: true, RHAP_UI: {}, default: MockAudioPlayer };
});

const queue = [1, 2, 3].map(id => ({ id, page: `P${id}`, bookname: "Workbook 1", audioURL: `local-${id}.wav` }));
const setAudio = (audio, props) => Object.entries(props).forEach(([key, value]) => (
    Object.defineProperty(audio, key, { configurable: true, value })
));
const startedTracks = () => startListeningSession.mock.calls.map(call => call[1]);

// play event timing: "sync" = fires inside audio.play() (so during the commit, before the reset
// effect, which is what a browser does when React yields between commit and passive effects);
// "later" = only after effects (fired explicitly by the test).
let playEventTiming = "sync";
beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockRole = "student";
    playEventTiming = "sync";
    startListeningSession.mockImplementation((user, trackId) => Promise.resolve({ session: { id: `session-${trackId}` } }));
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () {
        const wasPaused = this.paused !== false;
        setAudio(this, { paused: false, ended: false });
        if (wasPaused && playEventTiming === "sync") fireEvent.play(this);
        return Promise.resolve();
    });
    jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function () {
        const wasPaused = this.paused !== false;
        setAudio(this, { paused: true });
        if (!wasPaused) fireEvent.pause(this);
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// The first track after page load, played by the student.
const begin = async () => {
    const view = render(<MusicPlayer music={{ ...queue[0], playbackQueue: queue }} />);
    const audio = screen.getByTestId("audio");
    setAudio(audio, { duration: 100, paused: true });
    await act(() => audio.play());
    await act(async () => fireEvent.canPlay(audio));
    expect(startedTracks()).toEqual([1]);
    return { ...view, audio };
};

// The new source has no metadata yet when play() is called, like a real browser.
const loadNewSource = async audio => {
    setAudio(audio, { duration: 100 });
    await act(async () => fireEvent.canPlay(audio));
    audio.currentTime = 1;
    await act(async () => fireEvent.timeUpdate(audio));
};

// What MusicCard -> redux -> Containerfull does: a new `music` prop for the mounted player.
const clickTrackInList = async (rerender, audio, track) => {
    setAudio(audio, { duration: NaN });
    await act(async () => rerender(<MusicPlayer music={{ ...track, playbackQueue: queue }} />));
};

test("clicking another track while one is playing starts a session for the new track (play before reset)", async () => {
    const { audio, rerender } = await begin();
    await clickTrackInList(rerender, audio, queue[1]);
    await loadNewSource(audio);
    expect(startedTracks()).toEqual([1, 2]);
    expect(startListeningSession).toHaveBeenLastCalledWith(expect.anything(), 2, 100);
});

test("clicking another track while paused starts a session for the new track (play before reset)", async () => {
    const { audio, rerender } = await begin();
    act(() => audio.pause());
    await clickTrackInList(rerender, audio, queue[2]);
    await loadNewSource(audio);
    expect(startedTracks()).toEqual([1, 3]);
});

test("auto-advance after a natural end starts a session for the next track (play before reset)", async () => {
    const { audio } = await begin();
    setAudio(audio, { duration: NaN, paused: true, ended: true });
    await act(async () => fireEvent.ended(audio));
    await loadNewSource(audio);
    expect(startedTracks()).toEqual([1, 2]);
});

test("clicking another track still works when play fires after the reset effect", async () => {
    const { audio, rerender } = await begin();
    playEventTiming = "later";
    await clickTrackInList(rerender, audio, queue[1]);
    await act(async () => fireEvent.play(audio));
    await loadNewSource(audio);
    expect(startedTracks()).toEqual([1, 2]);
});

test("a time update while paused (e.g. a seek) does not start a session for the new track", async () => {
    const { audio, rerender } = await begin();
    await clickTrackInList(rerender, audio, queue[1]);
    act(() => audio.pause());
    await loadNewSource(audio);
    expect(startedTracks()).toEqual([1]);
    await act(() => audio.play());
    expect(startedTracks()).toEqual([1, 2]);
});

test.each(["teacher", "admin"])("a %s switching tracks never starts a listening session", async role => {
    mockRole = role;
    const { rerender } = render(<MusicPlayer music={{ ...queue[0], playbackQueue: queue }} />);
    const audio = screen.getByTestId("audio");
    setAudio(audio, { duration: 100, paused: true });
    await act(() => audio.play());
    await loadNewSource(audio);
    await clickTrackInList(rerender, audio, queue[1]);
    await loadNewSource(audio);
    expect(startListeningSession).not.toHaveBeenCalled();
});
