import React, { useContext, useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiMic, FiRefreshCw, FiSend, FiVolume2 } from "react-icons/fi";
import { submitSpeakingPronunciationAttempt } from "../../services/pronunciationCoachService";
import { retainLocalSpeakingRecognizer } from "../../services/localSpeakingRecognizer";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import { playSpeakingFeedbackSound, prepareSpeakingFeedbackSound } from "../../utils/speakingFeedbackSound";
import "./css/SpeakingPronunciationRecorder.scss";
import { SpeakingActivityContext } from "./SpeakingAdventureSession";
import { speakingRecordingSeconds, SPEAKING_BUDGET_ERROR_CODES } from "../../utils/speakingRecordingPolicy";

const recordingMimeType = () => {
    if (!window.MediaRecorder?.isTypeSupported) return "";
    return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
        .find(type => window.MediaRecorder.isTypeSupported(type)) || "";
};

const scoreLabel = score => score >= 80 ? "表現良好" : score >= 60 ? "再練一次會更好" : "先聽示範，再慢慢重讀";
const scoreTone = score => score >= 80 ? "good" : score >= 60 ? "practice" : "retry";
const ROUND_RESET_ERROR_CODES = new Set([
    "foundation_round_invalid",
    "foundation_round_required",
    "foundation_round_expired",
    "foundation_round_not_open"
]);

