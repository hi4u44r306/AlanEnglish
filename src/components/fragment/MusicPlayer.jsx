import AudioPlayer, { RHAP_UI } from "react-h5-audio-player";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    MdCheck,
    MdClosedCaption,
    MdKeyboardArrowDown,
    MdMusicNote,
    MdMoreVert,
    MdPause,
    MdPlayArrow,
    MdRepeat,
    MdSkipNext,
    MdSkipPrevious,
    MdSpeed,
    MdThumbDown,
    MdThumbDownOffAlt,
    MdThumbUp,
    MdThumbUpOffAlt
} from "react-icons/md";
import { useDispatch } from "react-redux";
import {
    setCurrentPlaying,
    setPlayPauseStatus,
    setNoInteractionCount
} from "../../actions/actions";
import { toast } from "react-toastify";
import "react-h5-audio-player/lib/styles.css";
import "../assets/scss/FooterPlayer.scss";
import { useAuth } from "../../auth/AuthContext";
import {
    recordTrackPlay,
    startListeningSession
} from "../../services/listeningService";
import { getAccessibleBook } from "../../services/contentAccessService";
import {
    clamp,
    getCoveredSeconds,
    isNaturalListeningInterval,
    mergeCoverageRange
} from "../../utils/listeningCoverage";
import ListeningRewardFeedback from "./ListeningRewardFeedback";
import PlaybackPausedDialog from "./PlaybackPausedDialog";
import { listeningRewardText } from "../../utils/listeningRewardText";

const NO_INTERACTION_STORAGE_KEY = "ae-no-interaction";
const NO_INTERACTION_CHECK_COUNT = 5;
const ATTENTION_CHECK_SECONDS = 30;
const CONTINUOUS_ATTENTION_MINUTES = 15;
const MINIMUM_LISTENING_COVERAGE = 80;
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];
const getListeningClock = () => (
    typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now()
);
const formatTime = value => {
    const safeValue = Math.max(0, Number(value) || 0);
    const minutes = Math.floor(safeValue / 60);
    const seconds = Math.floor(safeValue % 60).toString().padStart(2, "0");

    return `${minutes}:${seconds}`;
};

