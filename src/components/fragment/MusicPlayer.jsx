import AudioPlayer, { RHAP_UI } from "react-h5-audio-player";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    MdCheck,
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
import "../assets/scss/FooterPlayer.scss";
import "react-h5-audio-player/lib/styles.css";
import { useAuth } from "../../auth/AuthContext";
import {
    recordTrackPlay,
    startListeningSession
} from "../../services/listeningService";
import { getAccessibleBook } from "../../services/contentAccessService";

const NO_INTERACTION_STORAGE_KEY = "ae-no-interaction";
const NO_INTERACTION_WARNING_COUNT = 5;
const NO_INTERACTION_STOP_COUNT = 10;
const MINIMUM_LISTENING_COVERAGE = 80;
const MAX_NATURAL_LISTEN_GAP_SECONDS = 3;
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const formatTime = value => {
    const safeValue = Math.max(0, Number(value) || 0);
    const minutes = Math.floor(safeValue / 60);
    const seconds = Math.floor(safeValue % 60).toString().padStart(2, "0");

    return `${minutes}:${seconds}`;
};

const mergeCoverageRange = (ranges, nextRange) => {
    const sortedRanges = [...ranges, nextRange]
        .map(([start, end]) => [Math.max(0, start), Math.max(0, end)])
        .filter(([start, end]) => end > start)
        .sort((first, second) => first[0] - second[0]);

    return sortedRanges.reduce((mergedRanges, [start, end]) => {
        const previousRange = mergedRanges[mergedRanges.length - 1];

        if (!previousRange || start > previousRange[1] + 0.15) {
            mergedRanges.push([start, end]);
            return mergedRanges;
        }

        previousRange[1] = Math.max(previousRange[1], end);
        return mergedRanges;
    }, []);
};

