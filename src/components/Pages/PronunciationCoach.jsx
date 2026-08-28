import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle, FiHeadphones, FiMic, FiRefreshCw, FiSend, FiVolume2 } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { PRONUNCIATION_WORLDS } from "../../data/pronunciationLessons";
import { submitPronunciationAttempt } from "../../services/pronunciationCoachService";
import { convertAudioBlobToWav } from "../../utils/audioWav";
import "./css/PronunciationCoach.scss";
import "./css/PronunciationAccess.scss";

const MAX_RECORDING_SECONDS = 12;

const chooseRecordingMimeType = () => {
    if (!window.MediaRecorder?.isTypeSupported) return "";
    return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
        .find(type => window.MediaRecorder.isTypeSupported(type)) || "";
};

const scoreLabel = score => {
    if (score >= 80) return "表現良好";
    if (score >= 60) return "再練一次會更好";
    return "先聽示範，再慢慢重讀";
};

export default function PronunciationCoach() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const hasPronunciationAccess = role === "teacher"
        || role === "admin"
        || studentProfile?.membership?.effective_access?.features?.ai_materials === true;
    const world = PRONUNCIATION_WORLDS[0];
    const [lessonId, setLessonId] = useState(world.lessons[0].id);
    const [recording, setRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [elapsed, setElapsed] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const stopTimerRef = useRef(null);
    const elapsedTimerRef = useRef(null);

    const lesson = useMemo(
        () => world.lessons.find(item => item.id === lessonId) || world.lessons[0],
        [lessonId, world.lessons]
    );

    const releaseRecordingResources = () => {
        window.clearTimeout(stopTimerRef.current);
        window.clearInterval(elapsedTimerRef.current);
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };

    useEffect(() => () => {
        releaseRecordingResources();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    const resetAttempt = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
        setRecordedBlob(null);
        setResult(null);
        setError("");
        setElapsed(0);
    };

    const stopRecording = () => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };

    const startRecording = async () => {
        resetAttempt();
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setError("這個瀏覽器不支援錄音，請使用新版 Chrome 或 Safari");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            streamRef.current = stream;
            chunksRef.current = [];
            const mimeType = chooseRecordingMimeType();
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            recorderRef.current = recorder;
            recorder.ondataavailable = event => {
                if (event.data?.size > 0) chunksRef.current.push(event.data);
            };
            recorder.onerror = () => setError("錄音發生問題，請重新允許麥克風後再試一次");
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                releaseRecordingResources();
                setRecording(false);
                if (blob.size < 1000) {
                    setError("沒有收到清楚的錄音，請靠近麥克風再試一次");
                    return;
                }
                setRecordedBlob(blob);
                setPreviewUrl(URL.createObjectURL(blob));
            };
            recorder.start(250);
            setRecording(true);
            setElapsed(0);
            elapsedTimerRef.current = window.setInterval(
                () => setElapsed(current => Math.min(MAX_RECORDING_SECONDS, current + 1)),
                1000
            );
            stopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000);
        } catch (recordingError) {
            releaseRecordingResources();
            setRecording(false);
            setError(recordingError?.name === "NotAllowedError"
                ? "請允許麥克風權限，才能練習發音"
                : "目前無法啟動麥克風，請確認瀏覽器設定後再試一次");
        }
    };

    const submitAttempt = async () => {
        if (!recordedBlob || submitting) return;
        setSubmitting(true);
        setError("");
        try {
            const wav = await convertAudioBlobToWav(recordedBlob);
            setResult(await submitPronunciationAttempt({ firebaseUser, lessonId: lesson.id, audio: wav }));
        } catch (submitError) {
            setError(submitError?.code === "service_not_configured"
                ? "發音評分原型已完成，但測試語音服務尚未設定"
                : submitError?.message || "發音評分失敗，請稍後再試");
        } finally {
            setSubmitting(false);
        }
    };

    const speakExample = () => {
        if (!window.speechSynthesis) return setError("這個瀏覽器暫時無法播放示範語音");
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(lesson.referenceText);
        utterance.lang = "en-US";
        utterance.rate = 0.82;
        window.speechSynthesis.speak(utterance);
    };

    if (!hasPronunciationAccess) return <main className="pronunciation-page">
        <section className="pronunciation-access-card">
            <div className="pronunciation-mic"><FiMic /></div>
            <span className="pronunciation-eyebrow">AI SPEAKING COACH</span>
            <h1>AI 發音教練方案</h1>
            <p>此功能目前提供給具有效 AI 教材權限的學生。啟用後即可練習朗讀並查看逐字發音結果。</p>
            <Link to="/student/membership">查看會員方案</Link>
        </section>
    </main>;

    return <main className="pronunciation-page">
        <header className="pronunciation-hero">
            <div>
                <span className="pronunciation-eyebrow">AI SPEAKING COACH · PILOT</span>
                <h1>AI 發音教練</h1>
                <p>先聽示範，再朗讀指定句子。AI 會標出表現良好與需要再練習的字。</p>
            </div>
            <div className="pronunciation-world-badge"><FiHeadphones /><span>{world.title}</span><strong>1 / 3 主題</strong></div>
        </header>

        <div className="pronunciation-layout">
            <aside className="pronunciation-lessons" aria-label="日常問候關卡">
                <h2>{world.title}</h2>
                <p>{world.description}</p>
                {world.lessons.map((item, index) => <button
                    key={item.id}
                    type="button"
                    className={item.id === lesson.id ? "active" : ""}
                    onClick={() => { if (!recording) { setLessonId(item.id); resetAttempt(); } }}
                    disabled={recording}
                >
                    <span>{index + 1}</span>
                    <span><strong>{item.title}</strong><small>{item.mission}</small></span>
                </button>)}
            </aside>

            <section className="pronunciation-stage" aria-live="polite">
                <div className="pronunciation-mission"><span>MISSION</span><strong>{lesson.mission}</strong></div>
                <div className="pronunciation-script">
                    <p>{lesson.referenceText}</p>
                    <span>{lesson.translation}</span>
                    <button type="button" onClick={speakExample}><FiVolume2 />慢速示範</button>
                </div>
                <div className="pronunciation-hint"><strong>發音提示</strong><span>{lesson.hint}</span></div>

                {!result && <div className={`pronunciation-recorder ${recording ? "is-recording" : ""}`}>
                    <div className="pronunciation-mic"><FiMic /></div>
                    <strong>{recording ? "正在聽你朗讀…" : recordedBlob ? "錄音完成，可以先聽聽看" : "準備好就開始朗讀"}</strong>
                    <span>{recording ? `${elapsed} / ${MAX_RECORDING_SECONDS} 秒` : "每段錄音最多 12 秒"}</span>
                    {previewUrl && !recording && <audio controls src={previewUrl}>你的瀏覽器不支援錄音播放。</audio>}
                    <div className="pronunciation-actions">
                        {!recording && !recordedBlob && <button type="button" className="primary" onClick={startRecording}><FiMic />開始錄音</button>}
                        {recording && <button type="button" className="stop" onClick={stopRecording}>完成錄音</button>}
                        {!recording && recordedBlob && <>
                            <button type="button" className="secondary" onClick={startRecording}><FiRefreshCw />重新錄音</button>
                            <button type="button" className="primary" onClick={submitAttempt} disabled={submitting}><FiSend />{submitting ? "AI 評分中…" : "送出評分"}</button>
                        </>}
                    </div>
                </div>}

                {result && <section className="pronunciation-result">
                    <header><FiCheckCircle /><div><span>本次整體表現</span><strong>{Math.round(result.scores?.pronunciation || 0)} 分</strong><small>{scoreLabel(result.scores?.pronunciation || 0)}</small></div></header>
                    <div className="pronunciation-score-grid">
                        <div><span>發音清楚度</span><strong>{Math.round(result.scores?.accuracy || 0)}</strong></div>
                        <div><span>流暢度</span><strong>{Math.round(result.scores?.fluency || 0)}</strong></div>
                        <div><span>完整度</span><strong>{Math.round(result.scores?.completeness || 0)}</strong></div>
                        <div><span>自然語調</span><strong>{Math.round(result.scores?.prosody || 0)}</strong></div>
                    </div>
                    <div className="pronunciation-words" aria-label="逐字發音結果">
                        {(result.words || []).map((word, index) => <span key={`${word.text}-${index}`} className={`word-${word.status}`} title={`${word.score} 分`}>
                            {word.text}<small>{Math.round(word.score)}</small>
                        </span>)}
                    </div>
                    <p>{result.feedback || "很棒！再練一次，讓句子更自然。"}</p>
                    <button type="button" onClick={resetAttempt}><FiRefreshCw />再練一次</button>
                </section>}

                {error && <div className="pronunciation-error" role="alert">{error}</div>}
            </section>
        </div>
    </main>;
}
