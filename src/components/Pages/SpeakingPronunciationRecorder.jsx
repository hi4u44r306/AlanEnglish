import React, { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiMic, FiRefreshCw, FiSend, FiSquare } from "react-icons/fi";
import { submitSpeakingPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import { playSpeakingFeedbackSound, prepareSpeakingFeedbackSound } from "../../utils/speakingFeedbackSound";
import "./css/SpeakingPronunciationRecorder.scss";

const MAX_RECORDING_SECONDS = 20;

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
    foundationRoundId = "",
    disabledReason = "",
    onScored,
    onRoundInvalid
}) {
    const [recording, setRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [elapsed, setElapsed] = useState(0);
    const [preparing, setPreparing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [voiceDetected, setVoiceDetected] = useState(false);
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
        release();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(""); setRecordedBlob(null); setResult(null); setError(""); setElapsed(0); setRecording(false); setPreparing(false); setVoiceDetected(false);
    };
    useEffect(() => () => release(), []);
    useEffect(() => reset, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const stop = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };
    const start = async () => {
        reset();
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setError("這個瀏覽器不支援錄音，請使用新版 Chrome 或 Safari");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
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
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                release(); setRecording(false);
                if (blob.size < 1000) return setError("沒有收到清楚的錄音，請靠近麥克風再試一次");
                setPreparing(true);
                try {
                    // 回聽與送評使用同一份 16 kHz PCM WAV，避免原始錄音正常、轉檔後卻無聲。
                    const wav = await convertAudioBlobToWav(blob);
                    setRecordedBlob(wav); setPreviewUrl(URL.createObjectURL(wav));
                } catch (cause) {
                    setError(cause?.message || "錄音轉換失敗，請重新錄音後再試一次");
                } finally {
                    setPreparing(false);
                }
            };
            recorder.start(250); setRecording(true); setElapsed(0);
            elapsedTimerRef.current = window.setInterval(() => setElapsed(current => Math.min(MAX_RECORDING_SECONDS, current + 1)), 1000);
            stopTimerRef.current = window.setTimeout(stop, MAX_RECORDING_SECONDS * 1000);
        } catch (cause) {
            release(); setRecording(false);
            setError(cause?.name === "NotAllowedError" ? "請允許麥克風權限，才能練習發音" : "目前無法啟動麥克風，請確認瀏覽器設定後再試一次");
        }
    };
    const submit = async () => {
        if (!recordedBlob || submitting) return;
        prepareSpeakingFeedbackSound();
        setSubmitting(true); setError("");
        try {
            const score = await submitSpeakingPronunciationAttempt({ firebaseUser, questionId: question.id, audio: recordedBlob, foundationRoundId });
            setResult(score);
            playSpeakingFeedbackSound(
                score?.assessment_status === "uncertain"
                    ? "practice"
                    : score?.answer_match === false
                    ? "retry"
                    : scoreTone(Math.round(score?.scores?.pronunciation || 0))
            );
            onScored?.(score);
        } catch (cause) {
            setError(cause?.message || "發音評分失敗，請稍後再試");
            if (ROUND_RESET_ERROR_CODES.has(String(cause?.code || ""))) onRoundInvalid?.(cause);
        }
        finally { setSubmitting(false); }
    };

    const pronunciationScore = Math.round(result?.scores?.pronunciation || 0);
    const answerMatched = result?.answer_match !== false;
    const assessmentUncertain = result?.assessment_status === "uncertain";
    const resultTone = answerMatched ? scoreTone(pronunciationScore) : "retry";
    const accessibleDisabledReason = /\d+\s*秒後播放提示音/.test(disabledReason)
        ? "三秒後播放提示音。"
        : disabledReason;

    return <section className={`speaking-pronunciation ${recording ? "is-recording" : ""} ${voiceDetected ? "has-voice" : ""}`}>
        {!result && <p className="speaking-sr-only" role="status" aria-live="polite" aria-atomic="true">{recording ? "錄音進行中。" : preparing ? "正在準備評分音檔。" : recordedBlob ? "錄音完成，可以回聽或送出評分。" : accessibleDisabledReason || "可以開始錄音。"}</p>}
        {!result && <>
            <div className="speaking-recording-heading">
                <strong>{recording ? (voiceDetected ? "聽到你的聲音了" : "麥克風已啟用，直接開口說") : preparing ? "正在準備評分音檔…" : recordedBlob ? "錄音完成，先聽聽看送評的聲音" : "啟用麥克風開始挑戰"}</strong>
                <span>{recording ? `${elapsed} / ${MAX_RECORDING_SECONDS} 秒，說完後按送出。` : preparing ? "請稍候，不需要重新錄音。" : recordedBlob ? "確認清楚後，再交給 AI 評分。" : "只需啟用一次；本題會立刻開始收音。"}</span>
            </div>
            {disabledReason && !recordedBlob && <p className="speaking-pronunciation-notice">{disabledReason}</p>}
            {!recordedBlob && <button
                type="button"
                className="speaking-pronunciation-mic"
                onClick={recording ? stop : start}
                disabled={preparing || Boolean(disabledReason)}
                aria-label={recording ? "完成錄音" : "開始錄音"}
            >
                {recording ? <FiSend aria-hidden="true" /> : <FiMic aria-hidden="true" />}
                <span>{recording ? (voiceDetected ? "送出並評分" : "我已說完，送出") : preparing ? "準備中…" : "啟用麥克風"}</span>
            </button>}
            {previewUrl && <div className="speaking-recording-preview"><audio controls src={previewUrl}>你的瀏覽器不支援錄音播放。</audio><div><button type="button" className="secondary" onClick={start}><FiRefreshCw />重新錄音</button><button type="button" onClick={submit} disabled={submitting}><FiSend />{submitting ? "AI 評分中…" : "送出評分"}</button></div></div>}
            <small className="speaking-recording-privacy">錄音只在這台裝置暫存，送出後用於本次發音評分。</small>
        </>}
        {result && <div className={`speaking-pronunciation-result is-${resultTone}`} role="status" aria-live="polite" aria-atomic="true">
            <header>{answerMatched ? <FiCheckCircle aria-hidden="true" /> : <FiAlertCircle aria-hidden="true" />}<span>本次練習結果</span><strong>{answerMatched ? scoreLabel(pronunciationScore) : assessmentUncertain ? "系統沒有聽清楚" : "回答方式還差一點"}</strong></header>
            {result.recognized_text && <p className="speaking-recognized-answer"><strong>我聽到</strong><span>{result.recognized_text}</span></p>}
            <div className="speaking-pronunciation-legend" aria-label="發音顏色說明"><span className="word-good">綠色：很清楚</span><span className="word-practice">黃色：再練一下</span><span className="word-retry">紅色：慢慢重念</span></div>
            {(result.words || []).length > 0 && <div className="speaking-pronunciation-words" aria-label="逐字發音結果">{result.words.map((word, index) => <span key={`${word.text}-${index}`} className={`word-${word.status}`}>{word.text}</span>)}</div>}
            <p className="speaking-pronunciation-feedback"><strong>下一次這樣說會更好</strong><span>{result.feedback}</span></p>
            <button type="button" className="secondary" onClick={reset}><FiRefreshCw />再練一次</button>
        </div>}
        {error && <p className="speaking-pronunciation-error" role="alert">{error}</p>}
    </section>;
}
