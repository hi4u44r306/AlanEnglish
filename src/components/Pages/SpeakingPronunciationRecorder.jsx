import React, { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiMic, FiRefreshCw, FiSend, FiSquare } from "react-icons/fi";
import { submitSpeakingPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import "./css/SpeakingPronunciationRecorder.scss";

const MAX_RECORDING_SECONDS = 20;

const recordingMimeType = () => {
    if (!window.MediaRecorder?.isTypeSupported) return "";
    return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
        .find(type => window.MediaRecorder.isTypeSupported(type)) || "";
};

const scoreLabel = score => score >= 80 ? "表現良好" : score >= 60 ? "再練一次會更好" : "先聽示範，再慢慢重讀";
const scoreTone = score => score >= 80 ? "good" : score >= 60 ? "practice" : "retry";

export default function SpeakingPronunciationRecorder({ firebaseUser, question, slotValues = {}, disabledReason = "", onScored }) {
    const [recording, setRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [elapsed, setElapsed] = useState(0);
    const [preparing, setPreparing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const stopTimerRef = useRef(null);
    const elapsedTimerRef = useRef(null);

    const release = () => {
        window.clearTimeout(stopTimerRef.current);
        window.clearInterval(elapsedTimerRef.current);
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };
    const reset = () => {
        release();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(""); setRecordedBlob(null); setResult(null); setError(""); setElapsed(0); setRecording(false); setPreparing(false);
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
        setSubmitting(true); setError("");
        try {
            const score = await submitSpeakingPronunciationAttempt({ firebaseUser, questionId: question.id, slotValues, audio: recordedBlob });
            setResult(score); onScored?.(score);
        } catch (cause) { setError(cause?.message || "發音評分失敗，請稍後再試"); }
        finally { setSubmitting(false); }
    };

    const pronunciationScore = Math.round(result?.scores?.pronunciation || 0);

    return <section className={`speaking-pronunciation ${recording ? "is-recording" : ""}`} aria-live="polite">
        {!result && <>
            <div className="speaking-recording-heading">
                <strong>{recording ? "正在聽你朗讀…" : preparing ? "正在準備評分音檔…" : recordedBlob ? "錄音完成，先聽聽看送評的聲音" : "輪到你開口說"}</strong>
                <span>{recording ? `${elapsed} / ${MAX_RECORDING_SECONDS} 秒` : preparing ? "請稍候，不需要重新錄音。" : recordedBlob ? "確認清楚後，再交給 AI 評分。" : "按下麥克風，慢慢說完整句子。"}</span>
            </div>
            {disabledReason && !recordedBlob && <p className="speaking-pronunciation-notice">{disabledReason}</p>}
            {!recordedBlob && <button
                type="button"
                className="speaking-pronunciation-mic"
                onClick={recording ? stop : start}
                disabled={preparing || Boolean(disabledReason)}
                aria-label={recording ? "完成錄音" : "開始錄音"}
            >
                {recording ? <FiSquare aria-hidden="true" /> : <FiMic aria-hidden="true" />}
                <span>{recording ? "完成錄音" : preparing ? "準備中…" : "開始錄音"}</span>
            </button>}
            {previewUrl && <div className="speaking-recording-preview"><audio controls src={previewUrl}>你的瀏覽器不支援錄音播放。</audio><div><button type="button" className="secondary" onClick={start}><FiRefreshCw />重新錄音</button><button type="button" onClick={submit} disabled={submitting}><FiSend />{submitting ? "AI 評分中…" : "送出評分"}</button></div></div>}
            <small className="speaking-recording-privacy">錄音只在這台裝置暫存，送出後用於本次發音評分。</small>
        </>}
        {result && <div className={`speaking-pronunciation-result is-${scoreTone(pronunciationScore)}`}>
            <header><FiCheckCircle aria-hidden="true" /><span>本次整體表現</span><strong>{pronunciationScore} 分</strong><small>{scoreLabel(pronunciationScore)}</small></header>
            {(result.words || []).length > 0 && <div className="speaking-pronunciation-words" aria-label="逐字發音結果">{result.words.map((word, index) => <span key={`${word.text}-${index}`} className={`word-${word.status}`}>{word.text}<small>{Math.round(word.score)}</small></span>)}</div>}
            <p className="speaking-pronunciation-feedback"><strong>下一次這樣說會更好</strong><span>{result.feedback}</span></p>
            <details className="speaking-pronunciation-details"><summary>查看詳細分析</summary><div className="speaking-pronunciation-scores"><span>清楚度 <b>{Math.round(result.scores?.accuracy || 0)}</b></span><span>流暢度 <b>{Math.round(result.scores?.fluency || 0)}</b></span><span>完整度 <b>{Math.round(result.scores?.completeness || 0)}</b></span><span>語調 <b>{Math.round(result.scores?.prosody || 0)}</b></span></div></details>
            <button type="button" className="secondary" onClick={reset}><FiRefreshCw />再練一次</button>
        </div>}
        {error && <p className="speaking-pronunciation-error" role="alert">{error}</p>}
    </section>;
}
