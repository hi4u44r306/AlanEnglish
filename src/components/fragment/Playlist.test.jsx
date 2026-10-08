import { clearStudentPageCache } from "../../services/studentPageCache";
beforeEach(() => clearStudentPageCache());
import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import musicReducer from "../../reducers/musicReducer";
import { setPlayPauseStatus } from "../../actions/actions";
import { readStudentLearningResume } from "../../services/studentLearningResume";
import { studentPageScope } from "../../services/studentPageCache";
import Playlist from "./Playlist";
import { getAccessibleBook } from "../../services/contentAccessService";
import { getBookPlaybackProgress } from "../../services/listeningService";
jest.mock("../../services/contentAccessService", () => ({ getAccessibleBook: jest.fn() }));
jest.mock("../../services/listeningService", () => ({ getBookPlaybackProgress: jest.fn().mockResolvedValue({ progress: [] }) }));
const mockUser = { uid: "test" };
let mockRole = "student";
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockUser, role: mockRole }) }));
jest.mock("./MusicCard", () => function Card({ music, playbackQueue, progressStatus, onStart }) { return <div data-testid={`track-${music.id}`} data-progress-status={progressStatus} data-queue={playbackQueue.map(item => item.id).join(",")}>{music.title}<button onClick={() => onStart?.(music)}>播放 {music.title}</button></div>; });
const Probe = () => { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; };
const result = { book: { id: 1, name: "Workbook 1" }, tracks: [1, 2].map(id => ({ id, book_id: 1, title: `Track ${id}`, music_name: `Track ${id}`, page: `P.${id}`, audio_url: "signed-audio" })) };
const mount = search => {
    const store = configureStore({ reducer: { musicReducer }, preloadedState: { musicReducer: { playingStatus: true, playing: { id: 2 } } } });
    render(<Provider store={store}><MemoryRouter initialEntries={[`/student/books/W1${search}`]}><Probe /><Routes><Route path="/student/books/:playlistId" element={<Playlist />} /><Route path="/student/speaking-challenges/:id" element={<p>已返回口說</p>} /></Routes></MemoryRouter></Provider>);
    return store;
};
beforeEach(() => { mockRole = "student"; sessionStorage.clear(); getAccessibleBook.mockReset().mockResolvedValue(result); getBookPlaybackProgress.mockReset().mockResolvedValue({ progress: [] }); });
it("locates the resumed track after asynchronous loading without playing or changing the queue", async () => {
    const store = mount("?resume=1");
    await screen.findByText("已找到上次學習的音檔，按「播放」即可開始。");
    expect(document.activeElement).toBe(document.getElementById("listening-track-1"));
    expect(store.getState().musicReducer.playing).toEqual({ id: 2 });
    expect(screen.getByTestId("track-1")).toHaveAttribute("data-queue", "1,2");
});
it("records only navigation metadata on an explicit student play, never on loading", async () => {
    mount("");
    await screen.findByTestId("track-1");
    const scope = studentPageScope(mockUser, "student");
    expect(readStudentLearningResume(scope)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "播放 Track 1" }));
    expect(readStudentLearningResume(scope)).toMatchObject({ bookId: "1", bookCode: "W1", trackId: "1", page: "P.1" });
    expect(JSON.stringify(readStudentLearningResume(scope))).not.toContain("signed-audio");
});
it("missing resume tracks stay recoverable and do not enlarge an assignment selection", async () => {
    mount("?resume=99&assignment=4&tracks=1");
    await screen.findByTestId("track-1");
    expect(screen.queryByText(/上次音檔/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("track-2")).not.toBeInTheDocument();
});
it("a removed track shows a fallback instead of selecting another track automatically", async () => {
    mount("?resume=99");
    await screen.findByText("上次音檔目前不在教材清單中，請選擇其他音檔。");
    expect(screen.getByTestId("track-1")).toBeInTheDocument();
});
it("staff playback does not create a student bookmark", async () => {
    mockRole = "teacher";
    mount("");
    await screen.findByTestId("track-1");
    fireEvent.click(screen.getByRole("button", { name: "播放 Track 1" }));
    expect(readStudentLearningResume(studentPageScope(mockUser, "student"))).toBeNull();
});
it("filters both cards and playback queue, then pauses audio when returning in the original mode", async () => {
    const store = mount("?speaking=7&mode=challenge&tracks=2");
    expect(await screen.findByTestId("track-2")).toHaveAttribute("data-queue", "2");
    expect(screen.queryByTestId("track-1")).not.toBeInTheDocument();
    expect(store.getState().musicReducer.playingStatus).toBe(false);
    act(() => store.dispatch(setPlayPauseStatus(true)));
    fireEvent.click(screen.getByRole("link", { name: "回到原口說關卡" }));
    expect(screen.getByTestId("route")).toHaveTextContent("/student/speaking-challenges/7?mode=challenge");
    expect(store.getState().musicReducer.playingStatus).toBe(false);
});
it("does not substitute unrelated tracks for a missing selection", async () => {
    mount("?speaking=7&mode=easy&tracks=99");
    expect(await screen.findByText("本關對應音檔目前無法載入，請回到口說關卡繼續練習。")).toBeInTheDocument();
    expect(screen.queryByTestId("track-1")).not.toBeInTheDocument();
});
it("pauses a preparation track when leaving through any navigation", async () => {
    const store = mount("?speaking=7&mode=easy&tracks=2");
    await screen.findByTestId("track-2");
    act(() => store.dispatch(setPlayPauseStatus(true)));
    // Unmount covers back navigation or leaving via another application route.
    const { cleanup } = require("@testing-library/react");
    cleanup();
    expect(store.getState().musicReducer.playingStatus).toBe(false);
});
it("retains a return path when authorized content loading fails", async () => {
    getAccessibleBook.mockRejectedValue(new Error("載入失敗"));
    mount("?speaking=7&mode=easy&tracks=2");
    await screen.findByText("讀取失敗");
    expect(screen.getByRole("link", { name: "回到原口說關卡" })).toHaveAttribute("href", "/student/speaking-challenges/7?mode=easy");
});
it("preserves normal listening and gives homework filtering precedence", async () => {
    const normal = mount("");
    await screen.findByTestId("track-1");
    expect(screen.queryByRole("link", { name: "回到原口說關卡" })).not.toBeInTheDocument();
    expect(normal.getState().musicReducer.playingStatus).toBe(true);
});
it("does not mix speaking filters into homework", async () => {
    mount("?assignment=4&required=7&speaking=7&mode=easy&tracks=1");
    await screen.findByTestId("track-1");
    expect(screen.queryByTestId("track-2")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "回到原口說關卡" })).not.toBeInTheDocument();
});

