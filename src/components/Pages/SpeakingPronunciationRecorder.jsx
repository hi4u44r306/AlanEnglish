import React, { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiLoader, FiMic, FiRefreshCw, FiSend, FiSquare } from "react-icons/fi";
import { submitSpeakingPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import { playSpeakingFeedbackSound, prepareSpeakingFeedbackSound } from "../../utils/speakingFeedbackSound";
import SpeakingRecordingPlayer from "./SpeakingRecordingPlayer";
import "./css/SpeakingPronunciationRecorder.scss";

const MAX_RECORDING_SECONDS = 20;

const recordingMimeType = () => {
    if (!window.MediaRecorder?.isTypeSupported) return "";
    return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
        .find(type => window.MediaRecorder.isTypeSupported(type)) || "";
};

const scoreLabel = score => score >= 80 ? "表現良好" : score >= 60 ? "再練一次會更好" : "先聽示範，再慢慢重讀";
const scoreTone = score => score >= 80 ? "good" : score >= 60 ? "practice" : "retry";

export default function SpeakingPronunciationRecorder({ firebaseUser, question, disabledReason = "", onScored, onBusyChange, autoStartToken = 0, countdownSeconds = 5, onReplayQuestion }) {
    const [recording, setRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [elapsed, setElapsed] = useState(0);
    const [preparing, setPreparing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [countdown, setCountdown] = useState(null);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const stopTimerRef = useRef(null);
    const elapsedTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserFrameRef = useRef(null);

    const stopVoiceDetection = () => {
        window.cancelAnimationFrame(analyserFrameRef.current);
        analyserFrameRef.current = null;
        audioContextRef.current?.close?.().catch(() => {});
        audioContextRef.current = null;
    };

    const release = () => {
        window.clearTimeout(stopTimerRef.current);
        window.clearInterval(elapsedTimerRef.current);
        stopVoiceDetection();
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };
    const reset = () => {
        release();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        window.clearInterval(countdownTimerRef.current);
        setPreviewUrl(""); setRecordedBlob(null); setResult(null); setError(""); setElapsed(0); setRecording(false); setPreparing(false); setCountdown(null);
    };
    useEffect(() => () => release(), []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => reset, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { onBusyChange?.(preparing || submitting); }, [onBusyChange, preparing, submitting]);
    useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

    const stop = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };
    const watchForFinishedSpeech = stream => {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        try {
            const context = new AudioContextClass();
            const analyser = context.createAnalyser();
            analyser.fftSize = 512;
            context.createMediaStreamSource(stream).connect(analyser);
            audioContextRef.current = context;
            const samples = new Uint8Array(analyser.fftSize);
            const startedAt = Date.now();
            let speechStarted = false;
            let lastSpeechAt = startedAt;
            const inspect = () => {
                if (recorderRef.current?.state !== "recording") return;
                analyser.getByteTimeDomainData(samples);
                let energy = 0;
                for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
                const rms = Math.sqrt(energy / samples.length);
                const now = Date.now();
                if (rms >= 0.035) { speechStarted = true; lastSpeechAt = now; }
                if (speechStarted && now - lastSpeechAt >= 1400 && now - startedAt >= 1200) stop();
                else analyserFrameRef.current = window.requestAnimationFrame(inspect);
            };
            analyserFrameRef.current = window.requestAnimationFrame(inspect);
        } catch { /* 不支援即保留手動停止與最長時間限制。 */ }
    };
    const start = async () => {
        reset();
        prepareSpeakingFeedbackSound();
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
                    setPreparing(false);
                    await submit(wav);
                } catch (cause) {
                    setError(cause?.message || "錄音轉換失敗，請重新錄音後再試一次");
                } finally {
                    setPreparing(false);
                }
            };
            recorder.start(250); setRecording(true); setElapsed(0);
            watchForFinishedSpeech(stream);
            elapsedTimerRef.current = window.setInterval(() => setElapsed(current => Math.min(MAX_RECORDING_SECONDS, current + 1)), 1000);
            stopTimerRef.current = window.setTimeout(stop, MAX_RECORDING_SECONDS * 1000);
        } catch (cause) {
            release(); setRecording(false);
            setError(cause?.name === "NotAllowedError" ? "請允許麥克風權限，才能練習發音" : "目前無法啟動麥克風，請確認瀏覽器設定後再試一次");
        }
    };
    const submit = async (audio = recordedBlob) => {
        if (!audio || submitting) return;
        prepareSpeakingFeedbackSound();
        setSubmitting(true); setError("");
        try {
            const score = await submitSpeakingPronunciationAttempt({ firebaseUser, questionId: question.id, audio });
            setResult(score);
            playSpeakingFeedbackSound(
                score?.answer_match === false
                    ? "retry"
                    : scoreTone(Math.round(score?.scores?.pronunciation || 0))
            );
            onScored?.(score);
        } catch (cause) { setError(cause?.message || "發音評分失敗，請稍後再試"); }
        finally { setSubmitting(false); }
    };

    useEffect(() => {
        if (!autoStartToken) return undefined;
        reset();
        let remaining = Math.max(1, Number(countdownSeconds) || 5);
        setCountdown(remaining);
        countdownTimerRef.current = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                window.clearInterval(countdownTimerRef.current);
                setCountdown(null);
                start();
            } else setCountdown(remaining);
        }, 1000);
        return () => window.clearInterval(countdownTimerRef.current);
    }, [autoStartToken]); // eslint-disable-line react-hooks/exhaustive-deps

    const startNow = () => {
        window.clearInterval(countdownTimerRef.current);
        setCountdown(null);
        start();
    };
    const replayQuestion = () => {
        window.clearInterval(countdownTimerRef.current);
        setCountdown(null);
        onReplayQuestion?.();
    };

    const pronunciationScore = Math.round(result?.scores?.pronunciation || 0);
    const answerMatched = result?.answer_match !== false;
    const resultTone = answerMatched ? scoreTone(pronunciationScore) : "retry";
    const busy = preparing || submitting;

    return <section className={`speaking-pronunciation ${recording ? "is-recording" : ""} ${busy ? "is-busy" : ""}`} aria-live="polite" aria-busy={busy}>
        {!result && <>
            {countdown !== null && <div className="speaking-recording-countdown" role="status">
                <strong>{countdown}</strong><span>想一下，準備回答</span>
                <div><button type="button" onClick={replayQuestion}><FiRefreshCw />再聽一次</button><button type="button" onClick={startNow}><FiMic />我準備好了</button></div>
            </div>}
            {busy ? <div className="speaking-scoring-status" role="status" aria-label="AI 發音評分進行中">
                <FiLoader aria-hidden="true" />
                <div><strong>{preparing ? "正在整理你的錄音…" : "AI 正在聽你的發音…"}</strong><span>通常需要 3～8 秒，請不要離開頁面。</span></div>
            </div> : <div className="speaking-recording-heading">
                <strong>{recording ? "正在聽你回答…" : recordedBlob ? "已錄下你的回答" : countdown !== null ? "問題問完了" : "輪到你開口說"}</strong>
                <span>{recording ? `${elapsed} / ${MAX_RECORDING_SECONDS} 秒；說完停一下就會自動送出。` : recordedBlob ? "如果送評失敗，可以重試或重新錄音。" : countdown !== null ? "倒數結束會自動開啟麥克風。" : "也可以直接按下麥克風開始回答。"}</span>
            </div>}
            {disabledReason && !recordedBlob && <p className="speaking-pronunciation-notice">{disabledReason}</p>}
            {!recordedBlob && countdown === null && <button
                type="button"
                className="speaking-pronunciation-mic"
                onClick={recording ? stop : start}
                disabled={preparing || Boolean(disabledReason)}
                aria-label={recording ? "完成錄音" : "開始錄音"}
            >
                {recording ? <FiSquare aria-hidden="true" /> : <FiMic aria-hidden="true" />}
                <span>{recording ? "完成錄音" : preparing ? "準備中…" : "開始錄音"}</span>
            </button>}
            {previewUrl && !busy && <div className="speaking-recording-preview"><SpeakingRecordingPlayer src={previewUrl} label="聽聽我的回答" />{!result && <div><button type="button" className="secondary" onClick={start}><FiRefreshCw />重新錄音</button>{error && <button type="button" onClick={() => submit()}><FiSend />重新送出評分</button>}</div>}</div>}
            <small className="speaking-recording-privacy">送出後會把錄音私人保存到你的口說學習歷程；每題最多保留最新與最佳錄音，也可以自行刪除。</small>
        </>}
        {result && <div className={`speaking-pronunciation-result is-${resultTone}`}>
            <header>{answerMatched ? <FiCheckCircle aria-hidden="true" /> : <FiAlertCircle aria-hidden="true" />}<span>本次練習結果</span><strong>{answerMatched ? scoreLabel(pronunciationScore) : "回答方式還差一點"}</strong></header>
            {result.recognized_text && <p className="speaking-recognized-answer"><strong>我聽到</strong><span>{result.recognized_text}</span></p>}
            <div className="speaking-pronunciation-legend" aria-label="發音顏色說明"><span className="word-good">綠色：很清楚</span><span className="word-practice">黃色：再練一下</span><span className="word-retry">紅色：慢慢重念</span></div>
            {(result.words || []).length > 0 && <div className="speaking-pronunciation-words" aria-label="逐字發音結果">{result.words.map((word, index) => <span key={`${word.text}-${index}`} className={`word-${word.status}`}>{word.text}</span>)}</div>}
            <p className="speaking-pronunciation-feedback"><strong>下一次這樣說會更好</strong><span>{result.feedback}</span></p>
            {result.recording_saved && <p className="speaking-recording-saved"><FiCheckCircle aria-hidden="true" />錄音已存入我的口說學習歷程</p>}
            {result.recording_saved === false && <p className="speaking-pronunciation-notice">分數已保存，但這次錄音暫時無法存入學習歷程。</p>}
            {previewUrl && <SpeakingRecordingPlayer src={previewUrl} label="聽聽我的回答" />}
            <button type="button" className="secondary" onClick={reset}><FiRefreshCw />再練一次</button>
        </div>}
        {error && <p className="speaking-pronunciation-error" role="alert">{error}</p>}
    </section>;
}
