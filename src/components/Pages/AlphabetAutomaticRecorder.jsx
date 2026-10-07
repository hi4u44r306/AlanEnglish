import React, { useEffect, useRef, useState } from "react";
import { FiLoader, FiMic, FiMicOff, FiRefreshCw } from "react-icons/fi";
import { submitAlphabetPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import { SPEAKING_BUDGET_ERROR_CODES } from "../../utils/speakingRecordingPolicy";

const CALIBRATION_MS = 450;
const NO_SPEECH_RETRY_MS = 8000;
const TRAILING_SILENCE_MS = 900;
const MAX_UTTERANCE_MS = 12000;
const PRE_SPEECH_MS = 250;
const MIN_BLOB_BYTES = 800;
const ROUND_RESET_ERROR_CODES = new Set([
    "foundation_round_invalid",
    "foundation_round_required",
    "foundation_round_expired",
    "foundation_round_not_open"
]);

const recordingMimeType = () => {
    if (!window.MediaRecorder?.isTypeSupported) return "";
    return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
        .find(type => window.MediaRecorder.isTypeSupported(type)) || "";
};

export const rmsLevel = samples => {
    if (!samples?.length) return 0;
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
};

export default function AlphabetAutomaticRecorder({
    firebaseUser,
    question,
    foundationRoundId,
    challengeSessionId,
    allowDemoAssessment = false,
    paused = false,
    onStatusChange,
    onScored,
    onRoundInvalid
}) {
    const [status, setStatus] = useState("preparing");
    const [error, setError] = useState("");
    const [budgetBlocked, setBudgetBlocked] = useState(false);
    const [sessionVersion, setSessionVersion] = useState(0);
    const [attemptVersion, setAttemptVersion] = useState(0);
    const [remainingSeconds, setRemainingSeconds] = useState(MAX_UTTERANCE_MS / 1000);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const engineInfo = "A–Z 字母評分";
    const [readingScore, setReadingScore] = useState(null);
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const operationRef = useRef(0);
    const mountedRef = useRef(true);
    const pendingAttemptRef = useRef(null);
    const retrySubmissionRef = useRef(null);
    const submittingRef = useRef(false);
    const onScoredRef = useRef(onScored);
    const onRoundInvalidRef = useRef(onRoundInvalid);

    useEffect(() => { onScoredRef.current = onScored; }, [onScored]);
    useEffect(() => { onRoundInvalidRef.current = onRoundInvalid; }, [onRoundInvalid]);
    useEffect(() => { onStatusChange?.(status); }, [onStatusChange, status]);

    useEffect(() => {
        if (!recordedBlob) { setPreviewUrl(""); return undefined; }
        const url = URL.createObjectURL(recordedBlob);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [recordedBlob]);

    const cancelDetection = () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
    };

    const stopRecorder = () => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        recorderRef.current = null;
    };

    const release = () => {
        operationRef.current += 1;
        cancelDetection();
        stopRecorder();
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        analyserRef.current = null;
        audioContextRef.current?.close?.().catch(() => undefined);
        audioContextRef.current = null;
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            release();
            pendingAttemptRef.current = null;
            retrySubmissionRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const stopWhenHidden = () => {
            if (document.visibilityState !== "hidden") return;
            release();
            pendingAttemptRef.current = null;
            retrySubmissionRef.current = null;
            setRecordedBlob(null);
            setStatus("blocked");
            setError("為了保護錄音隱私，切換到其他頁面後已關閉麥克風；請回到列表再開始一次");
        };
        document.addEventListener("visibilitychange", stopWhenHidden);
        return () => document.removeEventListener("visibilitychange", stopWhenHidden);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let cancelled = false;
        const prepare = async () => {
            if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
                setStatus("blocked");
                setError("這個瀏覽器不支援自動收音，請改用新版 Chrome 或 Safari");
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                });
                if (cancelled) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) throw new Error("audio_context_unavailable");
                const context = new AudioContextClass();
                await context.resume?.();
                if (cancelled) {
                    stream.getTracks().forEach(track => track.stop());
                    await context.close().catch(() => undefined);
                    return;
                }
                const analyser = context.createAnalyser();
                analyser.fftSize = 1024;
                context.createMediaStreamSource(stream).connect(analyser);
                streamRef.current = stream;
                audioContextRef.current = context;
                analyserRef.current = analyser;
                setStatus("listening");
                setSessionVersion(version => version + 1);
            } catch (cause) {
                if (cancelled) return;
                setStatus("blocked");
                setError(cause?.name === "NotAllowedError"
                    ? "請允許麥克風權限，才能開始 A–Z 挑戰"
                    : cause?.code ? cause.message : "目前無法啟動麥克風，請確認瀏覽器設定後再試一次");
            }
        };
        prepare();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        operationRef.current += 1;
        const operationId = operationRef.current;
        cancelDetection();
        if (recorderRef.current?.state === "recording") {
            recorderRef.current.onstop = null;
            recorderRef.current.stop();
        }
        recorderRef.current = null;
        chunksRef.current = [];
        pendingAttemptRef.current = null;
        retrySubmissionRef.current = null;
        submittingRef.current = false;
        setRecordedBlob(null);
        setReadingScore(null);
        setBudgetBlocked(false);

        if (paused || !question?.id || (!foundationRoundId && !allowDemoAssessment) || !analyserRef.current || !streamRef.current) return undefined;
        setError("");
        setStatus("preparing");
        const analyser = analyserRef.current;
        const samples = new Float32Array(analyser.fftSize);
        const calibrationStartedAt = performance.now();
        let bufferStartedAt = calibrationStartedAt;
        let noiseTotal = 0;
        let noiseSamples = 0;
        let speechFrames = 0;
        let speechStartedAt = 0;
        let lastVoiceAt = 0;
        let recorder = null;

        const submitRecording = async () => {
            const attempt = pendingAttemptRef.current;
            if (!attempt || submittingRef.current || operationId !== operationRef.current || !mountedRef.current) return;
            const { blob } = attempt;
            if (blob.size < MIN_BLOB_BYTES) {
                setError("沒有聽清楚，再靠近一點說一次");
                setStatus("listening");
                setAttemptVersion(version => version + 1);
                return;
            }
            submittingRef.current = true;
            setError("");
            setStatus("submitting");
            try {
                const wav = attempt.wav || await convertAudioBlobToWav(blob, 16000, { startSeconds: attempt.startSeconds, maxSeconds: 12 });
                if (operationId !== operationRef.current) return;
                attempt.wav = wav;
                setRecordedBlob(wav);
                const result = await submitAlphabetPronunciationAttempt({
                    firebaseUser,
                    questionId: question.id,
                    audio: wav,
                    foundationRoundId,
                    challengeSessionId
                });
                if (operationId !== operationRef.current) return;
                if (result?.assessment_kind !== "azure_pronunciation" || !Number.isFinite(result?.scores?.pronunciation) || result.scores.pronunciation < 0 || result.scores.pronunciation > 100 || typeof result?.answer_match !== "boolean") throw new Error("字母評分結果不完整，請重試。");
                setReadingScore(Math.round(result.scores.pronunciation));
                await new Promise(resolve => setTimeout(resolve, 4000));
                if (operationId !== operationRef.current) return;
                onScoredRef.current?.(result);
                pendingAttemptRef.current = null;
                setRecordedBlob(null);
            } catch (cause) {
                if (operationId !== operationRef.current) return;
                setError(cause?.message || "評分暫時無法完成，錄音已保留，請重試評分。");
                setBudgetBlocked(SPEAKING_BUDGET_ERROR_CODES.has(cause?.code));
                if (ROUND_RESET_ERROR_CODES.has(String(cause?.code || ""))) {
                    pendingAttemptRef.current = null;
                    setRecordedBlob(null);
                    setStatus("blocked");
                    onRoundInvalidRef.current?.(cause);
                    return;
                }
                // 不自動重送不確定是否已到達後端的請求，避免重複寫入。
                setStatus("retry");
            } finally {
                if (operationId === operationRef.current) submittingRef.current = false;
            }
        };
        retrySubmissionRef.current = submitRecording;

        const finishUtterance = () => {
            cancelDetection();
            if (recorder?.state === "recording") recorder.stop();
        };

        const startBuffer = () => {
            chunksRef.current = [];
            const type = recordingMimeType();
            recorder = type ? new MediaRecorder(streamRef.current, { mimeType: type }) : new MediaRecorder(streamRef.current);
            recorderRef.current = recorder;
            recorder.ondataavailable = event => {
                if (operationId === operationRef.current && mountedRef.current && event.data?.size) chunksRef.current.push(event.data);
            };
            recorder.onerror = () => {
                if (operationId !== operationRef.current || !mountedRef.current) return;
                cancelDetection();
                recorder.onstop = null;
                if (recorder.state === "recording") recorder.stop();
                setStatus("blocked");
                setError("自動收音發生問題，請回到列表後再進入一次");
            };
            recorder.onstop = () => {
                if (operationId !== operationRef.current || !mountedRef.current) return;
                recorderRef.current = null;
                if (!speechStartedAt) {
                    // 等待中的環境音不送評；定期重新建立容器，限制本機暫存大小。
                    setAttemptVersion(version => version + 1);
                    return;
                }
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                pendingAttemptRef.current = {
                    blob,
                    wav: null,
                    startSeconds: Math.max(0, (speechStartedAt - bufferStartedAt - PRE_SPEECH_MS) / 1000)
                };
                setRecordedBlob(blob);
                submitRecording();
            };
            bufferStartedAt = performance.now();
            recorder.start(100);
        };

        const startSpeech = now => {
            speechStartedAt = now;
            lastVoiceAt = now;
            setError("");
            setStatus("recording");
            setRemainingSeconds(MAX_UTTERANCE_MS / 1000);
        };

        const detect = now => {
            if (operationId !== operationRef.current || paused) return;
            analyser.getFloatTimeDomainData(samples);
            const level = rmsLevel(samples);
            if (now - calibrationStartedAt < CALIBRATION_MS) {
                noiseTotal += level;
                noiseSamples += 1;
            } else {
                if (!speechStartedAt) setStatus("listening");
                const noiseFloor = noiseSamples ? noiseTotal / noiseSamples : 0;
                const startThreshold = Math.max(0.025, noiseFloor * 3.2);
                const continueThreshold = Math.max(0.015, startThreshold * 0.58);
                if (!speechStartedAt) {
                    speechFrames = level >= startThreshold ? speechFrames + 1 : 0;
                    if (speechFrames >= 3) startSpeech(now);
                    else if (now - calibrationStartedAt > NO_SPEECH_RETRY_MS) {
                        setError("還沒聽到聲音，看到字母後直接唸出來就可以了");
                        finishUtterance();
                        return;
                    }
                } else if (recorder.state === "recording") {
                    const elapsed = now - speechStartedAt + PRE_SPEECH_MS;
                    const nextRemaining = Math.max(0, Math.ceil((MAX_UTTERANCE_MS - elapsed) / 1000));
                    setRemainingSeconds(current => current === nextRemaining ? current : nextRemaining);
                    if (level >= continueThreshold) lastVoiceAt = now;
                    if ((now - lastVoiceAt >= TRAILING_SILENCE_MS && now - speechStartedAt >= 300)
                        || elapsed >= MAX_UTTERANCE_MS - 100) {
                        finishUtterance();
                        return;
                    }
                }
            }
            animationRef.current = requestAnimationFrame(detect);
        };
        // 聲音偵測前已開始本機緩衝，保留字母開頭；送評前才裁掉等待空白。
        try { startBuffer(); } catch {
            setStatus("blocked");
            setError("自動收音發生問題，請確認麥克風後再試一次");
            return undefined;
        }
        animationRef.current = requestAnimationFrame(detect);
        return () => {
            cancelDetection();
            if (recorder?.state === "recording") {
                recorder.onstop = null;
                recorder.stop();
            }
            if (recorderRef.current === recorder) recorderRef.current = null;
        };
    }, [allowDemoAssessment, attemptVersion, challengeSessionId, firebaseUser, foundationRoundId, paused, question?.id, sessionVersion]);

    const copy = readingScore !== null ? ["朗讀結果已完成", "看完成績後，系統會繼續下一步。"] : status === "preparing"
        ? ["正在開啟麥克風…", "只要允許一次，這一輪會自動收音。"]
        : status === "recording"
            ? ["正在聽你說", "說完後停一下，系統會自動送出。"]
        : status === "submitting"
                ? ["正在評分…", "不用按任何按鈕，下一題會自動出現。"]
                : status === "retry"
                    ? ["錄音已保留", "先回聽，或直接重試評分，不需要離開關卡。"]
                : status === "blocked"
                    ? ["麥克風沒有開啟", "請確認瀏覽器的麥克風權限。"]
                    : ["麥克風已開啟", "看到字母後直接唸，不會播放答案提示。"];

    return <section className={`speaking-alphabet-auto is-${status}`} aria-live="polite" aria-atomic="true">
        <p>{engineInfo}</p>
        {readingScore !== null && <p className="speaking-completeness-score">字母發音 <strong>{readingScore} 分</strong></p>}
        <span className="speaking-alphabet-auto__icon" aria-hidden="true">
            {status === "submitting" || status === "preparing" ? <FiLoader /> : status === "blocked" ? <FiMicOff /> : <FiMic />}
        </span>
        <div><strong>{copy[0]}</strong><span>{copy[1]}</span></div>
        {status === "recording" && <strong className="speaking-alphabet-auto__countdown" role="timer" aria-label={`錄音剩餘 ${remainingSeconds} 秒`}>還能錄 {remainingSeconds} 秒</strong>}
        <small>等待中的環境音不會送評；字母錄音送交 Azure 本次評分，網站不儲存錄音。離開關卡時會關閉麥克風。</small>
        {status === "retry" && pendingAttemptRef.current && <div className="speaking-alphabet-auto__retry">
            {previewUrl && <audio aria-label="回聽這次字母錄音" controls src={previewUrl} />}
            <button type="button" disabled={budgetBlocked} onClick={() => retrySubmissionRef.current?.()}><FiRefreshCw aria-hidden="true" />重試評分</button>
            <button type="button" disabled={budgetBlocked} onClick={() => setAttemptVersion(version => version + 1)}>重新錄音</button>
        </div>}
        {error && <p role="alert">{error}</p>}
    </section>;
}
