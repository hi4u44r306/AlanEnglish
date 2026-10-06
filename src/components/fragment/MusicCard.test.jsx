import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDispatch, useSelector } from "react-redux";
import MusicCard from "./MusicCard";

jest.mock("react-redux", () => ({
    useDispatch: jest.fn(),
    useSelector: jest.fn()
}));

describe("MusicCard", () => {
    const music = {
        id: "audio-1",
        audioURL: "https://r2.example/audio.mp3",
        bookname: "Workbook 1",
        page: "P22"
    };

    beforeEach(() => {
        useDispatch.mockReturnValue(jest.fn());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("播放中以符合按鈕尺寸的四條音樂等化器顯示狀態", () => {
        useSelector.mockImplementation(selector => selector({
            musicReducer: {
                playing: music,
                playingStatus: true
            }
        }));

        const { container } = render(<MusicCard music={music} />);

        expect(screen.getByRole("button", { name: "暫停 P22" })).toBeInTheDocument();
        expect(screen.getByText("正在聆聽")).toBeInTheDocument();
        expect(container.querySelectorAll(".music-card__equalizer > span")).toHaveLength(4);
    });

    it("未播放時維持播放圖示", () => {
        useSelector.mockImplementation(selector => selector({
            musicReducer: {
                playing: null,
                playingStatus: false
            }
        }));

        const { container } = render(<MusicCard music={music} />);

        expect(screen.getByRole("button", { name: "播放 P22" })).toBeInTheDocument();
        expect(container.querySelector(".music-card__equalizer")).not.toBeInTheDocument();
    });

    it("播放具體音檔並保留指定 queue 與人工互動重置", () => {
        const dispatch = jest.fn();
        useDispatch.mockReturnValue(dispatch);
        useSelector.mockImplementation(selector => selector({ musicReducer: { playing: null, playingStatus: false } }));
        const queue = [music, { ...music, id: "audio-2" }];
        render(<MusicCard music={{ ...music, title: "At the zoo" }} playbackQueue={queue} />);
        fireEvent.click(screen.getByRole("button", { name: "播放 At the zoo" }));
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_CURR_PLAYING", payload: expect.objectContaining({ id: music.id, playbackQueue: queue }) });
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_PLAY_PAUSE_STATUS", payload: true });
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_NO_INTERACTION_COUNT", payload: 0 });
        expect(localStorage.getItem("ae-no-interaction")).toBe("0");
    });

    it("暫停與繼續不切換音檔或重設 queue", () => {
        const dispatch = jest.fn();
        useDispatch.mockReturnValue(dispatch);
        const state = { musicReducer: { playing: music, playingStatus: true } };
        useSelector.mockImplementation(selector => selector(state));
        const { rerender } = render(<MusicCard music={music} />);
        fireEvent.click(screen.getByRole("button", { name: "暫停 P22" }));
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_PLAY_PAUSE_STATUS", payload: false });
        expect(dispatch.mock.calls.some(([action]) => action.type === "SET_CURR_PLAYING")).toBe(false);
        state.musicReducer.playingStatus = false;
        rerender(<MusicCard music={music} />);
        expect(screen.getByText("已暫停，可繼續聽")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "播放 P22" }));
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_PLAY_PAUSE_STATUS", payload: true });
    });

    it("沒有網址不能播放，紀錄載入失敗不冒充零進度", () => {
        const dispatch = jest.fn();
        useDispatch.mockReturnValue(dispatch);
        useSelector.mockImplementation(selector => selector({ musicReducer: { playing: null, playingStatus: false } }));
        render(<MusicCard music={{ ...music, audioURL: null }} progressStatus="error" />);
        const button = screen.getByRole("button", { name: "音檔暫時無法播放 P22" });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(dispatch).not.toHaveBeenCalled();
        expect(screen.getByText("紀錄未載入")).toBeInTheDocument();
        expect(screen.queryByText("0 / 10")).not.toBeInTheDocument();
    });

    it("第9次仍未通過，第10次才顯示通過", () => {
        useSelector.mockImplementation(selector => selector({ musicReducer: { playing: null, playingStatus: false } }));

        const { rerender } = render(<MusicCard music={music} progress={{ play_count: 9, completed: true }} />);
        expect(screen.getByText("9 / 10")).toBeInTheDocument();
        expect(screen.queryByText("通過")).not.toBeInTheDocument();

        rerender(<MusicCard music={music} progress={{ play_count: 10, completed: false }} />);
        expect(screen.getByText("10 / 10")).toBeInTheDocument();
        expect(screen.getByText("通過")).toBeInTheDocument();
    });
});
