import React, { useContext, useEffect, useRef, useState } from "react";
import { FiHeadphones, FiSquare } from "react-icons/fi";
import { SpeakingActivityContext } from "./SpeakingActivityContext";

// 「聽這題」：只播原本教材音檔裡這一題的那一段（start_ms～end_ms）。
// 用自己的 <audio>，不經過 MusicPlayer，也不送任何聽力紀錄，所以不算聽力次數。
export default function SpeakingQuestionClip({ clip, disabled = false }) {
    const audioRef = useRef(null);
    const frameRef = useRef(0);
    const [playing, setPlaying] = useState(false);
    const [failed, setFailed] = useState(false);
    const setBusy = useContext(SpeakingActivityContext);
    const startSeconds = Number(clip?.start_ms) / 1000;
    const endSeconds = Number(clip?.end_ms) / 1000;

    const stop = () => {
        cancelAnimationFrame(frameRef.current);
        const audio = audioRef.current;
        if (audio && !audio.paused) audio.pause();
        setPlaying(false);
        setBusy?.(false);
    };

    // 換題或離開時停止播放。
    useEffect(() => () => {
        cancelAnimationFrame(frameRef.current);
        audioRef.current?.pause?.();
        setBusy?.(false);
    }, [clip?.url, clip?.start_ms, setBusy]);

    if (clip?.type !== "audio" || !clip.url || !(endSeconds > startSeconds)) return null;

    const watchEnd = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.currentTime >= endSeconds || audio.ended) {
            stop();
            return;
        }
        frameRef.current = requestAnimationFrame(watchEnd);
    };

    const play = async () => {
        if (playing) {
            stop();
            return;
        }
        const audio = audioRef.current;
        if (!audio) return;
        setFailed(false);
        try {
            // iOS Safari 要等音檔資訊載入後才能跳到起點。
            if (audio.readyState < 1) {
                await new Promise((resolve, reject) => {
                    const onReady = () => { cleanup(); resolve(); };
                    const onError = () => { cleanup(); reject(new Error("clip load failed")); };
                    const cleanup = () => {
                        audio.removeEventListener("loadedmetadata", onReady);
                        audio.removeEventListener("error", onError);
                    };
                    audio.addEventListener("loadedmetadata", onReady);
                    audio.addEventListener("error", onError);
                    audio.load();
                });
            }
            audio.currentTime = startSeconds;
            setPlaying(true);
            setBusy?.(true);
            await audio.play();
            frameRef.current = requestAnimationFrame(watchEnd);
        } catch {
            stop();
            setFailed(true);
        }
    };

    return <div className="speaking-question-clip">
        <audio ref={audioRef} src={clip.url} preload="none" onTimeUpdate={() => {
            if (audioRef.current && audioRef.current.currentTime >= endSeconds) stop();
        }} onEnded={stop} />
        <button type="button" className="speaking-help-toggle speaking-question-clip__button" onClick={play} disabled={disabled && !playing} aria-pressed={playing}>
            {playing ? <FiSquare aria-hidden="true" /> : <FiHeadphones aria-hidden="true" />}
            {playing ? "停止" : "聽這題"}
        </button>
        {failed && <small className="speaking-question-clip__error" role="alert">這段聲音暫時無法播放，請再按一次。</small>}
    </div>;
}
