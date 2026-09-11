import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingRecordingPlayer from "./SpeakingRecordingPlayer";

describe("SpeakingRecordingPlayer", () => {
    it("renders a branded recording player and reflects playback progress", () => {
        render(<SpeakingRecordingPlayer src="https://example.com/recording.wav" label="聽聽我的回答" ariaLabel="測試錄音" />);

        const audio = screen.getByLabelText("測試錄音");
        Object.defineProperty(audio, "duration", { configurable: true, value: 12 });
        fireEvent.loadedMetadata(audio);
        Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 5 });
        fireEvent.timeUpdate(audio);

        expect(audio.getAttribute("src")).toBe("https://example.com/recording.wav");
        expect(screen.getByRole("button", { name: "播放聽聽我的回答" })).toBeInTheDocument();
        expect(screen.getByRole("slider", { name: "聽聽我的回答播放進度" }).value).toBe("5");
        expect(screen.getByText("0:05 / 0:12")).toBeInTheDocument();
    });
});