function PlayerOptionsPanel({
    repeatTrack,
    playbackRate,
    onToggleRepeat,
    onSelectRate
}) {
    return (
        <div className="player-options-menu" role="dialog" aria-label="播放設定">
            <button
                type="button"
                className={`player-options-repeat${repeatTrack ? " is-active" : ""}`}
                onClick={onToggleRepeat}
                aria-pressed={repeatTrack}
            >
                <MdRepeat aria-hidden="true" />
                <span>
                    <strong>重複播放</strong>
                    <small>{repeatTrack ? "已開啟單曲重複" : "播放結束後再播一次"}</small>
                </span>
                <span className="player-options-switch" aria-hidden="true" />
            </button>
            <div className="player-options-speed">
                <span className="player-options-speed-title">
                    <MdSpeed aria-hidden="true" />
                    播放速度
                </span>
                <div className="player-options-rates">
                    {PLAYBACK_RATES.map(rate => (
                        <button
                            key={rate}
                            type="button"
                            className={playbackRate === rate ? "is-active" : ""}
                            onClick={() => onSelectRate(rate)}
                            aria-pressed={playbackRate === rate}
                        >
                            {rate}x
                            {playbackRate === rate && <MdCheck aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MusicPlayer({ music }) {
    const dispatch = useDispatch();
    const audioElement = useRef(null);
    const automaticTrackChangeRef = useRef(false);
    const internalTrackChangeRef = useRef(false);
    const pendingPlaybackRef = useRef(Boolean(music));
    const coverageRangesRef = useRef([]);
    const lastListenTimeRef = useRef(null);
    const lastListenWallClockRef = useRef(null);
    const isSeekingRef = useRef(false);
    const isAcceleratedPlaybackRef = useRef(false);
    const usedAcceleratedPlaybackRef = useRef(false);
    const isDocumentVisibleRef = useRef(document.visibilityState !== "hidden");
    const completionSentRef = useRef(false);
    const listeningSessionIdRef = useRef(null);
    const startingSessionRef = useRef(false);
    const sessionStartPromiseRef = useRef(null);
    const sessionStartRequestRef = useRef(0);
    const hasPlaybackStartedRef = useRef(false);
    const pausedForVisibilityRef = useRef(false);
    const attentionCheckRef = useRef(false);
    const continuousListeningStartedAtRef = useRef(null);
    const desktopOptionsRef = useRef(null);
    const mobileOptionsRef = useRef(null);

    const { firebaseUser, role } = useAuth();

    const [currTrack, setCurrTrack] = useState(music);
    const [playlist, setPlaylist] = useState(() => (
        Array.isArray(music?.playbackQueue)
            ? music.playbackQueue
            : []
    ));
    const [noInteractionCount, setLocalNoInteractionCount] = useState(() => {
        const savedCount = Number(
            localStorage.getItem(NO_INTERACTION_STORAGE_KEY)
        );

        return Number.isFinite(savedCount)
            ? savedCount
            : 0;
    });
    const [coveragePercent, setCoveragePercent] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [sessionIneligible, setSessionIneligible] = useState(false);
    const [repeatTrack, setRepeatTrack] = useState(false);
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const [isDesktopOptionsOpen, setIsDesktopOptionsOpen] = useState(false);
    const [isMobileOptionsOpen, setIsMobileOptionsOpen] = useState(false);
    const [trackReaction, setTrackReaction] = useState(null);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [isPlaybackActive, setIsPlaybackActive] = useState(false);
    const [transcriptMode, setTranscriptMode] = useState("none");
    const [rewardFeedback, setRewardFeedback] = useState(null);
    const [rewardSummary, setRewardSummary] = useState(null);
    const [visibilityPauseOpen, setVisibilityPauseOpen] = useState(false);
    const [attentionCheckOpen, setAttentionCheckOpen] = useState(false);
    const [attentionSecondsLeft, setAttentionSecondsLeft] = useState(ATTENTION_CHECK_SECONDS);
    const [attentionExpired, setAttentionExpired] = useState(false);

    const {
        id: trackId,
        bookname,
        page,
        audioURL,
        book_id,
        transcript_en,
        transcript_zh,
        subtitle_status
    } = currTrack || {};
    const hasTranscript = subtitle_status === "published" && Boolean(transcript_en || transcript_zh);
    const rewardStatus = String(rewardSummary?.reward_status?.track_id) === String(trackId)
        ? rewardSummary.reward_status : null;
    const masteryText = listeningRewardText(rewardStatus);
    const compactRewardProgress = rewardStatus
        ? rewardStatus.source === "assignment"
            ? ` · 作業 ${rewardStatus.valid_listen_count}/${rewardStatus.required_listens}`
            : rewardStatus.mastery_rewarded ? " · 已熟練" : ` · 自主 ${rewardStatus.mastery_count}/10`
        : "";
    const cycleTranscript = () => setTranscriptMode(current => {
        if (current === "none") return transcript_en ? "en" : "zh";
        if (current === "en" && transcript_zh) return "zh";
        if (current !== "full") return "full";
        return "none";
    });

    const resetListeningSession = useCallback(() => {
        coverageRangesRef.current = [];
        lastListenTimeRef.current = null;
        lastListenWallClockRef.current = null;
        isSeekingRef.current = false;
        isAcceleratedPlaybackRef.current = false;
        usedAcceleratedPlaybackRef.current = false;
        completionSentRef.current = false;
        listeningSessionIdRef.current = null;
        startingSessionRef.current = false;
        sessionStartPromiseRef.current = null;
        sessionStartRequestRef.current += 1;
        hasPlaybackStartedRef.current = false;
        setRewardSummary(null);
        setCoveragePercent(0);
        setPlaybackRate(1);
        setSessionIneligible(false);
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            const isVisible = document.visibilityState !== "hidden";
            isDocumentVisibleRef.current = isVisible;
            lastListenTimeRef.current = null;
            lastListenWallClockRef.current = null;

            if (isVisible) {
                return;
            }

            const audio = audioElement.current?.audio?.current;
            if (audio && !audio.paused && !pausedForVisibilityRef.current) {
                pausedForVisibilityRef.current = true;
                setVisibilityPauseOpen(true);
                audio.pause();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    const updateCoverage = useCallback((start, end, duration) => {
        if (!Number.isFinite(duration) || duration <= 0) {
            return 0;
        }

        coverageRangesRef.current = mergeCoverageRange(
            coverageRangesRef.current,
            [clamp(start, 0, duration), clamp(end, 0, duration)]
        );

        const nextCoverage = clamp(
            (getCoveredSeconds(coverageRangesRef.current) / duration) * 100,
            0,
            100
        );

        setCoveragePercent(nextCoverage);
        return nextCoverage;
    }, []);

    const ensureListeningSession = useCallback(audio => {
        if (
            role !== "student" ||
            !firebaseUser ||
            !trackId ||
            !audio ||
            !hasPlaybackStartedRef.current ||
            !Number.isFinite(audio.duration) ||
            audio.duration <= 0 ||
            listeningSessionIdRef.current ||
            startingSessionRef.current
        ) {
            return;
        }

        const requestedTrackId = trackId;
        const requestId = sessionStartRequestRef.current + 1;
        sessionStartRequestRef.current = requestId;
        startingSessionRef.current = true;

        const startPromise = startListeningSession(
            firebaseUser,
            requestedTrackId,
            Number(audio.duration.toFixed(2))
        );
        sessionStartPromiseRef.current = startPromise;

        void startPromise
            .then(result => {
                if (sessionStartRequestRef.current === requestId) {
                    listeningSessionIdRef.current = result?.session?.id || null;
                    if (result?.session?.reward_status) {
                        setRewardSummary({ ...result.session.reward_status, reward_status: result.session.reward_status });
                    }
                }
            })
            .catch(error => {
                if (sessionStartRequestRef.current === requestId) {
                    console.error("建立有效聆聽工作階段失敗:", error);
                }
            })
            .finally(() => {
                if (sessionStartRequestRef.current === requestId) {
                    startingSessionRef.current = false;
                    sessionStartPromiseRef.current = null;
                }
            });
    }, [firebaseUser, role, trackId]);

    // =====================================
    // 初始化 noInteraction Redux
    // =====================================

    useEffect(() => {
        dispatch(
            setNoInteractionCount(
                noInteractionCount
            )
        );
    }, [dispatch, noInteractionCount]);

    // =====================================
    // Redux music 改變
    // =====================================

    useEffect(() => {
        if (!music) {
            return;
        }

        internalTrackChangeRef.current =
            true;

        pendingPlaybackRef.current =
            true;

        if (
            Array.isArray(music.playbackQueue) &&
            music.playbackQueue.length > 0
        ) {
            setPlaylist(
                music.playbackQueue
            );
        }

        setCurrTrack(
            music
        );

    }, [music]);

    useEffect(() => {
        resetListeningSession();
        setTrackReaction(null);
        setIsDesktopOptionsOpen(false);
        setIsMobileOptionsOpen(false);
        setTranscriptMode("none");
    }, [resetListeningSession, trackId]);

    useEffect(() => {
        if (!isMobileExpanded) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleOverlayKeyDown = event => {
            if (event.key !== "Escape") {
                return;
            }

            if (isMobileOptionsOpen) {
                setIsMobileOptionsOpen(false);
                return;
            }

            setIsMobileExpanded(false);
        };

        window.addEventListener("keydown", handleOverlayKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleOverlayKeyDown);
        };
    }, [isMobileExpanded, isMobileOptionsOpen]);

    useEffect(() => {
        if (!isDesktopOptionsOpen && !isMobileOptionsOpen) {
            return undefined;
        }

        const handleOutsidePointerDown = event => {
            const clickedDesktopMenu = desktopOptionsRef.current?.contains(event.target);
            const clickedMobileMenu = mobileOptionsRef.current?.contains(event.target);

            if (!clickedDesktopMenu && !clickedMobileMenu) {
                setIsDesktopOptionsOpen(false);
                setIsMobileOptionsOpen(false);
            }
        };

        const handleOptionsKeyDown = event => {
            if (event.key === "Escape") {
                setIsDesktopOptionsOpen(false);
                setIsMobileOptionsOpen(false);
            }
        };

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        window.addEventListener("keydown", handleOptionsKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
            window.removeEventListener("keydown", handleOptionsKeyDown);
        };
    }, [isDesktopOptionsOpen, isMobileOptionsOpen]);

    // =====================================
    // 讀取目前這本書全部音檔
    // =====================================

    useEffect(() => {
        const fetchPlaylist = async () => {
            if (
                Array.isArray(music?.playbackQueue) &&
                music.playbackQueue.length > 0
            ) {
                setPlaylist(
                    music.playbackQueue
                );

                return;
            }

            if (!book_id || !firebaseUser || !music?.type) {
                setPlaylist(
                    currTrack ? [currTrack] : []
                );

                return;
            }

            try {
                const result = await getAccessibleBook(firebaseUser, music.type);
                const resolvedBookName = result?.book?.name || bookname;
                const convertedTracks = (result?.tracks || []).map(track => ({
                    ...track,
                    bookname: resolvedBookName,
                    musicName: track.music_name,
                    audioURL: track.audio_url,
                    audio_url: track.audio_url,
                    type: music.type
                }));

                setPlaylist(convertedTracks.length ? convertedTracks : (currTrack ? [currTrack] : []));
            } catch (error) {
                console.error(
                    "MusicPlayer 讀取 Playlist 失敗:",
                    error
                );
            }
        };

        fetchPlaylist();
    }, [
        book_id,
        bookname,
        currTrack,
        firebaseUser,
        music?.type,
        music?.playbackQueue
    ]);

    // =====================================
    // 換檔後確保立即開始播放
    // =====================================

    const requestPlayback = useCallback(audio => {
        if (
            !audio ||
            !audio.src ||
            !pendingPlaybackRef.current
        ) {
            return;
        }

        const playPromise =
            audio.play();

        if (
            playPromise &&
            typeof playPromise.catch ===
            "function"
        ) {
            playPromise.catch(error => {
                if (
                    error?.name !==
                    "AbortError"
                ) {
                    console.warn(
                        "自動播放下一個音檔失敗，等待音檔可播放後重試:",
                        error
                    );
                }
            });
        }
    }, []);

    useEffect(() => {
        if (
            !pendingPlaybackRef.current ||
            !audioURL
        ) {
            return undefined;
        }

        const frameId =
            window.requestAnimationFrame(
                () => {
                    requestPlayback(
                        audioElement.current?.audio?.current
                    );
                }
            );

        return () => {
            window.cancelAnimationFrame(
                frameId
            );
        };
    }, [
        audioURL,
        requestPlayback,
        trackId
    ]);

    // =====================================
    // noInteraction 共用更新
    // =====================================

    const updateNoInteractionCount = count => {
        const safeCount = Math.max(
            0,
            Number(count) || 0
        );

        setLocalNoInteractionCount(
            safeCount
        );

        localStorage.setItem(
            NO_INTERACTION_STORAGE_KEY,
            String(safeCount)
        );

        dispatch(
            setNoInteractionCount(
                safeCount
            )
        );

        return safeCount;
    };

    // =====================================
    // 人工操作時歸零
    // =====================================

    const resetNoInteraction = () => {
        automaticTrackChangeRef.current =
            false;

        updateNoInteractionCount(
            0
        );
    };

    // =====================================
    // 自動播放累計
    // =====================================

    const increaseNoInteraction = () => {
        const nextCount =
            noInteractionCount +
            1;

        updateNoInteractionCount(
            nextCount
        );

        return nextCount;
    };

    // =====================================
    // 學習注意力確認
    // =====================================

    const requestAttentionCheck = useCallback(() => {
        if (role !== "student" || attentionCheckOpen) return;
        attentionCheckRef.current = true;
        const audio = audioElement.current?.audio?.current;
        audio?.pause();
        dispatch(setPlayPauseStatus(false));
        setIsPlaybackActive(false);
        setAttentionExpired(false);
        setAttentionSecondsLeft(ATTENTION_CHECK_SECONDS);
        setAttentionCheckOpen(true);
    }, [attentionCheckOpen, dispatch, role]);

    useEffect(() => {
        if (!isPlaybackActive || attentionCheckOpen || role !== "student") return undefined;
        if (!continuousListeningStartedAtRef.current) {
            continuousListeningStartedAtRef.current = Date.now();
        }
        const elapsed = Date.now() - continuousListeningStartedAtRef.current;
        const remaining = Math.max(0, CONTINUOUS_ATTENTION_MINUTES * 60 * 1000 - elapsed);
        const timer = window.setTimeout(requestAttentionCheck, remaining);
        return () => window.clearTimeout(timer);
    }, [attentionCheckOpen, isPlaybackActive, requestAttentionCheck, role]);

    useEffect(() => {
        if (!attentionCheckOpen || attentionExpired) return undefined;
        const timer = window.setInterval(() => {
            setAttentionSecondsLeft(current => {
                if (current > 1) return current - 1;
                coverageRangesRef.current = [];
                lastListenTimeRef.current = null;
                lastListenWallClockRef.current = null;
                listeningSessionIdRef.current = null;
                sessionStartRequestRef.current += 1;
                startingSessionRef.current = false;
                completionSentRef.current = false;
                setCoveragePercent(0);
                setAttentionExpired(true);
                return 0;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [attentionCheckOpen, attentionExpired]);

    const continueAfterAttentionCheck = () => {
        attentionCheckRef.current = false;
        setAttentionCheckOpen(false);
        setAttentionExpired(false);
        setAttentionSecondsLeft(ATTENTION_CHECK_SECONDS);
        continuousListeningStartedAtRef.current = Date.now();
        updateNoInteractionCount(0);
        const audio = audioElement.current?.audio?.current;
        if (audio) {
            if (attentionExpired) {
                resetListeningSession();
                audio.currentTime = 0;
            }
            lastListenTimeRef.current = audio.currentTime;
            lastListenWallClockRef.current = getListeningClock();
            // A separate visibility confirmation must not bypass the attention check.
            if (!pausedForVisibilityRef.current && isDocumentVisibleRef.current) {
                void audio.play().catch(() => toast.error("暫時無法播放，請再按播放重試"));
            }
        }
    };

    const continueAfterVisibilityPause = async () => {
        const audio = audioElement.current?.audio?.current;
        if (!audio || !isDocumentVisibleRef.current || attentionCheckRef.current) throw new Error("Playback unavailable");
        pausedForVisibilityRef.current = false;
        try {
            await audio.play();
            // The user may hide the page again while play() is pending.
            if (!isDocumentVisibleRef.current || pausedForVisibilityRef.current) return;
            setVisibilityPauseOpen(false);
        } catch (error) {
            pausedForVisibilityRef.current = true;
            throw error;
        }
    };

    // =====================================
    // 儲存播放完成紀錄
    // =====================================

    const saveCompletedPlay = async ({ duration, coverage } = {}) => {
        if (
            role !==
            "student"
        ) {
            return null;
        }

        if (
            !firebaseUser
        ) {
            console.warn(
                "播放結束但沒有 Firebase User"
            );

            return null;
        }

        if (
            !trackId
        ) {
            console.warn(
                "播放結束但沒有 trackId:",
                currTrack
            );

            return null;
        }

        if (completionSentRef.current) {
            return null;
        }

        if (!listeningSessionIdRef.current && sessionStartPromiseRef.current) {
            await sessionStartPromiseRef.current.catch(() => null);
        }

        if (!listeningSessionIdRef.current) {
            console.warn("播放工作階段尚未建立，因此不計入聽力次數");
            return null;
        }

        completionSentRef.current = true;

        try {
            const result =
                await recordTrackPlay(
                    firebaseUser,
                    trackId,
                    {
                        duration_seconds: Number(duration.toFixed(2)),
                        coverage_percent: Number(coverage.toFixed(2)),
                        coverage_ranges: coverageRangesRef.current.map(([start, end]) => [
                            Number(start.toFixed(2)),
                            Number(end.toFixed(2))
                        ]),
                        used_accelerated_playback: usedAcceleratedPlaybackRef.current,
                        session_id: listeningSessionIdRef.current
                    }
                );

            const progress =
                result?.progress ||
                null;

            if (
                progress
            ) {
                window.dispatchEvent(
                    new CustomEvent(
                        "ae:track-progress-updated",
                        {
                            detail:
                                progress
                        }
                    )
                );
            }

            const reward = result?.reward || null;
            if (reward) {
                setRewardSummary(reward);
                setRewardFeedback(reward);
                window.dispatchEvent(new CustomEvent("ae:gamification-updated", { detail: reward }));
            }

            if (result?.counted === false) {
                toast.info(
                    `本次有效聆聽 ${Math.floor(Number(result.coverage_percent) || coverage)}%，未達 ${MINIMUM_LISTENING_COVERAGE}%，不增加次數或獎勵`,
                    {
                        position: "top-center",
                        autoClose: 4000
                    }
                );
            }

            return progress;
        } catch (error) {
            completionSentRef.current = false;
            console.error(
                "更新 Supabase 播放紀錄失敗:",
                error
            );

            toast.error(
                `播放完成，但紀錄更新失敗：${error.message}`,
                {
                    position:
                        "top-center",
                    autoClose:
                        3000
                }
            );

            return null;
        }
    };

    // =====================================
    // 找目前歌曲位置
    // =====================================

    const getCurrentIndex = () => {
        if (
            !playlist ||
            playlist.length ===
            0
        ) {
            return -1;
        }

        return playlist.findIndex(
            track => {
                if (
                    track.id ===
                    currTrack?.id
                ) {
                    return true;
                }

                return (
                    track.bookname ===
                    bookname &&
                    track.page ===
                    page
                );
            }
        );
    };

    // =====================================
    // 切換歌曲共用
    // =====================================

    const playTrack = (
        track,
        isAutomatic = false
    ) => {
        if (!track) {
            return;
        }

        automaticTrackChangeRef.current =
            isAutomatic;

        internalTrackChangeRef.current =
            true;

        pendingPlaybackRef.current =
            true;

        const queuedTrack = {
            ...track,
            playbackQueue:
                playlist
        };

        setCurrTrack(
            queuedTrack
        );

        dispatch(
            setCurrentPlaying(
                queuedTrack
            )
        );

        dispatch(
            setPlayPauseStatus(
                true
            )
        );
    };

    // =====================================
    // 下一首（手動）
    // =====================================

    const handleClickNext = () => {
        if (
            playlist.length ===
            0
        ) {
            return;
        }

        resetNoInteraction();

        const currentIndex =
            getCurrentIndex();

        if (
            currentIndex ===
            -1
        ) {
            console.error(
                "找不到目前歌曲 index"
            );

            return;
        }

        const nextIndex =
            (
                currentIndex +
                1
            ) %
            playlist.length;

        const nextTrack =
            playlist[
            nextIndex
            ];

        playTrack(
            nextTrack,
            false
        );
    };

    // =====================================
    // 上一首（手動）
    // =====================================

    const handleClickPrev = () => {
        if (
            playlist.length ===
            0
        ) {
            return;
        }

        resetNoInteraction();

        const currentIndex =
            getCurrentIndex();

        if (
            currentIndex ===
            -1
        ) {
            console.error(
                "找不到目前歌曲 index"
            );

            return;
        }

        const prevIndex =
            (
                currentIndex -
                1 +
                playlist.length
            ) %
            playlist.length;

        const prevTrack =
            playlist[
            prevIndex
            ];

        playTrack(
            prevTrack,
            false
        );
    };

    // =====================================
    // 播放完整首
    // =====================================

    const handleEnd = async event => {
        console.log(
            "Track End:",
            currTrack
        );

        // =================================
        // 一定先記錄現在這首
        // =================================

        const audio = event.currentTarget;
        const duration = Number(audio.duration);
        const lastListenTime = lastListenTimeRef.current;
        const lastListenWallClock = lastListenWallClockRef.current;
        const now = getListeningClock();
        let finalCoverage = coveragePercent;

        ensureListeningSession(audio);

        if (
            Number.isFinite(lastListenTime) &&
            Number.isFinite(lastListenWallClock) &&
            Number.isFinite(duration) &&
            isNaturalListeningInterval({
                start: lastListenTime,
                end: duration,
                elapsedSeconds: (now - lastListenWallClock) / 1000,
                playbackRate: audio.playbackRate,
                isSeeking: isSeekingRef.current,
                isVisible: isDocumentVisibleRef.current,
                attentionBlocked: attentionCheckOpen
            })
        ) {
            finalCoverage = updateCoverage(lastListenTime, duration, duration);
        }

        await saveCompletedPlay({ duration, coverage: finalCoverage });

        // =================================
        // 自動播放次數 +1
        // =================================

        const nextNoInteractionCount =
            increaseNoInteraction();

        // =================================
        // 連續 5 首後要求一次人工確認
        // =================================

        if (
            nextNoInteractionCount >=
            NO_INTERACTION_CHECK_COUNT
        ) {
            automaticTrackChangeRef.current =
                false;
            requestAttentionCheck();
            return;
        }

        if (repeatTrack) {
            // Same-track replay needs a fresh server session so general
            // listening progress can continue; the server owns reward allocation.
            resetListeningSession();
            audio.currentTime = 0;
            lastListenTimeRef.current = 0;
            lastListenWallClockRef.current = getListeningClock();
            const replayPromise = audio.play();

            if (replayPromise && typeof replayPromise.catch === "function") {
                replayPromise.catch(error => {
                    console.warn("重複播放失敗:", error);
                });
            }

            return;
        }

        // =================================
        // 再自動播放下一首
        // =================================

        if (
            playlist.length ===
            0
        ) {
            return;
        }

        const currentIndex =
            getCurrentIndex();

        if (
            currentIndex ===
            -1
        ) {
            return;
        }

        const nextIndex =
            (
                currentIndex +
                1
            ) %
            playlist.length;

        const nextTrack =
            playlist[
            nextIndex
            ];

        playTrack(
            nextTrack,
            true
        );
    };

    // =====================================
    // 播放
    // =====================================

    const handlePlay = () => {
        const audio = audioElement.current?.audio?.current;
        if (!isDocumentVisibleRef.current || pausedForVisibilityRef.current || attentionCheckRef.current) {
            audio?.pause();
            dispatch(setPlayPauseStatus(false));
            setIsPlaybackActive(false);
            return;
        }
        pendingPlaybackRef.current =
            false;

        internalTrackChangeRef.current =
            false;

        dispatch(
            setPlayPauseStatus(
                true
            )
        );

        setIsPlaybackActive(true);
        hasPlaybackStartedRef.current = true;
        if (audio) {
            setPlaybackPosition(audio.currentTime);
            setAudioDuration(audio.duration || 0);
            lastListenTimeRef.current = audio.currentTime;
            lastListenWallClockRef.current = getListeningClock();
            ensureListeningSession(audio);
        }

        if (
            automaticTrackChangeRef.current
        ) {
            automaticTrackChangeRef.current =
                false;

            return;
        }

        if (!pausedForVisibilityRef.current && !attentionCheckRef.current) resetNoInteraction();
    };

    // =====================================
    // 暫停
    // =====================================

    const handlePause = () => {
        if (
            internalTrackChangeRef.current ||
            pendingPlaybackRef.current
        ) {
            return;
        }

        dispatch(
            setPlayPauseStatus(
                false
            )
        );

        setIsPlaybackActive(false);
        lastListenTimeRef.current = null;
        lastListenWallClockRef.current = null;

        if (!pausedForVisibilityRef.current && !attentionCheckRef.current) resetNoInteraction();
    };

    const handleListen = event => {
        const audio = event.currentTarget;
        const currentTime = Number(audio.currentTime);
        const duration = Number(audio.duration);
        const previousTime = lastListenTimeRef.current;
        const previousWallClock = lastListenWallClockRef.current;
        const now = getListeningClock();

        if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) {
            return;
        }

        setPlaybackPosition(currentTime);
        setAudioDuration(duration);
        ensureListeningSession(audio);

        if (
            Number.isFinite(previousTime) &&
            Number.isFinite(previousWallClock) &&
            isNaturalListeningInterval({
                start: previousTime,
                end: currentTime,
                elapsedSeconds: (now - previousWallClock) / 1000,
                playbackRate: audio.playbackRate,
                isSeeking: isSeekingRef.current,
                isVisible: isDocumentVisibleRef.current,
                attentionBlocked: attentionCheckOpen
            })
        ) {
            updateCoverage(previousTime, currentTime, duration);
        }

        lastListenTimeRef.current = currentTime;
        lastListenWallClockRef.current = now;
    };

    const updatePlaybackRate = nextValue => {
        const nextRate = Number(nextValue);
        const audio = audioElement.current?.audio?.current;

        if (!PLAYBACK_RATES.includes(nextRate)) {
            return;
        }

        const isAccelerated = nextRate > 1;
        isAcceleratedPlaybackRef.current = isAccelerated;
        if (isAccelerated) {
            usedAcceleratedPlaybackRef.current = true;
            setSessionIneligible(true);
        }

        if (audio) {
            audio.playbackRate = nextRate;
            // 切換速度的瞬間不算作聆聽區段；回到正常速度後才重新累積。
            lastListenTimeRef.current = audio.currentTime;
            lastListenWallClockRef.current = getListeningClock();
        }

        setPlaybackRate(nextRate);
    };

    const handleOptionsPlaybackRateChange = rate => {
        updatePlaybackRate(rate);
        setIsDesktopOptionsOpen(false);
        setIsMobileOptionsOpen(false);
    };

    const toggleTrackReaction = nextReaction => {
        setTrackReaction(currentReaction => (
            currentReaction === nextReaction
                ? null
                : nextReaction
        ));
    };

    const togglePlayback = () => {
        const audio = audioElement.current?.audio?.current;

        if (!audio) {
            return;
        }

        if (audio.paused) {
            void audio.play();
        } else {
            audio.pause();
        }
    };

    const handleOverlaySeek = event => {
        const audio = audioElement.current?.audio?.current;
        const nextPosition = Number(event.target.value);

        if (!audio || !Number.isFinite(nextPosition)) {
            return;
        }

        audio.currentTime = nextPosition;
        lastListenTimeRef.current = nextPosition;
        lastListenWallClockRef.current = getListeningClock();
        setPlaybackPosition(nextPosition);
    };

    // =====================================
    // 沒有音樂
    // =====================================

    if (!currTrack) {
        return null;
    }

    // =====================================
    // Render
    // =====================================

    return (
        <div className="footer-player">
            <button
                type="button"
                className="player-mobile-expand"
                onClick={() => setIsMobileExpanded(true)}
                aria-label="展開播放器"
            >
                <span className="player-track-art" aria-hidden="true">
                    <MdMusicNote />
                </span>
                <span className="player-track-summary" aria-live="polite">
                    <span className="player-track-title">
                    <span className="player-track-book">
                        {bookname || "未命名教材"}
                    </span>
                    {page && (
                        <span className="player-track-page">
                            {page}
                        </span>
                    )}
                    </span>
                    <span className="player-track-status">
                        {sessionIneligible
                            ? "加速播放中，這段不計入次數"
                            : `有效聆聽 ${Math.floor(coveragePercent)}%${compactRewardProgress}`}
                    </span>
                </span>
            </button>
            <AudioPlayer
                autoPlay={true}
                autoPlayAfterSrcChange={true}
                preload="auto"
                volume={0.5}
                loop={false}
                progressUpdateInterval={50}
                listenInterval={1000}
                ref={audioElement}
                src={
                    audioURL ||
                    ""
                }
                showSkipControls={true}
                showJumpControls={false}
                onClickNext={
                    handleClickNext
                }
                onClickPrevious={
                    handleClickPrev
                }
                onEnded={
                    handleEnd
                }
                onListen={handleListen}
                onSeeking={() => {
                    isSeekingRef.current = true;
                    lastListenWallClockRef.current = null;
                }}
                onSeeked={event => {
                    isSeekingRef.current = false;
                    lastListenTimeRef.current = event.currentTarget.currentTime;
                    lastListenWallClockRef.current = getListeningClock();
                    setPlaybackPosition(event.currentTarget.currentTime);
                }}
                onCanPlay={event => {
                    setAudioDuration(event.currentTarget.duration || 0);
                    ensureListeningSession(event.currentTarget);
                    requestPlayback(
                        event.currentTarget
                    );
                }}
                onPlay={
                    handlePlay
                }
                onPause={
                    handlePause
                }
                onError={event => {
                    console.error(
                        "Audio 播放錯誤:",
                        event
                    );

                    console.error(
                        "音檔 URL:",
                        audioURL
                    );
                }}
                customProgressBarSection={[
                    RHAP_UI.PROGRESS_BAR
                ]}
                customControlsSection={[
                    RHAP_UI.MAIN_CONTROLS,
                    <div key="desktop-time" className="desktop-player-time">
                        {formatTime(playbackPosition)} / {formatTime(audioDuration)}
                    </div>,
                    <div key="desktop-track" className="desktop-player-track">
                        <span className="desktop-player-art" aria-hidden="true">
                            <MdMusicNote />
                        </span>
                        <span className="desktop-player-copy">
                            <strong>
                                {bookname || "未命名教材"}{page ? ` · ${page}` : ""}
                                {playbackRate !== 1 ? `（${playbackRate}x）` : ""}
                            </strong>
                            <small>
                                {sessionIneligible
                                    ? "加速播放中，這段不計入次數"
                                    : `有效聆聽 ${Math.floor(coveragePercent)}%${compactRewardProgress}`}
                            </small>
                        </span>
                    </div>,
                    <div key="desktop-actions" className="desktop-player-actions">
                        {hasTranscript && <button type="button" className={transcriptMode !== "none" ? "is-active" : ""} onClick={cycleTranscript} aria-label="切換字幕與逐字稿" aria-pressed={transcriptMode !== "none"}><MdClosedCaption aria-hidden="true" /></button>}
                        <button
                            type="button"
                            className={trackReaction === "like" ? "is-active" : ""}
                            onClick={() => toggleTrackReaction("like")}
                            aria-label="喜歡這個音檔"
                            aria-pressed={trackReaction === "like"}
                        >
                            {trackReaction === "like"
                                ? <MdThumbUp aria-hidden="true" />
                                : <MdThumbUpOffAlt aria-hidden="true" />}
                        </button>
                        <button
                            type="button"
                            className={trackReaction === "dislike" ? "is-active" : ""}
                            onClick={() => toggleTrackReaction("dislike")}
                            aria-label="不喜歡這個音檔"
                            aria-pressed={trackReaction === "dislike"}
                        >
                            {trackReaction === "dislike"
                                ? <MdThumbDown aria-hidden="true" />
                                : <MdThumbDownOffAlt aria-hidden="true" />}
                        </button>
                        <div className="desktop-player-options" ref={desktopOptionsRef}>
                            <button
                                type="button"
                                className="desktop-player-more"
                                onClick={() => {
                                    setIsMobileOptionsOpen(false);
                                    setIsDesktopOptionsOpen(current => !current);
                                }}
                                aria-label="更多播放設定"
                                aria-haspopup="dialog"
                                aria-expanded={isDesktopOptionsOpen}
                            >
                                <MdMoreVert aria-hidden="true" />
                            </button>
                            {isDesktopOptionsOpen && (
                                <PlayerOptionsPanel
                                    repeatTrack={repeatTrack}
                                    playbackRate={playbackRate}
                                    onToggleRepeat={() => setRepeatTrack(current => !current)}
                                    onSelectRate={handleOptionsPlaybackRateChange}
                                />
                            )}
                        </div>
                    </div>,
                    RHAP_UI.VOLUME_CONTROLS
                ]}
            />

            <div className="listening-coverage-status" aria-live="polite">
                {sessionIneligible
                    ? "加速播放中：這段不列入有效聆聽"
                    : `本次有效聆聽 ${Math.floor(coveragePercent)}%（聽滿 80% 才計一次）`}
            </div>
            {rewardSummary && (
                <div className="listening-daily-reward-status" aria-live="polite">
                    <strong>{masteryText ? masteryText.title : `今日獎勵 ${rewardSummary.daily_rewarded_tracks}/${rewardSummary.daily_track_limit} 首`}</strong>
                    <span>
                        {masteryText ? masteryText.detail : rewardSummary.limit_reached
                            ? "今日 XP／AE Points 已達上限，仍可繼續聽"
                            : `再聽 ${rewardSummary.next_point_in} 首不同音檔可得 1 AE Point`}
                    </span>
                </div>
            )}
            <ListeningRewardFeedback reward={rewardFeedback} onDismiss={() => setRewardFeedback(null)} />
            {visibilityPauseOpen && !attentionCheckOpen && (
                <PlaybackPausedDialog onResume={continueAfterVisibilityPause} />
            )}
            {hasTranscript && transcriptMode !== "none" && <section className="desktop-transcript-panel" aria-live="polite"><header><strong>{transcriptMode === "en" ? "英文字幕" : transcriptMode === "zh" ? "中文提示" : "完整逐字稿"}</strong><button type="button" onClick={() => setTranscriptMode("none")}>關閉字幕再練習</button></header>{(transcriptMode === "en" || transcriptMode === "full") && transcript_en && <p lang="en">{transcript_en}</p>}{(transcriptMode === "zh" || transcriptMode === "full") && transcript_zh && <p>{transcript_zh}</p>}</section>}

            {attentionCheckOpen && createPortal(
                <div className="listening-attention-overlay" role="dialog" aria-modal="true" aria-label="確認仍在學習">
                    <section className="listening-attention-card">
                        <span aria-hidden="true">🎧</span>
                        <h2>還在學習嗎？</h2>
                        {attentionExpired ? (
                            <p>剛才沒有收到回應，這個工作階段不會發放獎勵。重新播放後會建立新的有效聆聽紀錄。</p>
                        ) : (
                            <p>播放器已暫停。請在 <strong>{attentionSecondsLeft} 秒</strong>內確認，避免掛機累積 XP 與 AE Points。</p>
                        )}
                        <button type="button" onClick={continueAfterAttentionCheck}>
                            {attentionExpired ? "重新開始這首" : "我還在學習"}
                        </button>
                    </section>
                </div>,
                document.body
            )}

            {isMobileExpanded && createPortal(
                <div className="mobile-player-overlay" role="dialog" aria-modal="true" aria-label="全螢幕播放器">
                    <button
                        type="button"
                        className="mobile-overlay-close"
                        onClick={() => {
                            setIsMobileOptionsOpen(false);
                            setIsMobileExpanded(false);
                        }}
                        aria-label="縮小播放器"
                    >
                        <MdKeyboardArrowDown aria-hidden="true" />
                    </button>
                    <div className="mobile-overlay-content">
                        <div className="mobile-overlay-art" aria-hidden="true">
                            <MdMusicNote />
                        </div>
                        <div className="mobile-overlay-title">
                            <strong>{bookname || "未命名教材"}{page ? ` · ${page}` : ""}</strong>
                            <span>{sessionIneligible ? "加速播放中，這段不計入次數" : `有效聆聽 ${Math.floor(coveragePercent)}%`}</span>
                        </div>
                        {masteryText && <div className="mobile-overlay-mastery"><strong>{masteryText.title}</strong><p>{masteryText.detail}</p></div>}
                        <div className="mobile-overlay-progress">
                            <input
                                type="range"
                                min="0"
                                max={Math.max(audioDuration, 1)}
                                step="0.1"
                                value={Math.min(playbackPosition, Math.max(audioDuration, 1))}
                                onChange={handleOverlaySeek}
                                aria-label="播放進度"
                            />
                            <div>
                                <span>{formatTime(playbackPosition)}</span>
                                <span>{formatTime(audioDuration)}</span>
                            </div>
                        </div>
                        <div className="mobile-overlay-controls">
                            <button type="button" onClick={handleClickPrev} aria-label="上一首">
                                <MdSkipPrevious aria-hidden="true" />
                            </button>
                            <button type="button" className="mobile-overlay-play" onClick={togglePlayback} aria-label={isPlaybackActive ? "暫停" : "播放"}>
                                {isPlaybackActive
                                    ? <MdPause aria-hidden="true" />
                                    : <MdPlayArrow aria-hidden="true" />}
                            </button>
                            <button type="button" onClick={handleClickNext} aria-label="下一首">
                                <MdSkipNext aria-hidden="true" />
                            </button>
                        </div>
                        <div className="mobile-overlay-actions">
                            {hasTranscript && <button type="button" className={transcriptMode !== "none" ? "is-active" : ""} onClick={cycleTranscript} aria-label="切換字幕與逐字稿"><MdClosedCaption aria-hidden="true" /></button>}
                            <button
                                type="button"
                                className={trackReaction === "like" ? "is-active" : ""}
                                onClick={() => toggleTrackReaction("like")}
                                aria-label="喜歡這個音檔"
                                aria-pressed={trackReaction === "like"}
                            >
                                {trackReaction === "like"
                                    ? <MdThumbUp aria-hidden="true" />
                                    : <MdThumbUpOffAlt aria-hidden="true" />}
                            </button>
                            <button
                                type="button"
                                className={trackReaction === "dislike" ? "is-active" : ""}
                                onClick={() => toggleTrackReaction("dislike")}
                                aria-label="不喜歡這個音檔"
                                aria-pressed={trackReaction === "dislike"}
                            >
                                {trackReaction === "dislike"
                                    ? <MdThumbDown aria-hidden="true" />
                                    : <MdThumbDownOffAlt aria-hidden="true" />}
                            </button>
                            <div className="mobile-player-options" ref={mobileOptionsRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDesktopOptionsOpen(false);
                                        setIsMobileOptionsOpen(current => !current);
                                    }}
                                    aria-label="更多播放設定"
                                    aria-haspopup="dialog"
                                    aria-expanded={isMobileOptionsOpen}
                                >
                                    <MdMoreVert aria-hidden="true" />
                                </button>
                                {isMobileOptionsOpen && (
                                    <PlayerOptionsPanel
                                        repeatTrack={repeatTrack}
                                        playbackRate={playbackRate}
                                        onToggleRepeat={() => setRepeatTrack(current => !current)}
                                        onSelectRate={handleOptionsPlaybackRateChange}
                                    />
                                )}
                            </div>
                        </div>
                        {hasTranscript && transcriptMode !== "none" && <section className="mobile-transcript-panel"><header><strong>{transcriptMode === "en" ? "英文字幕" : transcriptMode === "zh" ? "中文提示" : "完整逐字稿"}</strong><button type="button" onClick={() => setTranscriptMode("none")}>關閉</button></header>{(transcriptMode === "en" || transcriptMode === "full") && transcript_en && <p lang="en">{transcript_en}</p>}{(transcriptMode === "zh" || transcriptMode === "full") && transcript_zh && <p>{transcript_zh}</p>}</section>}
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}

export default MusicPlayer;
