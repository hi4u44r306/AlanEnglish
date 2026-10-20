import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiX } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { recordVideoWatch } from "../../services/learningActivityService";
import { createVideoCoverage, VIDEO_COMPLETE_RATIO } from "../../utils/videoCoverage";
import { createSpeakingChallengeSessionId as newSessionId } from "../../utils/speakingChallengeSession";
import "../assets/scss/LessonVideoDialog.scss";

// 在平台裡播放教學影片的某一段（YouTube 影片）。
// - 只計算真的播放過的部分；看滿八成記一次「看完」（後端會再核對時間）。
// - 播放中切換到別的分頁或 App：影片暫停並記一次「切換頁面」。
// - 不給點數、不算通關（YouTube 規定不能用獎勵換觀看）。只有學生本人會被記錄。
let youtubeApiPromise = null;
export const loadYouTubeApi = () => {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve(window.YT);
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => {
            youtubeApiPromise = null;
            reject(new Error("youtube api failed"));
        };
        document.head.appendChild(script);
    });
    return youtubeApiPromise;
};

const PLAYING = 1;

export default function LessonVideoDialog({ segment, title, trackId, context = "playlist", onClose }) {
    const { firebaseUser, role } = useAuth();
    const mountRef = useRef(null);
    const playerRef = useRef(null);
    const timerRef = useRef(0);
    const stateRef = useRef({ previous: null, started: false, completed: false, playing: false, end: segment?.end ?? null, coverage: null });
    const sessionRef = useRef(newSessionId());
    const [percent, setPercent] = useState(0);
    const [loadError, setLoadError] = useState(false);
    const isStudent = role === "student";

    const send = (phase, extra = {}) => {
        const state = stateRef.current;
        if (!isStudent || !firebaseUser || !state.end) return Promise.resolve();
        try {
            return recordVideoWatch(firebaseUser, {
                phase,
                video_id: segment.videoId,
                start_seconds: Math.floor(segment.start),
                end_seconds: Math.floor(state.end),
                session_id: sessionRef.current,
                track_id: trackId,
                context,
                ...extra
            })?.catch?.(() => {}) || Promise.resolve();
        } catch (error) {
            return Promise.resolve();
        }
    };

    useEffect(() => {
        if (!segment?.videoId) return undefined;
        let cancelled = false;
        const state = stateRef.current;

        const sample = () => {
            const player = playerRef.current;
            if (!player?.getCurrentTime || !state.coverage) return;
            const current = Number(player.getCurrentTime()) || 0;
            if (state.previous !== null) state.coverage.step(state.previous, current);
            state.previous = current;
            const ratio = state.coverage.ratio();
            setPercent(Math.round(ratio * 100));
            if (ratio >= VIDEO_COMPLETE_RATIO && !state.completed) {
                state.completed = true;
                send("complete", { coverage: Math.round(ratio * 100) / 100 });
            }
        };
        const stopTimer = () => {
            window.clearInterval(timerRef.current);
            timerRef.current = 0;
        };

        loadYouTubeApi().then(YT => {
            if (cancelled || !mountRef.current) return;
            playerRef.current = new YT.Player(mountRef.current, {
                host: "https://www.youtube-nocookie.com",
                videoId: segment.videoId,
                playerVars: {
                    start: Math.floor(segment.start),
                    ...(segment.end ? { end: Math.floor(segment.end) } : {}),
                    rel: 0,
                    playsinline: 1,
                    fs: 0,
                    iv_load_policy: 3,
                    modestbranding: 1
                },
                events: {
                    onReady: event => {
                        if (!state.end) state.end = Math.floor(Number(event.target.getDuration?.()) || 0) || null;
                        if (state.end) state.coverage = createVideoCoverage(segment.start, state.end);
                    },
                    onStateChange: event => {
                        if (event.data === PLAYING) {
                            state.playing = true;
                            // 影片和教材音檔不同時播放。
                            document.querySelectorAll("audio").forEach(audio => { if (!audio.paused) audio.pause(); });
                            if (!state.started) {
                                state.started = true;
                                send("start");
                            }
                            state.previous = Number(event.target.getCurrentTime?.()) || 0;
                            stopTimer();
                            timerRef.current = window.setInterval(sample, 1000);
                        } else {
                            if (state.playing) sample();
                            state.playing = false;
                            state.previous = null;
                            stopTimer();
                        }
                    }
                }
            });
        }).catch(() => { if (!cancelled) setLoadError(true); });

        const onVisibility = () => {
            if (document.visibilityState !== "hidden" || !state.playing) return;
            playerRef.current?.pauseVideo?.();
            send("pause_hidden");
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            cancelled = true;
            stopTimer();
            document.removeEventListener("visibilitychange", onVisibility);
            try { playerRef.current?.destroy?.(); } catch (error) { /* 已移除 */ }
            playerRef.current = null;
        };
        // 只在換影片段落時重建播放器。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segment?.videoId, segment?.start, segment?.end]);

    useEffect(() => {
        const onKey = event => { if (event.key === "Escape") onClose?.(); };
        window.addEventListener("keydown", onKey);
        // 影片開著時背景不捲動。
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    const done = percent >= Math.round(VIDEO_COMPLETE_RATIO * 100);
    return createPortal(<div className="lesson-video-dialog" role="dialog" aria-modal="true" aria-label={`${title} 教學影片`}>
        <div className="lesson-video-dialog__backdrop" onClick={onClose} aria-hidden="true" />
        <section className="lesson-video-dialog__panel">
            <header>
                <strong>{title} 教學影片</strong>
                <button type="button" className="lesson-video-dialog__close" onClick={onClose} aria-label="關閉影片"><FiX aria-hidden="true" /></button>
            </header>
            <div className="lesson-video-dialog__frame">
                {loadError
                    ? <p role="alert">影片暫時無法載入，請稍後再試。</p>
                    : <div ref={mountRef} />}
            </div>
            <div className="lesson-video-dialog__progress" aria-live="polite">
                <div className="lesson-video-dialog__bar" role="progressbar" aria-label="已看的部分" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
                <span>{done ? <><FiCheck aria-hidden="true" />看完了！</> : `已看 ${percent}%，看到 80% 就算看完`}</span>
            </div>
        </section>
    </div>, document.body);
}