const getCoveredSeconds = ranges => ranges.reduce(
    (total, [start, end]) => total + Math.max(0, end - start),
    0
);

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
    const isSeekingRef = useRef(false);
    const isAcceleratedPlaybackRef = useRef(false);
    const completionSentRef = useRef(false);
    const sessionStartedAtRef = useRef(null);
    const listeningSessionIdRef = useRef(null);
    const startingSessionRef = useRef(false);
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

    const {
        id: trackId,
        bookname,
        page,
        audioURL,
        book_id
    } = currTrack || {};

    const resetListeningSession = useCallback(() => {
        coverageRangesRef.current = [];
        lastListenTimeRef.current = null;
        isSeekingRef.current = false;
        isAcceleratedPlaybackRef.current = false;
        completionSentRef.current = false;
        sessionStartedAtRef.current = new Date().toISOString();
        listeningSessionIdRef.current = null;
        startingSessionRef.current = false;
        setCoveragePercent(0);
        setPlaybackRate(1);
        setSessionIneligible(false);
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

        if (
            nextCount ===
            NO_INTERACTION_WARNING_COUNT
        ) {
            toast.warning(
                "還在聽嗎？已經連續自動播放 5 首囉！",
                {
                    className:
                        "musicnotification",
                    position:
                        "top-center",
                    autoClose:
                        3500,
                    hideProgressBar:
                        false,
                    closeOnClick:
                        true,
                    pauseOnHover:
                        false,
                    draggable:
                        true,
                    theme:
                        "colored"
                }
            );
        }

        return nextCount;
    };

    // =====================================
    // 成功 Toast
    // =====================================

    const showSuccessToast = () => {
        toast.success(
            "🎧 聽力次數 + 1",
            {
                className:
                    "musicnotification",
                position:
                    "top-center",
                autoClose:
                    1800,
                hideProgressBar:
                    false,
                closeOnClick:
                    true,
                pauseOnHover:
                    false,
                draggable:
                    true,
                theme:
                    "colored"
            }
        );
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

        if (!listeningSessionIdRef.current) {
            console.warn("播放工作階段尚未建立，因此不計入聽力次數");
            return null;
        }

        if (coverage < MINIMUM_LISTENING_COVERAGE) {
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
                        used_accelerated_playback: false,
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

            showSuccessToast();

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
        let finalCoverage = coveragePercent;

        if (
            !isAcceleratedPlaybackRef.current &&
            Number.isFinite(lastListenTime) &&
            Number.isFinite(duration) &&
            duration > lastListenTime
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
        // 10 次直接停止
        // =================================

        if (
            nextNoInteractionCount >=
            NO_INTERACTION_STOP_COUNT
        ) {
            automaticTrackChangeRef.current =
                false;

            dispatch(
                setPlayPauseStatus(
                    false
                )
            );

            toast.info(
                "已連續自動播放 10 首，播放器已暫停。請按播放鍵繼續收聽。",
                {
                    className:
                        "musicnotification",
                    position:
                        "top-center",
                    autoClose:
                        5000,
                    hideProgressBar:
                        false,
                    closeOnClick:
                        true,
                    pauseOnHover:
                        false,
                    draggable:
                        true,
                    theme:
                        "colored"
                }
            );

            return;
        }

        if (repeatTrack) {
            audio.currentTime = 0;
            lastListenTimeRef.current = 0;
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

        const audio = audioElement.current?.audio?.current;
        if (audio) {
            setPlaybackPosition(audio.currentTime);
            setAudioDuration(audio.duration || 0);
        }
        if (audio && !Number.isFinite(lastListenTimeRef.current)) {
            lastListenTimeRef.current = audio.currentTime;
        }

        if (
            role === "student" &&
            firebaseUser &&
            trackId &&
            audio &&
            Number.isFinite(audio.duration) &&
            audio.duration > 0 &&
            !listeningSessionIdRef.current &&
            !startingSessionRef.current
        ) {
            startingSessionRef.current = true;

            void startListeningSession(
                firebaseUser,
                trackId,
                Number(audio.duration.toFixed(2))
            )
                .then(result => {
                    listeningSessionIdRef.current = result?.session?.id || null;
                })
                .catch(error => {
                    console.error("建立有效聆聽工作階段失敗:", error);
                })
                .finally(() => {
                    startingSessionRef.current = false;
                });
        }

        if (
            automaticTrackChangeRef.current
        ) {
            automaticTrackChangeRef.current =
                false;

            return;
        }

        resetNoInteraction();
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

        resetNoInteraction();
    };

    const handleListen = event => {
        const audio = event.currentTarget;
        const currentTime = Number(audio.currentTime);
        const duration = Number(audio.duration);
        const previousTime = lastListenTimeRef.current;

        if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) {
            return;
        }

        setPlaybackPosition(currentTime);
        setAudioDuration(duration);

        if (
            !isSeekingRef.current &&
            !isAcceleratedPlaybackRef.current &&
            Number.isFinite(previousTime) &&
            currentTime > previousTime &&
            currentTime - previousTime <= MAX_NATURAL_LISTEN_GAP_SECONDS
        ) {
            updateCoverage(previousTime, currentTime, duration);
        }

        lastListenTimeRef.current = currentTime;
    };

    const updatePlaybackRate = nextValue => {
        const nextRate = Number(nextValue);
        const audio = audioElement.current?.audio?.current;

        if (!PLAYBACK_RATES.includes(nextRate)) {
            return;
        }

        const isAccelerated = nextRate > 1;
        isAcceleratedPlaybackRef.current = isAccelerated;
        setSessionIneligible(isAccelerated);

        if (audio) {
            audio.playbackRate = nextRate;
            // 切換速度的瞬間不算作聆聽區段；回到正常速度後才重新累積。
            lastListenTimeRef.current = audio.currentTime;
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
                            : `有效聆聽 ${Math.floor(coveragePercent)}%`}
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
                }}
                onSeeked={event => {
                    isSeekingRef.current = false;
                    lastListenTimeRef.current = event.currentTarget.currentTime;
                    setPlaybackPosition(event.currentTarget.currentTime);
                }}
                onCanPlay={event => {
                    setAudioDuration(event.currentTarget.duration || 0);
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
                                    : `有效聆聽 ${Math.floor(coveragePercent)}%`}
                            </small>
                        </span>
                    </div>,
                    <div key="desktop-actions" className="desktop-player-actions">
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
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}

export default MusicPlayer;
