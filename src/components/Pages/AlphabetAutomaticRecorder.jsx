import React, { useEffect, useRef, useState } from "react";
import { FiLoader, FiMic, FiMicOff } from "react-icons/fi";
import { submitSpeakingPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";

const CALIBRATION_MS = 450;
const NO_SPEECH_RETRY_MS = 8000;
const TRAILING_SILENCE_MS = 900;
const MAX_UTTERANCE_MS = 6000;
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
    paused = false,
    onStatusChange,
    onScored,
    onRoundInvalid
}) {
    const [status, setStatus] = useState("preparing");
    const [error, setError] = useState("");
    const [sessionVersion, setSessionVersion] = useState(0);
    const [attemptVersion, setAttemptVersion] = useState(0);
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const operationRef = useRef(0);
    const mountedRef = useRef(true);
    const onScoredRef = useRef(onScored);
    const onRoundInvalidRef = useRef(onRoundInvalid);

    useEffect(() => { onScoredRef.current = onScored; }, [onScored]);
    useEffect(() => { onRoundInvalidRef.current = onRoundInvalid; }, [onRoundInvalid]);
    useEffect(() => { onStatusChange?.(status); }, [onStatusChange, status]);

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
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const stopWhenHidden = () => {
            if (document.visibilityState !== "hidden") return;
            release();
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
                    : "目前無法啟動麥克風，請確認瀏覽器設定後再試一次");
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

        if (paused || !question?.id || !foundationRoundId || !analyserRef.current || !streamRef.current) return undefined;
        setError("");
        setStatus("listening");
        const analyser = analyserRef.current;
        const samples = new Float32Array(analyser.fftSize);
        const calibrationStartedAt = performance.now();
        let noiseTotal = 0;
        let noiseSamples = 0;
        let speechFrames = 0;
        let speechStartedAt = 0;
        let lastVoiceAt = 0;
        let recorder = null;

        const submitRecording = async blob => {
            if (operationId !== operationRef.current || !mountedRef.current) return;
            if (blob.size < MIN_BLOB_BYTES) {
                setError("沒有聽清楚，再靠近一點說一次");
                setStatus("listening");
                setAttemptVersion(version => version + 1);
                return;
            }
            setStatus("submitting");
            try {
                const wav = await convertAudioBlobToWav(blob);
                if (operationId !== operationRef.current) return;
                const result = await submitSpeakingPronunciationAttempt({
                    firebaseUser,
                    questionId: question.id,
                    audio: wav,
                    foundationRoundId
                });
                if (operationId !== operationRef.current) return;
                onScoredRef.current?.(result);
            } catch (cause) {
                if (operationId !== operationRef.current) return;
                setError(cause?.message || "發音評分失敗，請回到列表後再進入一次");
                if (ROUND_RESET_ERROR_CODES.has(String(cause?.code || ""))) {
                    onRoundInvalidRef.current?.(cause);
                    return;
                }
                // 不自動重送不確定是否已到達後端的請求，避免重複產生 Azure 評分費用。
                setStatus("blocked");
            }
        };

        const finishUtterance = () => {
            cancelDetection();
            if (recorder?.state === "recording") recorder.stop();
        };

        const startRecorder = now => {
            chunksRef.current = [];
            const type = recordingMimeType();
            recorder = type ? new MediaRecorder(streamRef.current, { mimeType: type }) : new MediaRecorder(streamRef.current);
            recorderRef.current = recorder;
            recorder.ondataavailable = event => { if (event.data?.size) chunksRef.current.push(event.data); };
            recorder.onerror = () => {
                cancelDetection();
                setStatus("blocked");
                setError("自動收音發生問題，請回到列表後再進入一次");
            };
            recorder.onstop = () => {
                recorderRef.current = null;
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                submitRecording(blob);
            };
            recorder.start(100);
            speechStartedAt = now;
            lastVoiceAt = now;
            setError("");
            setStatus("recording");
        };

        const detect = now => {
            if (operationId !== operationRef.current || paused) return;
            analyser.getFloatTimeDomainData(samples);
            const level = rmsLevel(samples);
            if (now - calibrationStartedAt < CALIBRATION_MS) {
                noiseTotal += level;
                noiseSamples += 1;
            } else {
                const noiseFloor = noiseSamples ? noiseTotal / noiseSamples : 0;
                const startThreshold = Math.max(0.025, noiseFloor * 3.2);
                const continueThreshold = Math.max(0.015, startThreshold * 0.58);
                if (!recorder) {
                    speechFrames = level >= startThreshold ? speechFrames + 1 : 0;
                    if (speechFrames >= 3) startRecorder(now);
                    else if (now - calibrationStartedAt > NO_SPEECH_RETRY_MS) {
                        setError("還沒聽到聲音，看到字母後直接唸出來就可以了");
                    }
                } else if (recorder.state === "recording") {
                    if (level >= continueThreshold) lastVoiceAt = now;
                    if ((now - lastVoiceAt >= TRAILING_SILENCE_MS && now - speechStartedAt >= 300)
                        || now - speechStartedAt >= MAX_UTTERANCE_MS) {
                        finishUtterance();
                        return;
                    }
                }
            }
            animationRef.current = requestAnimationFrame(detect);
        };
        animationRef.current = requestAnimationFrame(detect);
        return () => {
            cancelDetection();
            if (recorder?.state === "recording") {
                recorder.onstop = null;
                recorder.stop();
            }
            if (recorderRef.current === recorder) recorderRef.current = null;
        };
    }, [attemptVersion, firebaseUser, foundationRoundId, paused, question?.id, sessionVersion]);

    const copy = status === "preparing"
        ? ["正在開啟麥克風…", "只要允許一次，這一輪會自動收音。"]
        : status === "recording"
            ? ["正在聽你說", "說完後停一下，系統會自動送出。"]
            : status === "submitting"
                ? ["正在評分…", "不用按任何按鈕，下一題會自動出現。"]
                : status === "blocked"
                    ? ["麥克風沒有開啟", "請確認瀏覽器的麥克風權限。"]
                    : ["麥克風已開啟", "看到字母後直接唸，不會播放答案提示。"];

    return <section className={`speaking-alphabet-auto is-${status}`} aria-live="polite" aria-atomic="true">
        <span className="speaking-alphabet-auto__icon" aria-hidden="true">
            {status === "submitting" || status === "preparing" ? <FiLoader /> : status === "blocked" ? <FiMicOff /> : <FiMic />}
        </span>
        <div><strong>{copy[0]}</strong><span>{copy[1]}</span></div>
        <small>每題只會把偵測到的短音訊送至發音評分服務；完成、失敗或離開時會關閉麥克風。</small>
        {error && <p role="alert">{error}</p>}
    </section>;
}
