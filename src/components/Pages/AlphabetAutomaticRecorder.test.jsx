import React from "react";
import "@testing-library/jest-dom";
import { cleanup, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AlphabetAutomaticRecorder, { rmsLevel } from "./AlphabetAutomaticRecorder";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import { submitAlphabetPronunciationAttempt } from "../../services/pronunciationCoachService";

jest.mock("../../utils/audioWav", () => ({ convertAudioBlobToWav: jest.fn() }));
jest.mock("../../services/pronunciationCoachService", () => ({ submitAlphabetPronunciationAttempt: jest.fn() }));

describe("AlphabetAutomaticRecorder", () => {
    const originalTimeout = global.setTimeout;
    const originalMediaDevices = navigator.mediaDevices;
    const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
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
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        const nativeTimeout = global.setTimeout;
        global.setTimeout = (fn, ms, ...args) => nativeTimeout(fn, ms === 900 ? 0 : ms, ...args);
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
        const audioTrack = { stop: stopTrack };
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
            getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [audioTrack] })
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
        submitAlphabetPronunciationAttempt.mockResolvedValue({ assessment_kind: "azure_pronunciation", answer_match: true, scores: { pronunciation: 100 }, foundation_round: { status: "open" } });
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
    const visibility = async value => {
        await act(async () => {
            Object.defineProperty(document, "visibilityState", { configurable: true, value });
            document.dispatchEvent(new Event("visibilitychange"));
        });
    };

    afterEach(() => {
        cleanup();
        if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
        else delete document.visibilityState;
        global.setTimeout = originalTimeout;
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
        expect(convertAudioBlobToWav).toHaveBeenCalledWith(expect.any(Blob), 16000, { startSeconds: 0.782, maxSeconds: 12 });
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(callbacks.onScored).toHaveBeenCalledTimes(1));
    });
    it.each([true, false])("字母結果依後端答對狀態顯示勾叉，不顯示分數：%s", async answerMatch => {
        let finishFeedback;
        global.setTimeout = (fn, ms, ...args) => ms === 900
            ? (finishFeedback = fn, 1) : originalTimeout(fn, ms, ...args);
        submitAlphabetPronunciationAttempt.mockResolvedValue({ assessment_kind: "azure_pronunciation", answer_match: answerMatch, scores: { pronunciation: 85 }, foundation_round: { status: answerMatch ? "open" : "retry" } });
        const view = await mount();
        await speak();
        expect(await screen.findByText(answerMatch ? "通過！" : "再唸一次")).toBeInTheDocument();
        expect(view.container.querySelector(answerMatch ? ".is-passed" : ".is-incorrect")).toBeInTheDocument();
        expect(screen.queryByText(/85|字母發音|朗讀完整度/)).not.toBeInTheDocument();
        if (answerMatch) {
            expect(callbacks.onScored).not.toHaveBeenCalled();
            await act(async () => finishFeedback());
        } else {
            expect(finishFeedback).toBeUndefined();
        }
        expect(callbacks.onScored).toHaveBeenCalledWith(expect.objectContaining({ answer_match: answerMatch }));
    });
    it("重唸等待不錄環境音，按鈕由關卡啟動同一題，不重送舊音檔", async () => {
        const onRetryReading = jest.fn();
        const view = await mount();
        view.rerender(<AlphabetAutomaticRecorder {...props} paused waitingForRetry onRetryReading={onRetryReading} />);
        const count = recorders.length;
        await frame(20000, 0.2);
        expect(recorders).toHaveLength(count);
        expect(recorders[count - 1].state).toBe("inactive");
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
        expect(screen.getByText("準備好後，按下方按鈕再唸。")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "再唸一次" }));
        expect(onRetryReading).toHaveBeenCalledTimes(1);
        view.rerender(<AlphabetAutomaticRecorder {...props} onRetryReading={onRetryReading} />);
        expect(recorders).toHaveLength(count + 1);
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
    });
    it("慢速判別顯示等待提示，不另錄音或自動再送評", async () => {
        let showSlowHint;
        global.setTimeout = (fn, ms, ...args) => ms === 15000
            ? (showSlowHint = fn, 1) : originalTimeout(fn, ms, ...args);
        submitAlphabetPronunciationAttempt.mockImplementationOnce(() => new Promise(() => {}));
        await mount();
        await speak();
        await act(async () => showSlowHint());
        expect(screen.getByText(/這次等待較久/)).toBeInTheDocument();
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
        expect(recorders).toHaveLength(1);
        expect(screen.queryByRole("button", { name: "重試評分" })).not.toBeInTheDocument();
    });
    it("字母額度用完即轉回聽模式，不判通關或自動重送", async () => {
        submitAlphabetPronunciationAttempt.mockRejectedValueOnce(Object.assign(new Error("明天再挑戰"), { code: "alphabet_letter_daily_limit_reached" }));
        const onPracticeOnly = jest.fn();
        render(<AlphabetAutomaticRecorder {...props} onPracticeOnly={onPracticeOnly} />);
        await waitFor(() => expect(recorders.length).toBe(1));
        await speak();
        expect(onPracticeOnly).toHaveBeenCalledWith("明天再挑戰");
        expect(callbacks.onScored).not.toHaveBeenCalled();
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
    });

    it("等待逾八秒只重建本機緩衝，不送環境音、不判答錯", async () => {
        await mount();
        await frame(100);
        await frame(8100);
        expect(recorders).toHaveLength(2);
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
        expect(callbacks.onScored).not.toHaveBeenCalled();
    });

    it("切到背景即停麥克風，回來不自動錄音，原題原回合按按鈕才重開", async () => {
        render(<AlphabetAutomaticRecorder {...props} challengeSessionId="original-session" />);
        await waitFor(() => expect(recorders).toHaveLength(1));
        await visibility("hidden");
        expect(stopTrack).toHaveBeenCalledTimes(1);
        expect(recorders[0].state).toBe("inactive");
        expect(screen.getByText("麥克風已暫停")).toBeInTheDocument();
        expect(screen.queryByText("麥克風已開啟")).not.toBeInTheDocument();
        await visibility("visible");
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
        const reopen = screen.getByRole("button", { name: "重新開啟麥克風" });
        act(() => { reopen.click(); reopen.click(); });
        await waitFor(() => expect(recorders).toHaveLength(2));
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
        await speak();
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledWith(expect.objectContaining({
            questionId: props.question.id, foundationRoundId: props.foundationRoundId,
            challengeSessionId: "original-session"
        }));
    });
    it("切換時丟棄未完成的半段朗讀，不因停止錄音自動送評", async () => {
        await mount();
        await frame(100);
        await frame(1000, 0.2);
        await frame(1016, 0.2);
        await frame(1032, 0.2);
        expect(screen.getByText("正在聽你說")).toBeInTheDocument();
        await visibility("hidden");
        await visibility("visible");
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
        expect(callbacks.onScored).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "重新開啟麥克風" }));
        await waitFor(() => expect(recorders).toHaveLength(2));
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
    });
    it("已送評後切換頁面保留原回覆，只處理一次；換題後可重開麥克風", async () => {
        let finish;
        submitAlphabetPronunciationAttempt.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const view = await mount();
        await speak();
        await visibility("hidden");
        await visibility("visible");
        expect(screen.getByText("正在判別…")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "重新開啟麥克風" })).not.toBeInTheDocument();
        await act(async () => finish({ assessment_kind: "azure_pronunciation", answer_match: true, scores: { pronunciation: 100 }, foundation_round: { status: "open" } }));
        await waitFor(() => expect(callbacks.onScored).toHaveBeenCalledTimes(1));
        view.rerender(<AlphabetAutomaticRecorder {...props} question={{ id: 2 }} />);
        expect(screen.getByText("麥克風已暫停")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "重新開啟麥克風" }));
        await waitFor(() => expect(recorders).toHaveLength(2));
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
        expect(callbacks.onScored).toHaveBeenCalledTimes(1);
    });
    it("第一次拒絕麥克風權限，可留在關卡再次開啟", async () => {
        navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
        render(<AlphabetAutomaticRecorder {...props} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("尚未允許使用麥克風");
        expect(screen.getByText("如何允許麥克風？")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "重新檢查" }));
        await waitFor(() => expect(recorders).toHaveLength(1));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
    });
    it("權限請求未完成就切走，晚到的麥克風會關閉，不在背景啟動", async () => {
        let finishPermission;
        const stopLateTrack = jest.fn();
        navigator.mediaDevices.getUserMedia.mockImplementationOnce(() => new Promise(resolve => { finishPermission = resolve; }));
        render(<AlphabetAutomaticRecorder {...props} />);
        await visibility("hidden");
        await act(async () => finishPermission({ getTracks: () => [{ stop: stopLateTrack }] }));
        expect(stopLateTrack).toHaveBeenCalledTimes(1);
        expect(recorders).toHaveLength(0);
        expect(screen.getByText("麥克風已暫停")).toBeInTheDocument();
        await visibility("visible");
        fireEvent.click(screen.getByRole("button", { name: "重新開啟麥克風" }));
        await waitFor(() => expect(recorders).toHaveLength(1));
    });

    it("技術失敗保留 WAV 回聽，手動重試不重轉檔、不自動重送", async () => {
        submitAlphabetPronunciationAttempt.mockRejectedValueOnce(new Error("評分服務暫時無法使用"));
        await mount();
        await speak();
        expect(screen.getByLabelText("回聽這次字母錄音")).toHaveAttribute("src", "blob:alphabet-preview");
        expect(callbacks.onScored).not.toHaveBeenCalled();
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "重試評分" }));
        await waitFor(() => expect(callbacks.onScored).toHaveBeenCalledTimes(1));
        expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1);
        expect(submitAlphabetPronunciationAttempt.mock.calls[0][0].audio)
            .toBe(submitAlphabetPronunciationAttempt.mock.calls[1][0].audio);
    });

    it("連點重試不併發送評，收到評分後移除技術失敗操作", async () => {
        let finish;
        submitAlphabetPronunciationAttempt.mockRejectedValueOnce(new Error("網路錯誤"))
            .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        await mount();
        await speak();
        const retry = screen.getByRole("button", { name: "重試評分" });
        act(() => { retry.click(); retry.click(); });
        await waitFor(() => expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(2));
        await act(async () => finish({ assessment_kind: "azure_pronunciation", answer_match: false, scores: { pronunciation: 0 }, foundation_round: { status: "retry" } }));
        // 下一次錄音需由關卡回饋重新啟動；成功收到評分不留下技術失敗操作。
        expect(screen.queryByRole("button", { name: "重試評分" })).not.toBeInTheDocument();
    });

    it("重新錄音清除舊預覽，不自動重送失敗音檔", async () => {
        submitAlphabetPronunciationAttempt.mockRejectedValueOnce(new Error("網路錯誤"));
        await mount();
        await speak();
        fireEvent.click(screen.getByRole("button", { name: "重新錄音" }));
        expect(recorders).toHaveLength(2);
        expect(screen.queryByLabelText("回聽這次字母錄音")).not.toBeInTheDocument();
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
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
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
    });

    it("回合失效走原有復原流程，不能重送過期錄音", async () => {
        submitAlphabetPronunciationAttempt.mockRejectedValueOnce(Object.assign(new Error("回合已結束"), { code: "foundation_round_expired" }));
        await mount();
        await speak();
        expect(callbacks.onRoundInvalid).toHaveBeenCalledTimes(1);
        expect(callbacks.onScored).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "重試評分" })).not.toBeInTheDocument();
    });

    it("換题與離開取消錄音，忽略舊題晚到的評分", async () => {
        let finish;
        submitAlphabetPronunciationAttempt.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const view = await mount();
        await speak();
        view.rerender(<AlphabetAutomaticRecorder {...props} question={{ id: 2 }} />);
        await act(async () => finish({ assessment_kind: "azure_pronunciation", answer_match: true }));
        expect(callbacks.onScored).not.toHaveBeenCalled();
        view.unmount();
        expect(stopTrack).toHaveBeenCalled();
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledTimes(1);
    });

    it("換題後忽略舊容器晚到的音訊與錯誤，不混入新題錄音", async () => {
        const view = await mount();
        const oldRecorder = recorders[0];
        view.rerender(<AlphabetAutomaticRecorder {...props} question={{ id: 2 }} />);
        await act(async () => {
            oldRecorder.ondataavailable({ data: new Blob([new Uint8Array(3000)]) });
            oldRecorder.onerror();
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        await speak();
        expect(convertAudioBlobToWav.mock.calls[0][0].size).toBe(1000);
        expect(submitAlphabetPronunciationAttempt.mock.calls[0][0].questionId).toBe(2);
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

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("這個瀏覽器無法錄音"));
        expect(screen.queryByRole("button", { name: /錄音|送出/ })).not.toBeInTheDocument();
    });
    it.each([["NotFoundError", "找不到麥克風"], ["NotReadableError", "麥克風無法啟動"], ["AbortError", "麥克風無法啟動"]])("%s displays actionable Chinese and retries the same round", async (name, title) => {
        navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error("Requested device not found"), { name, code: 8 }));
        const onExit = jest.fn();
        render(<AlphabetAutomaticRecorder {...props} challengeSessionId="same-session" onExit={onExit} />);
        expect(await screen.findByRole("alert")).toHaveTextContent(title);
        expect(screen.queryByText(/Requested device/)).not.toBeInTheDocument();
        expect(screen.queryByText("麥克風已暫停")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "返回練習" }));
        expect(onExit).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "重新檢查" }));
        await waitFor(() => expect(recorders).toHaveLength(1));
        await speak();
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledWith(expect.objectContaining({ questionId: 1, foundationRoundId: props.foundationRoundId, challengeSessionId: "same-session" }));
    });
    it("a disconnected microphone discards partial audio and resumes the current question", async () => {
        await mount();
        await frame(100); await frame(1000, 0.2); await frame(1016, 0.2); await frame(1032, 0.2);
        const stream = await navigator.mediaDevices.getUserMedia.mock.results[0].value;
        act(() => stream.getTracks()[0].onended());
        expect(screen.getByRole("alert")).toHaveTextContent("錄音中斷了");
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
        expect(callbacks.onRoundInvalid).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "重新錄製" }));
        await waitFor(() => expect(recorders).toHaveLength(2));
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
        expect(callbacks.onScored).not.toHaveBeenCalled();
    });

});
