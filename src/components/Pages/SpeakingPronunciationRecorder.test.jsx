import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    it("錄音完成後使用同一份轉換後 WAV 自動送評", async () => {
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        convertAudioBlobToWav.mockResolvedValue(wav);
        submitSpeakingPronunciationAttempt.mockResolvedValue({
            answer_match: true,
            recognized_text: "My name is Amy.",
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
        await waitFor(() => expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledWith(expect.objectContaining({ audio: wav })));
        expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("button", { name: /送出評分/ })).not.toBeInTheDocument();
        expect(await screen.findByText("表現良好")).toBeInTheDocument();
        expect(screen.getByText("我聽到")).toBeInTheDocument();
        expect(screen.getByText("My name is Amy.")).toBeInTheDocument();
        expect(screen.queryByText("88 分")).not.toBeInTheDocument();
        expect(screen.queryByText("90")).not.toBeInTheDocument();
        expect(screen.getByText("綠色：很清楚")).toBeInTheDocument();
        expect(screen.getByText("My")).toHaveClass("word-good");
        expect(screen.getByText("name")).toHaveClass("word-practice");
        expect(screen.getByText("Amy")).toHaveClass("word-retry");
        expect(screen.getByText("句尾再放慢一點。")).toBeInTheDocument();
        expect(screen.queryByText("查看詳細分析")).not.toBeInTheDocument();
        expect(prepareSpeakingFeedbackSound).toHaveBeenCalledTimes(2);
        expect(playSpeakingFeedbackSound).toHaveBeenCalledWith("good");
        expect(screen.getByRole("button", { name: "播放聽聽我的回答" })).toBeInTheDocument();
    });

    it("問題播完後顯示倒數，也允許學生提早開始", async () => {
        render(<SpeakingPronunciationRecorder
            firebaseUser={{ getIdToken: jest.fn() }}
            question={{ id: 9 }}
            autoStartToken={1}
            countdownSeconds={5}
        />);

        expect(screen.getByText("想一下，準備回答")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /我準備好了/ }));
        await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole("button", { name: "完成錄音" })).toBeInTheDocument();
    });

    it("送評期間顯示明確的載入狀態並通知外層鎖定操作", async () => {
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        let resolveScore;
        convertAudioBlobToWav.mockResolvedValue(wav);
        submitSpeakingPronunciationAttempt.mockImplementation(() => new Promise(resolve => { resolveScore = resolve; }));
        const onBusyChange = jest.fn();

        render(<SpeakingPronunciationRecorder
            firebaseUser={{ getIdToken: jest.fn() }}
            question={{ id: 10 }}
            onBusyChange={onBusyChange}
        />);
        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));

        const status = await screen.findByRole("status", { name: "AI 發音評分進行中" });
        await waitFor(() => expect(status).toHaveTextContent("AI 正在聽你的發音…"));
        expect(status).toHaveTextContent("通常需要 3～8 秒，請不要離開頁面。");
        expect(status.closest("section")).toHaveAttribute("aria-busy", "true");
        expect(onBusyChange).toHaveBeenCalledWith(true);
        expect(screen.queryByRole("button", { name: "重新錄音" })).not.toBeInTheDocument();

        await act(async () => resolveScore({
            answer_match: true,
            scores: { pronunciation: 86 },
            words: [],
            feedback: "保持這個速度。"
        }));
        expect(await screen.findByText("表現良好")).toBeInTheDocument();
        await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    });
});
