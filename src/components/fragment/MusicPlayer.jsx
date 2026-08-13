import AudioPlayer, { RHAP_UI } from "react-h5-audio-player";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import {
    setCurrentPlaying,
    setPlayPauseStatus,
    setNoInteractionCount
} from "../../actions/actions";
import { toast, ToastContainer } from "react-toastify";
import Name from "./Name";
import "../assets/scss/FooterPlayer.scss";
import "react-h5-audio-player/lib/styles.css";
import { supabase } from "../Pages/supabase-config";
import { useAuth } from "../../auth/AuthContext";
import { recordTrackPlay } from "../../services/listeningService";

const NO_INTERACTION_STORAGE_KEY = "ae-no-interaction";
const NO_INTERACTION_WARNING_COUNT = 5;
const NO_INTERACTION_STOP_COUNT = 10;

function MusicPlayer({ music }) {
    const dispatch = useDispatch();
    const audioElement = useRef(null);
    const automaticTrackChangeRef = useRef(false);
    const internalTrackChangeRef = useRef(false);
    const pendingPlaybackRef = useRef(Boolean(music));

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

    const {
        id: trackId,
        bookname,
        page,
        audioURL,
        book_id
    } = currTrack || {};

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

            if (!book_id) {
                setPlaylist(
                    []
                );

                return;
            }

            const {
                data,
                error
            } = await supabase
                .from(
                    "music_tracks"
                )
                .select(
                    "*"
                )
                .eq(
                    "book_id",
                    book_id
                )
                .eq(
                    "enabled",
                    true
                )
                .order(
                    "sort_order",
                    {
                        ascending: true
                    }
                );

            if (error) {
                console.error(
                    "MusicPlayer 讀取 Playlist 失敗:",
                    error
                );

                return;
            }

            const convertedTracks = (
                data ||
                []
            ).map(track => {
                const {
                    data: publicUrlData
                } = supabase.storage
                    .from(
                        "music"
                    )
                    .getPublicUrl(
                        track.audio_url
                    );

                return {
                    id:
                        track.id,
                    book_id:
                        track.book_id,
                    page:
                        track.page,
                    title:
                        track.title,
                    sort_order:
                        track.sort_order,
                    bookname:
                        bookname,
                    musicName:
                        track.music_name,
                    audioURL:
                        publicUrlData.publicUrl,
                    audio_url:
                        publicUrlData.publicUrl,
                    image:
                        track.image,
                    type:
                        music?.type
                };
            });

            setPlaylist(
                convertedTracks
            );
        };

        fetchPlaylist();
    }, [
        book_id,
        bookname,
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

    const saveCompletedPlay = async () => {
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

        try {
            const result =
                await recordTrackPlay(
                    firebaseUser,
                    trackId
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

    const handleEnd = () => {
        console.log(
            "Track End:",
            currTrack
        );

        // =================================
        // 一定先記錄現在這首
        // =================================

        void saveCompletedPlay();

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

        resetNoInteraction();
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
            <AudioPlayer
                autoPlay={true}
                autoPlayAfterSrcChange={true}
                preload="auto"
                volume={0.5}
                loop={false}
                progressUpdateInterval={50}
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
                onCanPlay={event => {
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
                    RHAP_UI.CURRENT_TIME,
                    <div
                        key="music-name"
                        className="footer-track-name"
                        style={{
                            display:
                                "flex",
                            gap:
                                "5px",
                            alignItems:
                                "center"
                        }}
                    >
                        <Name
                            name={
                                bookname ||
                                ""
                            }
                            className="marqueename"
                            length={
                                bookname
                                    ? bookname.length
                                    : 0
                            }
                        />

                        <Name
                            name={
                                page ||
                                ""
                            }
                            className="marqueename"
                            length={
                                page
                                    ? page.length
                                    : 0
                            }
                        />
                    </div>,
                    RHAP_UI.DURATION
                ]}
                customControlsSection={[
                    RHAP_UI.MAIN_CONTROLS,
                    RHAP_UI.VOLUME_CONTROLS
                ]}
            />

            <ToastContainer
                position="top-center"
                autoClose={2000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
        </div>
    );
}

export default MusicPlayer;