it("同步顯示目前曲目及暫停狀態，選取其他教材音檔不冒充本頁播放", async () => {
    const store = mount("");
    await screen.findByTestId("track-2");
    const panel = screen.getByRole("complementary", { name: "目前學習區" });
    expect(within(panel).getByRole("heading", { name: "Track 2" })).toBeInTheDocument();
    expect(within(panel).getByText("正在聆聽")).toBeInTheDocument();
    act(() => store.dispatch(setPlayPauseStatus(false)));
    expect(within(panel).getByText("已暫停")).toBeInTheDocument();
    act(() => store.dispatch({ type: "SET_CURR_PLAYING", payload: { id: 99 } }));
    expect(within(panel).getByText("準備好耳朵了嗎？")).toBeInTheDocument();
    expect(within(panel).queryByText("正在聆聽")).not.toBeInTheDocument();
});

it("只在本次後端明確 counted 後顯示提示，下一步不自行播放或擴大 queue", async () => {
    const store = mount("");
    await screen.findByTestId("track-1");
    const emit = detail => act(() => window.dispatchEvent(new CustomEvent("ae:track-progress-updated", { detail })));
    emit({ track_id: 1, play_count: 7 });
    emit({ track_id: 1, play_count: 8, listen_counted: false });
    expect(screen.queryByText("已記下這次有效聆聽！")).not.toBeInTheDocument();
    emit({ track_id: 99, play_count: 1, listen_counted: true });
    expect(screen.queryByText("已記下這次有效聆聽！")).not.toBeInTheDocument();
    emit({ track_id: 1, play_count: 9, listen_counted: true });
    expect(screen.getByRole("region", { name: "本次聆聽紀錄" })).toHaveTextContent("Track 1 · 累計 9 次");
    emit({ track_id: 1, play_count: 10, listen_counted: false });
    expect(screen.getByRole("region", { name: "本次聆聽紀錄" })).toHaveTextContent("Track 1 · 累計 9 次");
    const next = screen.getByRole("link", { name: "看看下一個音檔" });
    expect(next).toHaveAttribute("href", "#listening-track-2");
    fireEvent.click(next);
    expect(store.getState().musicReducer.playing).toEqual({ id: 2 });
    expect(screen.getByTestId("track-1")).toHaveAttribute("data-queue", "1,2");
    fireEvent.click(screen.getByRole("button", { name: "收起本次聆聽提示" }));
    expect(screen.queryByRole("region", { name: "本次聆聽紀錄" })).not.toBeInTheDocument();
});