export default function SpeakingPronunciationRecorder({
    firebaseUser,
    question,
    interactionType = "",
    foundationRoundId = "",
    challengeSessionId = "",
    challengeMode = "easy",
    disabledReason = "",
    onScored,
    onRoundInvalid,
    onPracticeOnly,
    practiceOnly = false,
    onPhaseChange,
    onRetry,
    onListenAgain,
    audioWorking = false
}) {
    const maxRecordingSeconds = speakingRecordingSeconds(interactionType || question.interaction_type);
    const [recording, setRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [elapsed, setElapsed] = useState(0);
    const [preparing, setPreparing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [budgetBlocked, setBudgetBlocked] = useState(false);
    const [voiceDetected, setVoiceDetected] = useState(false);
    const [engineReady, setEngineReady] = useState(false);
    const [engineInfo, setEngineInfo] = useState("首次需下載語音模型，建議使用 Wi-Fi。");
    const [waitingSeconds, setWaitingSeconds] = useState(0);
    const engineRef = useRef(null);
    const generationRef = useRef(0);
    const previewRef = useRef("");
    const transcriptionRef = useRef(null);
    useEffect(() => {
        if (practiceOnly) { setEngineReady(true); setEngineInfo("錄音回聽練習，不送出評分。"); return undefined; }
        const lease = retainLocalSpeakingRecognizer(); engineRef.current = lease.recognizer;
        setEngineReady(lease.recognizer.ready);
        if (lease.recognizer.ready) setEngineInfo(lease.recognizer.mode);
        return lease.release;
    }, [practiceOnly]);
    useEffect(() => {
        if (!submitting || result) return undefined;
        setWaitingSeconds(0);
        const started = Date.now();
        const timer = setInterval(() => setWaitingSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
        return () => clearInterval(timer);
    }, [submitting, result]);
    const setSessionBusy = useContext(SpeakingActivityContext);
    useEffect(() => {
        setSessionBusy?.(recording || preparing || submitting);
        return () => setSessionBusy?.(false);
    }, [recording, preparing, submitting, setSessionBusy]);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const stopTimerRef = useRef(null);
    const elapsedTimerRef = useRef(null);
    const analyserRef = useRef(null);
    const audioContextRef = useRef(null);
    const activityFrameRef = useRef(null);

    const release = () => {
        window.clearTimeout(stopTimerRef.current);
        window.clearInterval(elapsedTimerRef.current);
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (activityFrameRef.current) window.cancelAnimationFrame(activityFrameRef.current);
        activityFrameRef.current = null;
        audioContextRef.current?.close?.();
        audioContextRef.current = null;
        analyserRef.current = null;
    };
    const reset = () => {
        generationRef.current++;
        if (recorderRef.current?.state === "recording") { recorderRef.current.onstop = null; recorderRef.current.stop(); }
        release();
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = "";
        transcriptionRef.current = null;
        setPreviewUrl(""); setRecordedBlob(null); setResult(null); setError(""); setBudgetBlocked(false); setElapsed(0); setRecording(false); setPreparing(false); setSubmitting(false); setVoiceDetected(false);
    };
    useEffect(() => () => release(), []);
    useEffect(() => reset, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const stop = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };
    const prepareEngine = async () => {
        const token = generationRef.current;
        setPreparing(true); setError("");
        try {
            await engineRef.current.prepare(info => { if (token === generationRef.current) setEngineInfo(info); });
            if (token === generationRef.current) setEngineReady(true);
        } catch (cause) {
            if (token === generationRef.current) { setEngineReady(false); setError(cause.message); }
        } finally { if (token === generationRef.current) setPreparing(false); }
    };
    const start = async () => {
        if (!practiceOnly && !engineRef.current?.ready) return prepareEngine();
        reset();
        const token = generationRef.current;
        onRetry?.();
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setError("這個瀏覽器不支援錄音，請使用新版 Chrome 或 Safari");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            if (token !== generationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
            streamRef.current = stream; chunksRef.current = [];
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const context = new AudioContext();
                const analyser = context.createAnalyser();
                analyser.fftSize = 512;
                context.createMediaStreamSource(stream).connect(analyser);
                audioContextRef.current = context; analyserRef.current = analyser;
                const values = new Uint8Array(analyser.fftSize);
                const observe = () => {
                    analyser.getByteTimeDomainData(values);
                    const volume = values.reduce((sum, value) => sum + Math.abs(value - 128), 0) / values.length;
                    if (volume > 5) setVoiceDetected(true);
                    activityFrameRef.current = window.requestAnimationFrame(observe);
                };
                observe();
            } catch { /* 音量動畫不影響錄音與評分。 */ }
            const type = recordingMimeType();
            const recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
            recorderRef.current = recorder;
            recorder.ondataavailable = event => { if (event.data?.size) chunksRef.current.push(event.data); };
            recorder.onerror = () => setError("錄音發生問題，請重新允許麥克風後再試一次");
            recorder.onstop = async () => {
                if (token !== generationRef.current) return;
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                release(); setRecording(false);
                if (blob.size < 1000) return setError("沒有收到清楚的錄音，請靠近麥克風再試一次");
                setPreparing(true);
                try {
                    // 回聽與送評使用同一份 16 kHz PCM WAV，避免原始錄音正常、轉檔後卻無聲。
                    const wav = practiceOnly ? blob : await convertAudioBlobToWav(blob, 16000, { maxSeconds: maxRecordingSeconds });
                    if (token !== generationRef.current) return;
                    previewRef.current = URL.createObjectURL(wav);
                    setRecordedBlob(wav); setPreviewUrl(previewRef.current);
                } catch (cause) {
                    setError(cause?.message || "錄音轉換失敗，請重新錄音後再試一次");
                } finally {
                    if (token === generationRef.current) setPreparing(false);
                }
            };
            recorder.start(250); setRecording(true); setElapsed(0);
            elapsedTimerRef.current = window.setInterval(() => setElapsed(current => Math.min(maxRecordingSeconds, current + 1)), 1000);
            stopTimerRef.current = window.setTimeout(stop, maxRecordingSeconds * 1000);
        } catch (cause) {
            if (token !== generationRef.current) return;
            release(); setRecording(false);
            setError(cause?.name === "NotAllowedError" ? "請允許麥克風權限，才能練習發音" : "目前無法啟動麥克風，請確認瀏覽器設定後再試一次");
        }
    };
    const submit = async () => {
        if (practiceOnly || !recordedBlob || submitting || budgetBlocked) return;
        prepareSpeakingFeedbackSound();
        setSubmitting(true); setError(""); setResult(null);
        const token = generationRef.current;
        try {
            const transcription = transcriptionRef.current || await engineRef.current.transcribe(recordedBlob, maxRecordingSeconds);
            if (token !== generationRef.current) return;
            transcriptionRef.current = transcription;
            const score = await submitSpeakingPronunciationAttempt({ firebaseUser, questionId: question.id, ...transcription, foundationRoundId, challengeSessionId, challengeMode });
            if (token !== generationRef.current) return;
            if (score?.assessment_kind !== "local_completeness_v1" || typeof score?.answer_match !== "boolean" || !Number.isFinite(score?.scores?.completeness) || score.scores.completeness < 0 || score.scores.completeness > 100) {
                throw new Error("assessment_response_incomplete");
            }
            setResult(score);
            // Keep the result visible before parent flows advance the question.
            await new Promise(resolve => setTimeout(resolve, 4000));
            if (token !== generationRef.current) return;
            const saved = score?.assessment_status === "uncertain" ? false : await onScored?.(score);
            if (token !== generationRef.current) return;
            playSpeakingFeedbackSound(
                score?.assessment_status === "uncertain"
                    ? "practice"
                    : score?.answer_match === false
                    ? "retry"
                    : saved === false ? "practice"
                    : scoreTone(Math.round(score?.scores?.completeness || 0))
            );
        } catch (cause) {
            if (token !== generationRef.current) return;
            if (cause?.code === "speaking_level_completed_today") { onPracticeOnly?.(cause.message); return; }
            setResult(null);
            setEngineReady(Boolean(engineRef.current?.ready));
            const limited = SPEAKING_BUDGET_ERROR_CODES.has(cause?.code);
            setBudgetBlocked(limited);
            setError(limited || ROUND_RESET_ERROR_CODES.has(String(cause?.code || "")) || cause?.code === "foundation_round_busy"
                ? cause.message : cause?.code?.startsWith("local_") || ["audio_too_quiet", "speech_no_match", "MEMORY", "ENGINE", "DOWNLOAD"].includes(cause?.code)
                    ? cause.message : "朗讀結果暫時無法完成。錄音仍保留，請重試評分。");
            if (ROUND_RESET_ERROR_CODES.has(String(cause?.code || ""))) onRoundInvalid?.(cause);
        }
        finally { if (token === generationRef.current) setSubmitting(false); }
    };

    const pronunciationScore = Math.round(result?.scores?.completeness || 0);
    const assessmentUncertain = result?.assessment_status === "uncertain";
    const answerMatched = !assessmentUncertain && result?.answer_match !== false;
    const resultTone = assessmentUncertain ? "practice" : answerMatched ? scoreTone(pronunciationScore) : "retry";
    const accessibleDisabledReason = /\d+\s*秒後播放提示音/.test(disabledReason)
        ? "三秒後播放提示音。"
        : disabledReason;
    const remainingSeconds = Math.max(0, maxRecordingSeconds - elapsed);
    const recordingState = submitting ? "assessing" : preparing ? "preparing" : recording ? "recording" : error ? "retry" : recordedBlob ? "ready" : "idle";
    const learningPhase = submitting ? "assessing" : preparing ? "preparing" : recording ? "recording" : result ? "feedback" : recordedBlob ? "review" : "ready";
    useEffect(() => { onPhaseChange?.(learningPhase); }, [learningPhase, onPhaseChange]);

    return <section aria-busy={preparing || submitting} className={`speaking-pronunciation is-${recordingState} ${voiceDetected ? "has-voice" : ""}`}>
        <p className="speaking-local-mode">{engineInfo}</p>
        {!practiceOnly && !engineReady && <button type="button" onClick={prepareEngine} disabled={preparing || submitting}>{preparing ? "正在準備語音辨識…" : "準備語音辨識"}</button>}
        {submitting && !result && <p role="timer">正在辨識與儲存，已等待 {waitingSeconds} 秒</p>}
        {!result && <p className="speaking-recording-status" role="status" aria-live="polite" aria-atomic="true">{submitting ? "正在評分，請稍候，不需要重新錄音。" : preparing ? "正在準備評分音檔。" : recording ? `錄音進行中，每次最長 ${maxRecordingSeconds} 秒。` : error ? "這次還沒完成，請依下方提示再試一次。" : recordedBlob ? practiceOnly ? "錄音完成，可以播放回聽。" : "錄音完成，可以回聽或送出評分。" : accessibleDisabledReason || "可以開始錄音。"}</p>}
        {!result && <>
            <div className="speaking-recording-heading">
                <strong>{submitting ? "正在聽你的回答…" : recording ? (voiceDetected ? "聽到你的聲音了" : "麥克風已啟用，直接開口說") : preparing ? "正在準備評分音檔…" : recordedBlob ? "錄音完成，先聽聽看送評的聲音" : practiceOnly ? "啟用麥克風錄音練習" : "啟用麥克風開始挑戰"}</strong>
                <span>{submitting ? "請稍候，完成後會顯示練習結果。" : recording ? `最長 ${maxRecordingSeconds} 秒，說完後按完成錄音。` : preparing ? "請稍候，不需要重新錄音。" : recordedBlob ? practiceOnly ? "聽聽自己的聲音，想再練可以重新錄音。" : "確認清楚後，再交給 AI 評分。" : `每次最長 ${maxRecordingSeconds} 秒；本題會立刻開始收音。`}</span>
            </div>
            {recording && <div className="speaking-recording-countdown" role="timer" aria-label={`錄音剩餘 ${remainingSeconds} 秒`}><strong>{remainingSeconds}</strong><span>秒</span></div>}
            {disabledReason && !recordedBlob && <p className="speaking-pronunciation-notice">{disabledReason}</p>}
            {!recordedBlob && <button
                type="button"
                className="speaking-pronunciation-mic"
                onClick={recording ? stop : start}
                disabled={!engineReady || preparing || Boolean(disabledReason)}
                aria-label={recording ? "完成錄音" : "開始錄音"}
            >
                {recording ? <FiSend aria-hidden="true" /> : <FiMic aria-hidden="true" />}
                <span>{recording ? "完成錄音" : preparing ? "準備中…" : "啟用麥克風"}</span>
            </button>}
            {previewUrl && <div className="speaking-recording-preview"><audio controls src={previewUrl}>你的瀏覽器不支援錄音播放。</audio><div><button type="button" className="secondary" onClick={start} disabled={submitting}><FiRefreshCw />重新錄音</button>{!practiceOnly && <button type="button" onClick={submit} disabled={submitting || budgetBlocked}><FiSend />{submitting ? "AI 評分中…" : error ? "重試評分" : "送出評分"}</button>}</div></div>}
            <small className="speaking-recording-privacy">{practiceOnly ? "錄音只留在這個頁面供回聽，不上傳、不評分，也不增加通關或獎勵。" : "錄音在這台裝置辨識，只傳送辨識文字供核對及儲存。分數是朗讀完整度，不是發音準確度。"}</small>
        </>}
        {result && <div className={`speaking-pronunciation-result is-${resultTone}`} role="status" aria-live="polite" aria-atomic="true">
            <header>{answerMatched ? <FiCheckCircle aria-hidden="true" /> : <FiAlertCircle aria-hidden="true" />}<span>本次練習結果</span><strong>{answerMatched ? scoreLabel(pronunciationScore) : assessmentUncertain ? "系統沒有聽清楚" : "回答方式還差一點"}</strong></header>
            <p className="speaking-completeness-score"><span>朗讀完整度</span><strong>{pronunciationScore} 分</strong></p>
            {assessmentUncertain && <p className="speaking-pronunciation-feedback"><span>{result.feedback || "這次沒有聽清楚，不算你答錯，請再試一次。"}</span></p>}
            <div className="speaking-result-actions">
                {onListenAgain && <button type="button" className="secondary" onClick={onListenAgain} disabled={audioWorking || submitting}><FiVolume2 aria-hidden="true" />{audioWorking ? "示範播放中…" : "再聽示範"}</button>}
                <button type="button" className="secondary" onClick={() => { reset(); onRetry?.(); }} disabled={submitting}><FiRefreshCw />再練一次</button>
            </div>
        </div>}
        {error && <div className="speaking-pronunciation-error" role="alert"><strong>本次練習尚未完成</strong><p>{error}</p></div>}
    </section>;
}
