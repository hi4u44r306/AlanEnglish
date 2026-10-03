import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AlphabetAutomaticRecorder, { rmsLevel } from "./AlphabetAutomaticRecorder";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import { submitSpeakingPronunciationAttempt } from "../../services/pronunciationCoachService";

jest.mock("../../utils/audioWav", () => ({ convertAudioBlobToWav: jest.fn() }));
jest.mock("../../services/pronunciationCoachService", () => ({ submitSpeakingPronunciationAttempt: jest.fn() }));

describe("AlphabetAutomaticRecorder", () => {
    const originalMediaDevices = navigator.mediaDevices;
    const originalMediaRecorder = window.MediaRecorder;
    const originalAudioContext = window.AudioContext;
    const originalRequestFrame = window.requestAnimationFrame;
    const originalCancelFrame = window.cancelAnimationFrame;
    const originalCreateUrl = URL.createObjectURL;
    const originalRevokeUrl = URL.revokeObjectURL;
    let now;
    let level;
    let frames;
    let recorders;
    let stopTrack;
    const callbacks = { onScored: jest.fn(), onRoundInvalid: jest.fn() };
    const props = {
        firebaseUser: { uid: "student" }, question: { id: 1 },
        foundationRoundId: "11111111-1111-4111-8111-111111111111",
        ...callbacks
    };

    beforeEach(() => {
        jest.clearAllMocks();
        now = 0;
        level = 0;
        frames = new Map();
        recorders = [];
        stopTrack = jest.fn();
        jest.spyOn(performance, "now").mockImplementation(() => now);
        let frameId = 0;
        window.requestAnimationFrame = jest.fn(callback => { frames.set(++frameId, callback); return frameId; });
        window.cancelAnimationFrame = jest.fn(id => frames.delete(id));
        URL.createObjectURL = jest.fn(() => "blob:alphabet-preview");
        URL.revokeObjectURL = jest.fn();
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
            getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
        } });
        window.AudioContext = class {
            resume = jest.fn().mockResolvedValue();
            close = jest.fn().mockResolvedValue();
            createAnalyser = () => ({ fftSize: 1024, getFloatTimeDomainData: samples => samples.fill(level) });
            createMediaStreamSource = () => ({ connect: jest.fn() });
        };
        window.MediaRecorder = class {
            static isTypeSupported = () => true;
            constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; recorders.push(this); }
            start() { this.state = "recording"; this.startedAt = now; }
            stop() {
                this.state = "inactive";
                this.ondataavailable?.({ data: new Blob([new Uint8Array(1000)], { type: this.mimeType }) });
                this.onstop?.();
            }
        };
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(16000)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockResolvedValue({ answer_match: true, foundation_round: { status: "open" } });
    });

    const frame = async (time, volume = 0) => {
        now = time;
        level = volume;
        await act(async () => {
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach(callback => callback(now));
        });
    };
    const speak = async () => {
        await frame(100);
        await frame(1000, 0.2);
        await frame(1016, 0.2);
        await frame(1032, 0.2);
        await frame(1950);
    };
    const mount = async () => {
        const view = render(<AlphabetAutomaticRecorder {...props} />);
        await waitFor(() => expect(recorders.length).toBe(1));
        return view;
    };

    afterEach(() => {
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
        window.MediaRecorder = originalMediaRecorder;
        window.AudioContext = originalAudioContext;
        window.requestAnimationFrame = originalRequestFrame;
        window.cancelAnimationFrame = originalCancelFrame;
        URL.createObjectURL = originalCreateUrl;
        URL.revokeObjectURL = originalRevokeUrl;
        jest.restoreAllMocks();
    });

    it("聲音出現前已錄製，送評保留 250ms 開頭緩衝並裁掉等待空白", async () => {
        await mount();
        expect(recorders[0].startedAt).toBe(0);
        await speak();
        expect(convertAudioBlobToWav).toHaveBeenCalledWith(expect.any(Blob), 16000, { startSeconds: 0.782 });
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
        expect(callbacks.onScored).toHaveBeenCalledTimes(1);
    });

    it("等待逾八秒只重建本機緩衝，不送環境音、不判答錯", async () => {
        await mount();
        await frame(100);
        await frame(8100);
        expect(recorders).toHaveLength(2);
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        expect(callbacks.onScored).not.toHaveBeenCalled();
    });

    it("技術失敗保留 WAV 回聽，手動重試不重轉檔、不自動重送", async () => {
        submitSpeakingPronunciationAttempt.mockRejectedValueOnce(new Error("評分服務暫時無法使用"));
        await mount();
        await speak();
        expect(screen.getByLabelText("回聽這次字母錄音")).toHaveAttribute("src", "blob:alphabet-preview");
        expect(callbacks.onScored).not.toHaveBeenCalled();
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "重試評分" }));
        await waitFor(() => expect(callbacks.onScored).toHaveBeenCalledTimes(1));
        expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1);
        expect(submitSpeakingPronunciationAttempt.mock.calls[0][0].audio)
            .toBe(submitSpeakingPronunciationAttempt.mock.calls[1][0].audio);
    });

    it("連點重試不併發送評，收到評分後移除技術失敗操作", async () => {
        let finish;
        submitSpeakingPronunciationAttempt.mockRejectedValueOnce(new Error("網路錯誤"))
            .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        await mount();
        await speak();
        const retry = screen.getByRole("button", { name: "重試評分" });
        act(() => { retry.click(); retry.click(); });
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(2);
        await act(async () => finish({ answer_match: false, foundation_round: { status: "retry" } }));
        // 下一次錄音需由關卡回饋重新啟動；成功收到評分不留下技術失敗操作。
        expect(screen.queryByRole("button", { name: "重試評分" })).not.toBeInTheDocument();
    });

    it("重新錄音清除舊預覽，不自動重送失敗音檔", async () => {
        submitSpeakingPronunciationAttempt.mockRejectedValueOnce(new Error("網路錯誤"));
        await mount();
        await speak();
        fireEvent.click(screen.getByRole("button", { name: "重新錄音" }));
        expect(recorders).toHaveLength(2);
        expect(screen.queryByLabelText("回聽這次字母錄音")).not.toBeInTheDocument();
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it("長發聲在十二秒安全界線內停止，包含前置緩衝", async () => {
        await mount();
        await frame(100);
        await frame(1000, 0.2);
        await frame(1016, 0.2);
        await frame(1032, 0.2);
        await frame(12682, 0.2);
        expect(recorders[0].state).toBe("inactive");
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
    });

    it("回合失效走原有復原流程，不能重送過期錄音", async () => {
        submitSpeakingPronunciationAttempt.mockRejectedValueOnce(Object.assign(new Error("回合已結束"), { code: "foundation_round_expired" }));
        await mount();
        await speak();
        expect(callbacks.onRoundInvalid).toHaveBeenCalledTimes(1);
        expect(callbacks.onScored).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "重試評分" })).not.toBeInTheDocument();
    });

    it("換题與離開取消錄音，忽略舊題晚到的評分", async () => {
        let finish;
        submitSpeakingPronunciationAttempt.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const view = await mount();
        await speak();
        view.rerender(<AlphabetAutomaticRecorder {...props} question={{ id: 2 }} />);
        await act(async () => finish({ answer_match: true }));
        expect(callbacks.onScored).not.toHaveBeenCalled();
        view.unmount();
        expect(stopTrack).toHaveBeenCalled();
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
    });

    it("計算本機 VAD 音量，不需要把連續環境音上傳", () => {
        expect(rmsLevel(new Float32Array([0, 0, 0]))).toBe(0);
        expect(rmsLevel(new Float32Array([1, -1]))).toBeCloseTo(1);
    });

    it("瀏覽器不支援錄音時清楚提示，不顯示手動錄音或送出按鈕", async () => {
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
        window.MediaRecorder = undefined;
        render(<AlphabetAutomaticRecorder
            firebaseUser={{ uid: "student" }}
            question={{ id: 1 }}
            foundationRoundId="11111111-1111-4111-8111-111111111111"
            onScored={jest.fn()}
            onRoundInvalid={jest.fn()}
        />);

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("不支援自動收音"));
        expect(screen.queryByRole("button", { name: /錄音|送出/ })).not.toBeInTheDocument();
    });
});
