import AudioPlayer, {
    RHAP_UI
} from "react-h5-audio-player";

import React, {
    useEffect,
    useRef,
    useState
} from "react";

import { useDispatch } from "react-redux";

import {
    setCurrentPlaying,
    setPlayPauseStatus
} from "../../actions/actions";

import {
    toast,
    ToastContainer
} from "react-toastify";

import Name from "./Name";

import "../assets/scss/FooterPlayer.scss";
import "react-h5-audio-player/lib/styles.css";

import {
    supabase
} from "../Pages/supabase-config";

import {
    useAuth
} from "../../auth/AuthContext";

import {
    recordTrackPlay
} from "../../services/listeningService";

function MusicPlayer({
    music
}) {
    const dispatch =
        useDispatch();

    const audioElement =
        useRef(null);

    const {
        firebaseUser,
        role
    } = useAuth();

    const [
        currTrack,
        setCurrTrack
    ] = useState(
        music
    );

    const [
        playlist,
        setPlaylist
    ] = useState([]);

    const {
        id: trackId,
        bookname,
        page,
        audioURL,
        book_id
    } = currTrack || {};

    // =====================================
    // Redux music 改變
    // =====================================

    useEffect(() => {
        if (!music) {
            return;
        }

        setCurrTrack(
            music
        );
    }, [music]);

    // =====================================
    // 讀取目前這本書全部音檔
    // =====================================

    useEffect(() => {
        const fetchPlaylist =
            async () => {
                if (!book_id) {
                    setPlaylist(
                        []
                    );
                    return;
                }

                const {
                    data,
                    error
                } =
                    await supabase
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
                                ascending:
                                    true
                            }
                        );

                if (error) {
                    console.error(
                        "MusicPlayer 讀取 Playlist 失敗:",
                        error
                    );

                    return;
                }

                const convertedTracks =
                    (
                        data ||
                        []
                    ).map(
                        track => {
                            const {
                                data:
                                publicUrlData
                            } =
                                supabase.storage
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
                        }
                    );

                setPlaylist(
                    convertedTracks
                );
            };

        fetchPlaylist();
    }, [
        book_id,
        bookname,
        music?.type
    ]);

    // =====================================
    // 成功 Toast
    // =====================================

    const showSuccessToast =
        () => {
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

    const saveCompletedPlay =
        async () => {
            // Teacher / Admin
            // 不累計學生紀錄
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
                    // =================================
                    // 讓 Playlist / MusicCard 立即更新
                    // =================================

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

    const getCurrentIndex =
        () => {
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

    const playTrack =
        track => {
            if (!track) {
                return;
            }

            setCurrTrack(
                track
            );

            dispatch(
                setCurrentPlaying(
                    track
                )
            );

            dispatch(
                setPlayPauseStatus(
                    true
                )
            );
        };

    // =====================================
    // 下一首
    // =====================================

    const handleClickNext =
        () => {
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
                nextTrack
            );
        };

    // =====================================
    // 上一首
    // =====================================

    const handleClickPrev =
        () => {
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
                prevTrack
            );
        };

    // =====================================
    // 播放完整首
    // =====================================

    const handleEnd =
        async () => {
            console.log(
                "Track End:",
                currTrack
            );

            // =================================
            // 一定先記錄現在這首
            // =================================

            await saveCompletedPlay();

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
                nextTrack
            );
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
                key={
                    currTrack.id ||
                    `${bookname}-${page}`
                }

                autoPlay={
                    true
                }

                volume={
                    0.5
                }

                loop={
                    false
                }

                progressUpdateInterval={
                    50
                }

                ref={
                    audioElement
                }

                src={
                    audioURL ||
                    ""
                }

                showSkipControls={
                    true
                }

                showJumpControls={
                    false
                }

                onClickNext={
                    handleClickNext
                }

                onClickPrevious={
                    handleClickPrev
                }

                onEnded={
                    handleEnd
                }

                onPlay={() => {
                    dispatch(
                        setPlayPauseStatus(
                            true
                        )
                    );
                }}

                onPause={() => {
                    dispatch(
                        setPlayPauseStatus(
                            false
                        )
                    );
                }}

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