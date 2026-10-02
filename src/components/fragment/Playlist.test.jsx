import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import musicReducer from "../../reducers/musicReducer";
import { setPlayPauseStatus } from "../../actions/actions";
import Playlist from "./Playlist";
import { getAccessibleBook } from "../../services/contentAccessService";
import { getBookPlaybackProgress } from "../../services/listeningService";
jest.mock("../../services/contentAccessService", () => ({ getAccessibleBook: jest.fn() }));
jest.mock("../../services/listeningService", () => ({ getBookPlaybackProgress: jest.fn().mockResolvedValue({ progress: [] }) }));
const mockUser = { uid: "test" };
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockUser, role: "student" }) }));
jest.mock("./MusicCard", () => function Card({ music, playbackQueue }) { return <div data-testid={`track-${music.id}`} data-queue={playbackQueue.map(item => item.id).join(",")}>{music.title}</div>; });
const Probe = () => { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; };
const result = { book: { id: 1, name: "Workbook 1" }, tracks: [1, 2].map(id => ({ id, book_id: 1, title: `Track ${id}`, music_name: `Track ${id}`, page: `P.${id}`, audio_url: "signed-audio" })) };
const mount = search => {
    const store = configureStore({ reducer: { musicReducer }, preloadedState: { musicReducer: { playingStatus: true, playing: { id: 2 } } } });
    render(<Provider store={store}><MemoryRouter initialEntries={[`/student/books/W1${search}`]}><Probe /><Routes><Route path="/student/books/:playlistId" element={<Playlist />} /><Route path="/student/speaking-challenges/:id" element={<p>已返回口說</p>} /></Routes></MemoryRouter></Provider>);
    return store;
};
beforeEach(() => { sessionStorage.clear(); getAccessibleBook.mockReset().mockResolvedValue(result); getBookPlaybackProgress.mockResolvedValue({ progress: [] }); });
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
