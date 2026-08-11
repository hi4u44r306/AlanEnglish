import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import React, { useRef, useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import {
    setCurrentPlaying,
    setPlayPauseStatus
} from "../../actions/actions";
import { toast, ToastContainer } from "react-toastify";
import Name from "./Name";
import '../assets/scss/FooterPlayer.scss';
import 'react-h5-audio-player/lib/styles.css';
import { rtdb } from '../Pages/firebase-config';
import { get, ref, set, update } from 'firebase/database';
import { supabase } from "../Pages/supabase-config";

function MusicPlayer({ music }) {
    const dispatch = useDispatch();
    const audioElement = useRef();
    const userId = localStorage.getItem('ae-useruid');
    const [currTrack, setCurrTrack] = useState(music);
    const [playlist, setPlaylist] = useState([]);
    const {
        bookname,
        page,
        // musicName,
        audioURL,
        book_id
    } = currTrack || {};

    // =====================================================
    // Music 改變時更新目前歌曲
    // =====================================================
    useEffect(() => {
        if (!music) return;
        console.log("Footer 收到歌曲:", music);
        console.log("Footer Supabase URL:", music.audioURL);
        setCurrTrack(music);
    }, [music]);

    // =====================================================
    // 從 Supabase 取得這本書完整 Playlist
    // 用於上一首 / 下一首 / 自動播放
    // =====================================================
    useEffect(() => {
        const fetchPlaylist = async () => {
            if (!book_id) {
                return;
            }

            const { data, error } = await supabase
                .from('music_tracks')
                .select('*')
                .eq('book_id', book_id)
                .eq('enabled', true)
                .order('sort_order', {
                    ascending: true
                });

            if (error) {
                console.error(
                    "Footer 讀取 Supabase Playlist 失敗:",
                    error
                );
                return;
            }

            const convertedTracks = (data || []).map(track => {
                const {
                    data: publicUrlData
                } = supabase.storage
                    .from('music')
                    .getPublicUrl(track.audio_url);

                return {
                    id: track.id,
                    book_id: track.book_id,
                    page: track.page,
                    title: track.title,
                    sort_order: track.sort_order,
                    bookname: bookname,
                    musicName: track.music_name,
                    audioURL: publicUrlData.publicUrl,
                    audio_url: publicUrlData.publicUrl,
                    image: track.image,
                    type: music?.type
                };
            });

            console.log(
                "Footer Supabase Playlist:",
                convertedTracks
            );

            setPlaylist(convertedTracks);
        };

        fetchPlaylist();
    }, [
        book_id,
        bookname,
        music?.type
    ]);

    // =====================================================
    // Toast
    // =====================================================
    const success = () => {
        toast.success(
            `聽力次數 + 1`,
            {
                className: "musicnotification",
                position: "top-center",
                autoClose: 1500,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: false,
                draggable: true,
                theme: "colored"
            }
        );
    };

    // =====================================================
    // 目前暫時保留 Firebase RTDB 的播放紀錄
    // 之後再搬 Supabase
    // =====================================================
    const updateTimePlayedToRealtimeDatabase = async () => {
        if (!userId || !bookname || !page) {
            return;
        }

        const convertMusicName = `${bookname} ${page}`;

        try {
            // ---------------------------------
            // 單曲播放次數
            // ---------------------------------
            const musicRef = ref(
                rtdb,
                `/student/${userId}/MusicLogfile/${convertMusicName}/`
            );

            const snapshot = await get(musicRef);

            const currentMusicPlay =
                snapshot.exists()
                    ? snapshot.val().musicplay || 0
                    : 0;

            const newMusicPlay = currentMusicPlay + 1;

            if (newMusicPlay >= 100) {
                await update(
                    musicRef,
                    {
                        musicplay: newMusicPlay,
                        complete: '通過'
                    }
                );
            } else {
                await update(
                    musicRef,
                    {
                        musicplay: newMusicPlay
                    }
                );
            }

            // ---------------------------------
            // 每日播放次數
            // ---------------------------------
            const dayRef = ref(
                rtdb,
                `/student/${userId}/Daytotaltimeplayed`
            );

            const daySnapshot = await get(dayRef);

            const currentDay =
                daySnapshot.exists()
                    ? Number(daySnapshot.val()) || 0
                    : 0;

            await set(
                dayRef,
                currentDay + 1
            );

            // ---------------------------------
            // 每月播放次數
            // ---------------------------------
            const monthRef = ref(
                rtdb,
                `/student/${userId}/Monthtotaltimeplayed`
            );

            const monthSnapshot = await get(monthRef);

            const currentMonth =
                monthSnapshot.exists()
                    ? Number(monthSnapshot.val()) || 0
                    : 0;

            await set(
                monthRef,
                currentMonth + 1
            );

        } catch (error) {
            console.error(
                "更新播放紀錄失敗:",
                error
            );
        }
    };

    // =====================================================
    // 找目前歌曲 index
    // =====================================================
    const getCurrentIndex = () => {
        if (
            !playlist ||
            playlist.length === 0
        ) {
            return -1;
        }

        return playlist.findIndex(
            track =>
                track.id === currTrack?.id ||
                (
                    track.bookname === bookname &&
                    track.page === page
                )
        );
    };

    // =====================================================
    // 下一首
    // =====================================================
    const handleClickNext = () => {
        if (playlist.length === 0) {
            return;
        }

        const currentIndex = getCurrentIndex();

        if (currentIndex === -1) {
            console.error("找不到目前歌曲");
            return;
        }

        const nextIndex =
            (currentIndex + 1)
            % playlist.length;

        const nextTrack = playlist[nextIndex];

        console.log(
            "下一首:",
            nextTrack
        );

        setCurrTrack(nextTrack);

        dispatch(
            setCurrentPlaying(
                nextTrack
            )
        );

        dispatch(
            setPlayPauseStatus(true)
        );
    };

    // =====================================================
    // 上一首
    // =====================================================
    const handleClickPrev = () => {
        if (playlist.length === 0) {
            return;
        }

        const currentIndex = getCurrentIndex();

        if (currentIndex === -1) {
            console.error("找不到目前歌曲");
            return;
        }

        const prevIndex =
            (
                currentIndex
                - 1
                + playlist.length
            )
            % playlist.length;

        const prevTrack = playlist[prevIndex];

        console.log(
            "上一首:",
            prevTrack
        );

        setCurrTrack(prevTrack);

        dispatch(
            setCurrentPlaying(
                prevTrack
            )
        );

        dispatch(
            setPlayPauseStatus(true)
        );
    };

    // =====================================================
    // 播放結束
    // =====================================================
    const handleEnd = async () => {
        console.log(
            'Track End:',
            currTrack
        );

        success();

        // 播放完成才 +1
        await updateTimePlayedToRealtimeDatabase();

        if (playlist.length === 0) {
            return;
        }

        const currentIndex = getCurrentIndex();

        if (currentIndex === -1) {
            return;
        }

        const nextIndex =
            (
                currentIndex + 1
            )
            % playlist.length;

        const nextTrack = playlist[nextIndex];

        setCurrTrack(nextTrack);

        dispatch(
            setCurrentPlaying(
                nextTrack
            )
        );

        dispatch(
            setPlayPauseStatus(true)
        );
    };

    // =====================================================
    // Render
    // =====================================================
    if (!currTrack) {
        return null;
    }

    return (
        <div className="footer-player">
            <AudioPlayer
                autoPlay={true}
                volume={0.5}
                loop={false}
                progressUpdateInterval={50}
                ref={audioElement}
                src={audioURL || ''}
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
                onPlay={() => {
                    console.log(
                        "正在播放 Supabase:",
                        audioURL
                    );

                    dispatch(
                        setPlayPauseStatus(true)
                    );
                }}
                onPause={() => {
                    dispatch(
                        setPlayPauseStatus(false)
                    );
                }}
                onError={(event) => {
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
                        style={{
                            display: 'flex',
                            gap: '5px'
                        }}
                    >
                        <Name
                            name={
                                bookname || ''
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
                                page || ''
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