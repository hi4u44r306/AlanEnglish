import React from "react";
import { cleanup, act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingPronunciationRecorder from "./SpeakingPronunciationRecorder";
import { SpeakingActivityContext } from "./SpeakingAdventureSession";
import { submitSpeakingPronunciationAttempt, submitAlphabetPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import { playSpeakingFeedbackSound, prepareSpeakingFeedbackSound } from "../../utils/speakingFeedbackSound";
import { retainLocalSpeakingRecognizer } from "../../services/localSpeakingRecognizer";

jest.mock("../../services/localSpeakingRecognizer", () => ({ retainLocalSpeakingRecognizer: jest.fn(() => ({ recognizer: { ready: true, mode: "相容加速模式", prepare: jest.fn().mockResolvedValue(), transcribe: jest.fn().mockResolvedValue({recognizedText:"My name is Amy.",audioSeconds:2}) }, release: jest.fn() })) }));

jest.mock("../../services/pronunciationCoachService", () => ({
    submitSpeakingPronunciationAttempt: jest.fn(), submitAlphabetPronunciationAttempt: jest.fn()
}));
jest.mock("../../utils/audioWav", () => ({
    convertAudioBlobToWav: jest.fn()
}));
jest.mock("../../utils/speakingFeedbackSound", () => ({
    playSpeakingFeedbackSound: jest.fn(), prepareSpeakingFeedbackSound: jest.fn()
}));

describe("SpeakingPronunciationRecorder", () => {
    it("70 分結果抵達立即開始保存，保存尚未完成時仍鎖住送評", async () => {
        global.setTimeout = originalTimeout;
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], {type:"audio/wav"}));
        submitSpeakingPronunciationAttempt.mockResolvedValue({assessment_kind:"local_completeness_v1",answer_match:true,scores:{completeness:70}});
        let saved;
        const onScored=jest.fn(()=>new Promise(resolve=>{saved=resolve;}));
        render(<SpeakingPronunciationRecorder question={{id:9}} onScored={onScored} />);
        fireEvent.click(screen.getByRole("button",{name:"開始錄音"}));
        fireEvent.click(await screen.findByRole("button",{name:"先停止並回聽"}));
        fireEvent.click(await screen.findByRole("button",{name:"送出評分"}));
        await waitFor(()=>expect(onScored).toHaveBeenCalledTimes(1));
        expect(screen.getByText("70 分")).toBeInTheDocument();
        expect(screen.getByRole("button",{name:"再練一次"})).toBeDisabled();
        await act(async()=>saved(true));
        expect(screen.getByRole("button",{name:"再練一次"})).toBeEnabled();
    });
    it("拼字使用 Azure，顯示實際發音分數且不準備本機模型",async()=>{
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)],{type:"audio/wav"}));
        submitAlphabetPronunciationAttempt.mockResolvedValue({assessment_kind:"azure_pronunciation",answer_match:true,scores:{pronunciation:78,completeness:100}});
        const onScored=jest.fn().mockResolvedValue(true);
        render(<SpeakingPronunciationRecorder question={{id:9}} interactionType="letter_spelling" challengeMode="challenge" onScored={onScored} />);
        fireEvent.click(screen.getByRole("button",{name:"開始錄音"}));
        fireEvent.click(await screen.findByRole("button",{name:"先停止並回聽"}));
        fireEvent.click(await screen.findByRole("button",{name:"送出評分"}));
        await waitFor(()=>expect(onScored).toHaveBeenCalledTimes(1));
        expect(screen.getByText("78 分")).toBeInTheDocument();
        expect(submitAlphabetPronunciationAttempt).toHaveBeenCalledWith(expect.objectContaining({challengeMode:"challenge",audio:expect.any(Blob)}));
        expect(retainLocalSpeakingRecognizer).not.toHaveBeenCalled();
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
    });
    it("未就緒時自動接續準備，不要求按準備按鈕，也不開啟麥克風", async () => {
        let complete;
        const prepare = jest.fn(() => new Promise(resolve => { complete = resolve; }));
        retainLocalSpeakingRecognizer.mockReturnValueOnce({recognizer:{ready:false,prepare},release:jest.fn()});
        render(<SpeakingPronunciationRecorder question={{id:9}} />);
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("button",{name:"準備語音辨識"})).not.toBeInTheDocument();
        expect(screen.getByRole("button",{name:"開始錄音"})).toBeDisabled();
        expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
        await act(async () => { complete(); });
        expect(screen.getByRole("button",{name:"開始錄音"})).toBeEnabled();
    });
    it("背景準備失敗才提供重新準備，重試成功恢復麥克風按鈕", async () => {
        const prepare=jest.fn().mockRejectedValueOnce(new Error("模型載入失敗")).mockResolvedValueOnce();
        retainLocalSpeakingRecognizer.mockReturnValueOnce({recognizer:{ready:false,prepare},release:jest.fn()});
        render(<SpeakingPronunciationRecorder question={{id:9}} />);
        const retry = await screen.findByRole("button",{name:"重新準備語音辨識"});
        fireEvent.click(retry);
        await waitFor(() => expect(screen.getByRole("button",{name:"開始錄音"})).toBeEnabled());
        expect(prepare).toHaveBeenCalledTimes(2);
        expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });
    const originalTimeout = global.setTimeout;
    const originalMediaRecorder = window.MediaRecorder;
    const originalMediaDevices = navigator.mediaDevices;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    it("回聽練習可錄音但不準備模型、不轉 WAV、不送評、不通關", async () => {
        const onScored=jest.fn();
        render(<SpeakingPronunciationRecorder question={{id:9}} practiceOnly onScored={onScored} />);
        expect(screen.queryByRole('button',{name:'準備語音辨識'})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button',{name:'開始錄音'}));
        await waitFor(()=>expect(screen.getByRole('button',{name:'完成錄音'})).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button',{name:'完成錄音'}));
        await waitFor(()=>expect(screen.getByRole('button',{name:'重新錄音'})).toBeInTheDocument());
        expect(screen.queryByRole('button',{name:'送出評分'})).not.toBeInTheDocument();
        expect(convertAudioBlobToWav).not.toHaveBeenCalled();
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        expect(onScored).not.toHaveBeenCalled();
    });

    beforeEach(() => {
        retainLocalSpeakingRecognizer.mockImplementation(() => ({recognizer:{ready:true,mode:"相容加速模式",prepare:jest.fn().mockResolvedValue(),transcribe:jest.fn().mockResolvedValue({recognizedText:"My name is Amy.",audioSeconds:2})},release:jest.fn()}));
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
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));
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
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));
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
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));
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
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));

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
        expect(screen.queryByText("我聽到")).not.toBeInTheDocument();
        expect(screen.queryByText("My name is Amy.")).not.toBeInTheDocument();
        expect(screen.getByText("88 分")).toBeInTheDocument();
        expect(screen.queryByText("90")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("逐字朗讀結果")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("朗讀比對說明")).not.toBeInTheDocument();
        expect(screen.queryByText("句尾再放慢一點。")).not.toBeInTheDocument();
        expect(screen.queryByText("這次先練這幾個字")).not.toBeInTheDocument();
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
            expect(screen.getByRole("button", { name: "先停止並回聽" })).toBeEnabled();
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
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));
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
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));
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
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));
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

    it("分數抵達就通知外層儲存，不等待四秒、不顯示百分比", async () => {
        global.setTimeout = originalTimeout;
        jest.useFakeTimers();
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockResolvedValue({ assessment_kind: "local_completeness_v1", answer_match: true, scores: { completeness: 85 } });
        const onScored = jest.fn();
        render(<SpeakingPronunciationRecorder question={{id:9}} onScored={onScored} />);
        await act(async () => fireEvent.click(screen.getByRole("button", {name:/開始錄音/})));
        await act(async () => fireEvent.click(screen.getByRole("button", {name:"先停止並回聽"})));
        await act(async () => fireEvent.click(screen.getByRole("button", {name:/送出評分/})));
        expect(screen.getByText("85 分")).toBeInTheDocument();
        expect(screen.queryByText("85%")).not.toBeInTheDocument();
        expect(onScored).toHaveBeenCalledTimes(1);
    });

    it.each(["standard_sentence", "letter_spelling"])("%s 按完成並評分只送出一次，保留同一份 WAV 回聽與原回合參數", async interactionType => {
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        convertAudioBlobToWav.mockResolvedValue(wav);
        const azure = interactionType === "letter_spelling";
        const service = azure ? submitAlphabetPronunciationAttempt : submitSpeakingPronunciationAttempt;
        service.mockResolvedValue({ assessment_kind: azure ? "azure_pronunciation" : "local_completeness_v1", answer_match: true, scores: { completeness: 88, pronunciation: 88 } });
        const onScored = jest.fn().mockResolvedValue(true);
        const firebaseUser = { uid: "finish-assess-student" };
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} firebaseUser={firebaseUser} interactionType={interactionType} foundationRoundId="round-1" challengeSessionId="session-1" challengeMode="challenge" onScored={onScored} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        await waitFor(() => expect(onScored).toHaveBeenCalledTimes(1));
        expect(service).toHaveBeenCalledTimes(1);
        expect(service).toHaveBeenCalledWith(expect.objectContaining({ firebaseUser, questionId: 9, foundationRoundId: "round-1", challengeSessionId: "session-1", challengeMode: "challenge" }));
        if (azure) expect(service).toHaveBeenCalledWith(expect.objectContaining({ audio: wav }));
        else expect(retainLocalSpeakingRecognizer.mock.results[0].value.recognizer.transcribe).toHaveBeenCalledWith(wav, 25);
        expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1);
        expect(screen.getByText("88 分")).toBeInTheDocument();
        expect(document.querySelector("details.speaking-result-replay")).not.toHaveAttribute("open");
        expect(screen.getByLabelText("回聽我的錄音")).toHaveAttribute("src", "blob:scoring-wav");
        expect(URL.createObjectURL).toHaveBeenCalledWith(wav);
    });

    it("等待停止事件及 WAV 完成才送評，快速連按也只停止及送出一次", async () => {
        let finishRecording, finishConversion, finishScore;
        const stopSpy = jest.spyOn(window.MediaRecorder.prototype, "stop").mockImplementation(function () {
            this.state = "inactive";
            finishRecording = () => {
                this.ondataavailable?.({ data: new Blob([new Uint8Array(1500)]) });
                this.onstop?.();
            };
        });
        convertAudioBlobToWav.mockImplementation(() => new Promise(resolve => { finishConversion = resolve; }));
        submitSpeakingPronunciationAttempt.mockImplementation(() => new Promise(resolve => { finishScore = resolve; }));
        const onScored = jest.fn();
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} onScored={onScored} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        const finish = await screen.findByRole("button", { name: "完成並評分" });
        act(() => { fireEvent.click(finish); fireEvent.click(finish); });
        expect(stopSpy).toHaveBeenCalledTimes(1);
        expect(finish).toBeDisabled();
        expect(convertAudioBlobToWav).not.toHaveBeenCalled();
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        await act(async () => finishRecording());
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "開始錄音" })).toBeDisabled();
        await act(async () => finishConversion(new Blob([new Uint8Array(1600)], { type: "audio/wav" })));
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "AI 評分中…" }));
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
        await act(async () => finishScore({ assessment_kind: "local_completeness_v1", answer_match: true, scores: { completeness: 85 } }));
        expect(onScored).toHaveBeenCalledTimes(1);
    });

    it("主要操作技術失敗保留音檔與辨識結果，只在手動重試時重新送出", async () => {
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({ assessment_kind: "local_completeness_v1", answer_match: true, scores: { completeness: 85 } });
        const onScored = jest.fn();
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} onScored={onScored} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("錄音仍保留");
        expect(screen.getByLabelText("回聽我的錄音")).toHaveAttribute("src", "blob:scoring-wav");
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
        expect(onScored).not.toHaveBeenCalled();
        expect(playSpeakingFeedbackSound).not.toHaveBeenCalled();
        const retry = screen.getByRole("button", { name: "重試評分" });
        act(() => { fireEvent.click(retry); fireEvent.click(retry); });
        await waitFor(() => expect(onScored).toHaveBeenCalledTimes(1));
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(2);
        expect(retainLocalSpeakingRecognizer.mock.results[0].value.recognizer.transcribe).toHaveBeenCalledTimes(1);
        expect(convertAudioBlobToWav).toHaveBeenCalledTimes(1);
    });

    it("主要操作遇到額度不足仍可回聽，沒有通關或自動重試", async () => {
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockRejectedValue(Object.assign(new Error("本月的語音評分時間已用完"), { code: "student_audio_budget_exhausted" }));
        const onScored = jest.fn();
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} onScored={onScored} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("本月的語音評分時間已用完");
        fireEvent.click(screen.getByRole("button", { name: "重試評分" }));
        expect(screen.getByRole("button", { name: "重試評分" })).toBeDisabled();
        expect(screen.getByLabelText("回聽我的錄音")).toHaveAttribute("src", "blob:scoring-wav");
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
        expect(onScored).not.toHaveBeenCalled();
    });

    it("轉檔失敗不送出，重新錄音選回聽不會沿用上次送評意圖", async () => {
        convertAudioBlobToWav.mockRejectedValueOnce(new Error("轉檔失敗")).mockResolvedValueOnce(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("轉檔失敗");
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));
        await screen.findByRole("button", { name: "送出評分" });
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
    });

    it("空音檔不轉檔或送評，錄音控制可重新開始", async () => {
        jest.spyOn(window.MediaRecorder.prototype, "stop").mockImplementation(function () { this.state = "inactive"; this.onstop?.(); });
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("沒有收到清楚的錄音");
        expect(screen.getByRole("button", { name: "開始錄音" })).toBeEnabled();
        expect(convertAudioBlobToWav).not.toHaveBeenCalled();
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
    });

    it("回饋音效初始化失敗仍解除送評鎖，保留錄音供手動重試", async () => {
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        prepareSpeakingFeedbackSound.mockImplementationOnce(() => { throw new Error("AudioContext unavailable"); });
        submitSpeakingPronunciationAttempt.mockResolvedValue({ assessment_kind: "local_completeness_v1", answer_match: true, scores: { completeness: 85 } });
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("錄音仍保留");
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "重試評分" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "重試評分" }));
        expect(await screen.findByText("85 分")).toBeInTheDocument();
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
    });

    it("錄音器中斷不會送出不完整音檔，讓學生重新錄製", async () => {
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        jest.spyOn(window.MediaRecorder.prototype, "stop").mockImplementation(function () {
            this.state = "inactive"; this.onerror?.();
            this.ondataavailable?.({ data: new Blob([new Uint8Array(1500)]) }); this.onstop?.();
        });
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("錄音中斷了");
        expect(screen.queryByLabelText("回聽我的錄音")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "重新錄製" })).toBeEnabled();
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
    });

    it("停止例外解除操作鎖，可以再停止回聽，不直接送評", async () => {
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        jest.spyOn(window.MediaRecorder.prototype, "stop").mockImplementationOnce(() => { throw new Error("stop failed"); });
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        expect(screen.getByRole("alert")).toHaveTextContent("請再按一次停止並回聽");
        expect(screen.getByRole("button", { name: "先停止並回聽" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "先停止並回聽" }));
        await screen.findByLabelText("回聽我的錄音");
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
    });

    it.each(["question", "session", "account", "practice", "unmount"])("轉檔期間變更 %s 取消舊錄音的送評與預覽", async change => {
        let converted;
        convertAudioBlobToWav.mockImplementation(() => new Promise(resolve => { converted = resolve; }));
        const props = { question: { id: 9 }, firebaseUser: { uid: "old-user" }, challengeSessionId: "old-session" };
        const { rerender, unmount } = render(<SpeakingPronunciationRecorder {...props} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        await waitFor(() => expect(converted).toBeDefined());
        if (change === "unmount") unmount();
        else rerender(<SpeakingPronunciationRecorder {...props} {...({ question: { question: { id: 10 } }, session: { challengeSessionId: "new-session" }, account: { firebaseUser: { uid: "new-user" } }, practice: { practiceOnly: true } }[change])} />);
        await act(async () => converted(new Blob([new Uint8Array(1600)], { type: "audio/wav" })));
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        expect(submitAlphabetPronunciationAttempt).not.toHaveBeenCalled();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("換題後舊錄音的延遲音訊片段不能混入新錄音", async () => {
        const recorders = [];
        jest.spyOn(window.MediaRecorder.prototype, "start").mockImplementation(function () { this.state = "recording"; recorders.push(this); });
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        const { rerender } = render(<SpeakingPronunciationRecorder question={{ id: 9 }} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        await screen.findByRole("button", { name: "完成並評分" });
        rerender(<SpeakingPronunciationRecorder question={{ id: 10 }} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        await screen.findByRole("button", { name: "完成並評分" });
        act(() => recorders[0].ondataavailable({ data: new Blob([new Uint8Array(9000)]) }));
        fireEvent.click(screen.getByRole("button", { name: "先停止並回聽" }));
        await screen.findByRole("button", { name: "送出評分" });
        expect(convertAudioBlobToWav.mock.calls[0][0].size).toBe(1500);
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
    });

    it.each(["conversion", "transcription"])("%s 期間新增停用原因時取消送評，保留 WAV 供回聽", async stage => {
        let releaseWork;
        const wav = new Blob([new Uint8Array(1600)], { type: "audio/wav" });
        const work = new Promise(resolve => { releaseWork = resolve; });
        convertAudioBlobToWav.mockReturnValue(stage === "conversion" ? work : Promise.resolve(wav));
        const transcribe = jest.fn().mockReturnValue(stage === "transcription" ? work : Promise.resolve({ recognizedText: "My name is Amy.", audioSeconds: 2 }));
        retainLocalSpeakingRecognizer.mockReturnValueOnce({ recognizer: { ready: true, transcribe }, release: jest.fn() });
        const props = { question: { id: 9 } };
        const { rerender } = render(<SpeakingPronunciationRecorder {...props} />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        await waitFor(() => expect(stage === "conversion" ? convertAudioBlobToWav : transcribe).toHaveBeenCalledTimes(1));
        rerender(<SpeakingPronunciationRecorder {...props} disabledReason="目前不能送出" />);
        await act(async () => releaseWork(stage === "conversion" ? wav : { recognizedText: "My name is Amy.", audioSeconds: 2 }));
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "送出評分" })).toBeDisabled();
        expect(screen.getByLabelText("回聽我的錄音")).toHaveAttribute("src", "blob:scoring-wav");
        expect(screen.getByText("目前不能送出")).toBeInTheDocument();
    });

    it("主要操作評分後保存未完成時保持忙碌，不讓重新錄音破壞回呼", async () => {
        let finishSave;
        convertAudioBlobToWav.mockResolvedValue(new Blob([new Uint8Array(1600)], { type: "audio/wav" }));
        submitSpeakingPronunciationAttempt.mockResolvedValue({ assessment_kind: "local_completeness_v1", answer_match: true, scores: { completeness: 85 } });
        const onScored = jest.fn(() => new Promise(resolve => { finishSave = resolve; }));
        const busy = jest.fn();
        render(<SpeakingActivityContext.Provider value={busy}><SpeakingPronunciationRecorder question={{ id: 9 }} onScored={onScored} /></SpeakingActivityContext.Provider>);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        fireEvent.click(await screen.findByRole("button", { name: "完成並評分" }));
        await waitFor(() => expect(onScored).toHaveBeenCalledTimes(1));
        expect(screen.getByRole("button", { name: "再練一次" })).toBeDisabled();
        expect(busy).toHaveBeenLastCalledWith(true);
        await act(async () => finishSave(true));
        expect(screen.getByRole("button", { name: "再練一次" })).toBeEnabled();
        expect(busy).toHaveBeenLastCalledWith(false);
        expect(submitSpeakingPronunciationAttempt).toHaveBeenCalledTimes(1);
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
        fireEvent.click(await screen.findByRole("button", { name: "先停止並回聽" }));
        fireEvent.click(await screen.findByRole("button", { name: /送出評分/ }));

        expect(await screen.findByRole("alert")).toHaveTextContent("這一題正在評分");
        expect(onRoundInvalid).not.toHaveBeenCalled();
    });
    it.each([["NotFoundError", "找不到麥克風"], ["NotAllowedError", "尚未允許使用麥克風"], ["NotReadableError", "麥克風無法啟動"]])("manual recording explains %s and really reacquires a microphone", async (name, title) => {
        navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error("Requested device not found"), { name }));
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} practiceOnly />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(title);
        expect(screen.queryByText(/Requested device/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "重新檢查" }));
        await screen.findByRole("button", { name: "完成錄音" });
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
    });
    it("device disconnect unlocks manual recording and does not submit the interrupted answer", async () => {
        render(<SpeakingPronunciationRecorder question={{ id: 9 }} practiceOnly />);
        fireEvent.click(screen.getByRole("button", { name: "開始錄音" }));
        await screen.findByRole("button", { name: "完成錄音" });
        const stream = await navigator.mediaDevices.getUserMedia.mock.results[0].value;
        act(() => stream.getTracks()[0].onended());
        expect(screen.getByRole("alert")).toHaveTextContent("錄音中斷了");
        fireEvent.click(screen.getByRole("button", { name: "重新錄製" }));
        await screen.findByRole("button", { name: "完成錄音" });
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
        expect(submitSpeakingPronunciationAttempt).not.toHaveBeenCalled();
    });

});
