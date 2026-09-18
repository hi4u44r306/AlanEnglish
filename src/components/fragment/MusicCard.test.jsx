import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
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

        expect(screen.getByRole("button", { name: "暫停" })).toBeInTheDocument();
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

        expect(screen.getByRole("button", { name: "播放" })).toBeInTheDocument();
        expect(container.querySelector(".music-card__equalizer")).not.toBeInTheDocument();
    });
});