it("紀錄讀取失敗顯示未知，重試成功後才呈現統計", async () => {
    getBookPlaybackProgress.mockRejectedValueOnce(new Error("progress unavailable"));
    mount("");
    expect(await screen.findByRole("alert")).toHaveTextContent("這不代表沒有練習過");
    expect(screen.queryByText("0 次")).not.toBeInTheDocument();
    expect(screen.getByTestId("track-1")).toHaveAttribute("data-progress-status", "error");
    getBookPlaybackProgress.mockResolvedValueOnce({ progress: [{ track_id: 1, play_count: 3 }] });
    fireEvent.click(screen.getByRole("button", { name: "重新讀取紀錄" }));
    await screen.findByText("3 次");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("track-1")).toHaveAttribute("data-progress-status", "ready");
});

it("口說與作業的完成下一步沿用指定範圍及原模式", async () => {
    mount("?speaking=7&mode=challenge&tracks=2");
    await screen.findByTestId("track-2");
    act(() => window.dispatchEvent(new CustomEvent("ae:track-progress-updated", { detail: { track_id: 2, play_count: 1, listen_counted: true } })));
    expect(screen.getByRole("link", { name: "聽好了，回口說練習" })).toHaveAttribute("href", "/student/speaking-challenges/7?mode=challenge");
    expect(screen.queryByRole("link", { name: "看看下一個音檔" })).not.toBeInTheDocument();
    const { cleanup } = require("@testing-library/react");
    cleanup();
    mount("?assignment=4&required=7&tracks=1");
    await screen.findByTestId("track-1");
    await waitFor(() => expect(screen.getByTestId("track-1")).toHaveAttribute("data-progress-status", "ready"));
    act(() => window.dispatchEvent(new CustomEvent("ae:track-progress-updated", { detail: { track_id: 1, play_count: 7, listen_counted: true } })));
    expect(screen.getByRole("link", { name: "看看今日作業" })).toHaveAttribute("href", "/student/assignments");
    expect(screen.getByTestId("track-1")).toHaveAttribute("data-queue", "1");
});

it("老師預覽不讀學生進度或顯示學生完成提示", async () => {
    mockRole = "teacher";
    mount("");
    await screen.findByTestId("track-1");
    expect(getBookPlaybackProgress).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new CustomEvent("ae:track-progress-updated", { detail: { track_id: 1, play_count: 2, listen_counted: true } })));
    expect(screen.queryByRole("region", { name: "本次聆聽紀錄" })).not.toBeInTheDocument();
    expect(screen.queryByText("教材累計有效聆聽")).not.toBeInTheDocument();
});
