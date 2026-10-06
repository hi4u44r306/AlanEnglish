jest.mock("../../services/localSpeakingRecognizer", () => ({ retainLocalSpeakingRecognizer: () => ({ recognizer: { ready: true, mode: "相容加速模式", prepare: jest.fn().mockResolvedValue(), transcribe: jest.fn().mockResolvedValue({recognizedText:"My name is Amy.",audioSeconds:2}) }, release: jest.fn() }) }));
import React from "react";
import { cleanup, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingPronunciationRecorder from "./SpeakingPronunciationRecorder";
import { SpeakingActivityContext } from "./SpeakingAdventureSession";
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
    const originalTimeout = global.setTimeout;
    const originalMediaRecorder = window.MediaRecorder;
    const originalMediaDevices = navigator.mediaDevices;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    beforeEach(() => {
        const nativeTimeout = originalTimeout;
        global.setTimeout = (fn, ms, ...args) => nativeTimeout(fn, ms === 4000 ? 0 : ms, ...args);
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
        cleanup();
        global.setTimeout = originalTimeout;
        jest.useRealTimers();
        window.MediaRecorder = originalMediaRecorder;
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
        jest.clearAllMocks();
        jest.restoreAllMocks();
        global.setTimeout = originalTimeout;
    });

    it.each([new TypeError("Failed to fetch"), new Error("upload failed"), new Error("provider timeout")])("技術失敗保留 WAV 重送，沒有答錯音效或通關回呼：%s", async failure => {
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        convertAudioBlobToWav.mockResolvedValue(wav);
        submitSpeakingPronunciationAttempt.mockRejectedValueOnce(failure).mockResolvedValue({ assessment_kind: "local_completeness_v1", answer_match: true, scores: { completeness: 88 } });
        const onScored = jest.fn();
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} firebaseUser={{}} onScored={onScored} />);
        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: /送出評分/ }));
        expect(await screen.findByRole("alert")).toHaveTextContent("錄音仍保留，請重試評分");
        expect(screen.queryByText("回答方式還差一點")).not.toBeInTheDocument();
        expect(onScored).not.toHaveBeenCalled();
        expect(playSpeakingFeedbackSound).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "重試評分" }));
        await screen.findByText("表現良好");
        await waitFor(() => expect(onScored).toHaveBeenCalledTimes(1));
        expect(submitSpeakingPronunciationAttempt.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({recognizedText:"My name is Amy.",audioSeconds:2}));
        expect(submitSpeakingPronunciationAttempt.mock.calls.at(-1)[0].audio).toBeUndefined();
        expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1);
    });
    it("評分等待期間顯示正確狀態，不提前呈現完成", async () => {
        let resolveScore;
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockReturnValue(new Promise(resolve => { resolveScore = resolve; }));
        const onScored = jest.fn();
        const setBusy = jest.fn();
        render(<SpeakingActivityContext.Provider value={setBusy}><SpeakingPronunciationRecorder question={{ id: 9 }} onScored={onScored} /></SpeakingActivityContext.Provider>);
        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: /送出評分/ }));
        expect(screen.getByRole("status")).toHaveTextContent("正在評分，請稍候");
        expect(setBusy).toHaveBeenLastCalledWith(true);
        expect(screen.getByRole("button", { name: "AI 評分中…" })).toBeDisabled();
        expect(screen.queryByText("本次練習結果")).not.toBeInTheDocument();
        expect(onScored).not.toHaveBeenCalled();
        resolveScore({ assessment_kind: "local_completeness_v1", answer_match: true, scores: { completeness: 88 } });
        await screen.findByText("表現良好");
        await waitFor(() => expect(setBusy).toHaveBeenLastCalledWith(false));
    });
    it("不完整評分回應不能被當成通關", async () => {
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockResolvedValue({});
        const onScored = jest.fn();
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} onScored={onScored} />);
        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: /送出評分/ }));
        await screen.findByRole("alert");
        expect(onScored).not.toHaveBeenCalled();
        expect(screen.queryByText("本次練習結果")).not.toBeInTheDocument();
    });
    it("倒數期間只公告一次固定提示，不逐秒朗讀數字", () => {
        const { rerender } = render(<SpeakingPronunciationRecorder
            firebaseUser={{ getIdToken: jest.fn() }}
            question={{ id: 9 }}
            disabledReason="先看清楚，3 秒後播放提示音。"
        />);

        expect(screen.getByRole("status")).toHaveTextContent("三秒後播放提示音");
        rerender(<SpeakingPronunciationRecorder
            firebaseUser={{ getIdToken: jest.fn() }}
            question={{ id: 9 }}
            disabledReason="先看清楚，2 秒後播放提示音。"
        />);
        expect(screen.getByRole("status")).toHaveTextContent("三秒後播放提示音");
        expect(screen.getByRole("status")).not.toHaveTextContent("2 秒");
    });

    it("回聽與送評使用同一份轉換後 WAV，不在送出時重複轉檔", async () => {
        const onPhaseChange = jest.fn();
        const onListenAgain = jest.fn();
        const onRetry = jest.fn();
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        convertAudioBlobToWav.mockResolvedValue(wav);
        submitSpeakingPronunciationAttempt.mockResolvedValue({
            assessment_kind: "local_completeness_v1", answer_match: true,
            recognized_text: "My name is Amy.",
            scores: { completeness: 88, pronunciation: null, accuracy: null, fluency: null, prosody: null },
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
            foundationRoundId="11111111-1111-4111-8111-111111111111"
            challengeSessionId="22222222-2222-4222-8222-222222222222"
            onPhaseChange={onPhaseChange}
            onListenAgain={onListenAgain}
            onRetry={onRetry}
        />);
        expect(screen.getByRole("status")).toHaveTextContent("可以開始錄音");
        expect(onPhaseChange).toHaveBeenLastCalledWith("ready");
        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        expect(await screen.findByRole("timer", { name: "錄音剩餘 25 秒" })).toHaveTextContent("25秒");
        expect(onPhaseChange).toHaveBeenLastCalledWith("recording");
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));

        await waitFor(() => expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1));
        expect(await screen.findByText("錄音完成，先聽聽看送評的聲音")).toBeInTheDocument();
        expect(onPhaseChange).toHaveBeenLastCalledWith("review");
        fireEvent.click(screen.getByRole("button", { name: /送出評分/ }));

        await waitFor(() => expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledWith(expect.objectContaining({
            recognizedText: "My name is Amy.",
            foundationRoundId: "11111111-1111-4111-8111-111111111111",
            challengeSessionId: "22222222-2222-4222-8222-222222222222"
        })));
        expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1);
        expect(await screen.findByText("表現良好")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("本次練習結果");
        expect(screen.getByText("我聽到")).toBeInTheDocument();
        expect(screen.getByText("My name is Amy.")).toBeInTheDocument();
        expect(screen.getByText("88 分")).toBeInTheDocument();
        expect(screen.queryByText("90")).not.toBeInTheDocument();
        expect(screen.getByText("綠色：有讀到")).toBeInTheDocument();
        expect(screen.getByText("My")).toHaveClass("word-good");
        expect(screen.getByText("name")).toHaveClass("word-practice");
        expect(screen.getByText("Amy")).toHaveClass("word-retry");
        expect(screen.getByText("句尾再放慢一點。")).toBeInTheDocument();
        expect(screen.getByText("這次先練這幾個字")).toBeInTheDocument();
        expect(screen.getByText("name、Amy")).toBeInTheDocument();
        expect(screen.getByLabelText("name：辨識文字")).toBeInTheDocument();
        expect(screen.queryByText("查看詳細分析")).not.toBeInTheDocument();
        expect(prepareSpeakingFeedbackSound).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(playSpeakingFeedbackSound).toHaveBeenCalledWith("good"));
        expect(onPhaseChange).toHaveBeenLastCalledWith("feedback");
        fireEvent.click(screen.getByRole("button", { name: "再聽示範" }));
        expect(onListenAgain).toHaveBeenCalledTimes(1);
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "再練一次" }));
        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(onPhaseChange).toHaveBeenLastCalledWith("ready");
        expect(screen.queryByText("本次練習結果")).not.toBeInTheDocument();
    });

    it.each([["standard_sentence", 25], ["text_qa", 25], ["letter_spelling", 12]])(
        "%s 依題型錄音，直到 %s 秒才停止", async (interactionType, seconds) => {
            jest.useFakeTimers();
            convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
            render(<SpeakingPronunciationRecorder question={{ id: 9 }} interactionType={interactionType} />);
            await act(async () => { fireEvent.click(screen.getByRole("button", { name: /開始錄音/ })); });
            await act(async () => { jest.advanceTimersByTime(seconds * 1000 - 1); });
            expect(screen.getByRole("button", { name: "完成錄音" })).toBeEnabled();
            expect(convertAudioBlobToWav).not.toHaveBeenCalled();
            await act(async () => { jest.advanceTimersByTime(1); });
            expect(convertAudioBlobToWav).toHaveBeenCalledWith(expect.any(Blob), 16000, { maxSeconds: seconds });
            expect(screen.queryByRole("timer")).not.toBeInTheDocument();
            expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        }
    );

    it("月額度用完仍可回聽，但不提供可重複送評的按鈕", async () => {
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockRejectedValueOnce(Object.assign(new Error("本月的語音評分時間已用完"), { code: "student_audio_budget_exhausted" }));
        const onScored = jest.fn();
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} onScored={onScored} />);
        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: /送出評分/ }));
        expect(await screen.findByRole("alert")).toHaveTextContent("本月的語音評分時間已用完");
        expect(screen.getByRole("button", { name: "重試評分" })).toBeDisabled();
        expect(document.querySelector("audio")).toHaveAttribute("src", "blob:scoring-wav");
        expect(onScored).not.toHaveBeenCalled();
    });

    it("後端判定 A–Z 回合失效時通知外層回到第一題", async () => {
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        const onRoundInvalid = jest.fn();
        convertAudioBlobToWav.mockResolvedValue(wav);
        submitSpeakingPronunciationAttempt.mockRejectedValue(Object.assign(
            new Error("這一輪已失效，請從第一題重新開始"),
            { code: "foundation_round_invalid" }
        ));

        render(<SpeakingPronunciationRecorder
            firebaseUser={{ getIdToken: jest.fn() }}
            question={{ id: 9 }}
            foundationRoundId="11111111-1111-4111-8111-111111111111"
            onRoundInvalid={onRoundInvalid}
        />);

        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));
        await waitFor(() => expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1));
        fireEvent.click(await screen.findByRole("button", { name: /送出評分/ }));

        await waitFor(() => expect(onRoundInvalid).toHaveBeenCalledWith(expect.objectContaining({
            code: "foundation_round_invalid"
        })));
        expect(screen.getByRole("alert")).toHaveTextContent("這一輪已失效，請從第一題重新開始");
        expect(playSpeakingFeedbackSound).not.toHaveBeenCalled();
    });

    it("拼讀辨識不確定時不顯示答錯，並使用練習提示音", async () => {
        const onScored = jest.fn();
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        convertAudioBlobToWav.mockResolvedValue(wav);
        submitSpeakingPronunciationAttempt.mockResolvedValue({
            assessment_kind: "local_completeness_v1", answer_match: false,
            assessment_status: "uncertain",
            recognized_text: "apple",
            scores: { completeness: 52 },
            words: [{ text: "P", score: 18, status: "retry" }],
            feedback: "系統這次沒有聽清楚，不算你答錯；請把每個字母稍微分開，再試一次。"
        });

        render(<SpeakingPronunciationRecorder
            firebaseUser={{ getIdToken: jest.fn() }}
            question={{ id: 14 }}
            onScored={onScored}
        />);

        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));
        await waitFor(() => expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1));
        fireEvent.click(await screen.findByRole("button", { name: /送出評分/ }));

        expect(await screen.findByText("系統沒有聽清楚")).toBeInTheDocument();
        expect(screen.queryByText("回答方式還差一點")).not.toBeInTheDocument();
        expect(screen.getByText(/不算你答錯/)).toBeInTheDocument();
        expect(playSpeakingFeedbackSound).toHaveBeenCalledWith("practice");
        expect(onScored).not.toHaveBeenCalled();
        expect(screen.queryByLabelText("發音顏色說明")).not.toBeInTheDocument();
        expect(screen.queryByText("這次先練這幾個字")).not.toBeInTheDocument();
    });

    it("分數先显示四秒，再通知外層通關，不顯示百分比", async () => {
        global.setTimeout = originalTimeout;
        jest.useFakeTimers();
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockResolvedValue({ assessment_kind: "local_completeness_v1", answer_match: true, scores: { completeness: 85 } });
        const onScored = jest.fn();
        render(<SpeakingPronunciationRecorder question={{id:9}} onScored={onScored} />);
        await act(async () => fireEvent.click(screen.getByRole("button", {name:/開始錄音/})));
        await act(async () => fireEvent.click(screen.getByRole("button", {name:"完成錄音"})));
        await act(async () => fireEvent.click(screen.getByRole("button", {name:/送出評分/})));
        expect(screen.getByText("85 分")).toBeInTheDocument();
        expect(screen.queryByText("85%")).not.toBeInTheDocument();
        await act(async () => jest.advanceTimersByTime(3999)); expect(onScored).not.toHaveBeenCalled();
        await act(async () => jest.advanceTimersByTime(1)); expect(onScored).toHaveBeenCalledTimes(1);
    });

    it("另一個請求正在評分時只提示等待，不把有效回合歸零", async () => {
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        const onRoundInvalid = jest.fn();
        convertAudioBlobToWav.mockResolvedValue(wav);
        submitSpeakingPronunciationAttempt.mockRejectedValue(Object.assign(
            new Error("這一題正在評分，請稍候再試"),
            { code: "foundation_round_busy" }
        ));

        render(<SpeakingPronunciationRecorder
            firebaseUser={{ getIdToken: jest.fn() }}
            question={{ id: 9 }}
            foundationRoundId="11111111-1111-4111-8111-111111111111"
            onRoundInvalid={onRoundInvalid}
        />);

        fireEvent.click(screen.getByRole("button", { name: /開始錄音/ }));
        fireEvent.click(await screen.findByRole("button", { name: "完成錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: /送出評分/ }));

        expect(await screen.findByRole("alert")).toHaveTextContent("這一題正在評分");
        expect(onRoundInvalid).not.toHaveBeenCalled();
    });
});
