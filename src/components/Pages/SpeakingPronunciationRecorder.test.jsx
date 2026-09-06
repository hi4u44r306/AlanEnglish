import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingPronunciationRecorder from "./SpeakingPronunciationRecorder";
import { submitSpeakingPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import { playSpeakingFeedbackSound, prepareSpeakingFeedbackSound } from "../../utils/speakingFeedbackSound";

jest.mock("../../services/pronunciationCoachService", () => ({
    submitSpeakingPronunciationAttempt: jest.fn()
}));
jest.mock("../../utils/audioWav", () => ({
    convertAudioBlobToWav: jest.fn()
}));
jest.mock("../../utils/speakingFeedbackSound", () => ({
    playSpeakingFeedbackSound: jest.fn(), prepareSpeakingFeedbackSound: jest.fn()
}));

describe("SpeakingPronunciationRecorder", () => {
    const originalMediaRecorder = window.MediaRecorder;
    const originalMediaDevices = navigator.mediaDevices;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    beforeEach(() => {
        const track = { stop: jest.fn() };
        Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [track] }) }
        });
        class MediaRecorderMock {
            static isTypeSupported = () => true;
            constructor() { this.mimeType = "audio/webm;codecs=opus"; this.state = "inactive"; }
            start() { this.state = "recording"; }
            stop() {
                this.state = "inactive";
                this.ondataavailable?.({ data: new Blob([new Uint8Array(1500)], { type: this.mimeType }) });
                this.onstop?.();
            }
        }
        window.MediaRecorder = MediaRecorderMock;
        URL.createObjectURL = jest.fn().mockReturnValue("blob:scoring-wav");
        URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
        window.MediaRecorder = originalMediaRecorder;
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
        jest.clearAllMocks();
    });

    it("回聽與送評使用同一份轉換後 WAV，不在送出時重複轉檔", async () => {
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        convertAudioBlobToWav.mockResolvedValue(wav);
        submitSpeakingPronunciationAttempt.mockResolvedValue({
            scores: { pronunciation: 88, accuracy: 90, fluency: 86, completeness: 92, prosody: 82 },
            words: [
                { text: "My", score: 90, status: "good" },
                { text: "name", score: 72, status: "practice" },
                { text: "Amy", score: 55, status: "retry" }
            ],
            feedback: "句尾再放慢一點。"
        });

        render(<SpeakingPronunciationRecorder
            firebaseUser={{ getIdToken: jest.fn() }}
            question={{ id: 9 }}
        />);
        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));

        await waitFor(() => expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1));
        expect(await screen.findByText("錄音完成，先聽聽看送評的聲音")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /送出評分/ }));

        await waitFor(() => expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledWith(expect.objectContaining({ audio: wav })));
        expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1);
        expect(await screen.findByText("表現良好")).toBeInTheDocument();
        expect(screen.queryByText("88 分")).not.toBeInTheDocument();
        expect(screen.queryByText("90")).not.toBeInTheDocument();
        expect(screen.getByText("綠色：很清楚")).toBeInTheDocument();
        expect(screen.getByText("My")).toHaveClass("word-good");
        expect(screen.getByText("name")).toHaveClass("word-practice");
        expect(screen.getByText("Amy")).toHaveClass("word-retry");
        expect(screen.getByText("句尾再放慢一點。")).toBeInTheDocument();
        expect(screen.queryByText("查看詳細分析")).not.toBeInTheDocument();
        expect(prepareSpeakingFeedbackSound).toHaveBeenCalledTimes(1);
        expect(playSpeakingFeedbackSound).toHaveBeenCalledWith("good");
    });
});
