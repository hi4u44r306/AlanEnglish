import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import {
    setCurrentPlaying,
    setPlayPauseStatus
} from "../../actions/actions";
import { toast, ToastContainer } from "react-toastify";
import Name from "./Name";
import '../assets/scss/FooterPlayer.scss';
import 'react-h5-audio-player/lib/styles.css';
import { supabase } from "../Pages/supabase-config";
import { useAuth } from "../../auth/AuthContext";
import { recordTrackPlay } from "../../services/listeningService";

function MusicPlayer({ music }) {
    const dispatch = useDispatch();
    const audioElement = useRef();
    const { firebaseUser, role } = useAuth();
    const [currTrack, setCurrTrack] = useState(music);
    const [playlist, setPlaylist] = useState([]);

    const {
        id: trackId,
        bookname,
        page,
        audioURL,
        book_id
    } = currTrack || {};

    useEffect(() => {
        if (!music) return;
        setCurrTrack(music);
    }, [music]);

    useEffect(() => {
        const fetchPlaylist = async () => {
            if (!book_id) return;

            const { data, error } = await supabase
                .from('music_tracks')
                .select('*')
                .eq('book_id', book_id)
                .eq('enabled', true)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error("Footer 讀取 Supabase Playlist 失敗:", error);
                return;
            }

            const convertedTracks = (data || []).map(track => {
                const { data: publicUrlData } = supabase.storage
                    .from('music')
                    .getPublicUrl(track.audio_url);

                return {
                    id: track.id,
                    book_id: track.book_id,
                    page: track.page,
                    title: track.title,
                    sort_order: track.sort_order,
                    bookname,
                    musicName: track.music_name,
                    audioURL: publicUrlData.publicUrl,
                    audio_url: publicUrlData.publicUrl,
                    image: track.image,
                    type: music?.type
                };
            });

            setPlaylist(convertedTracks);
        };

        fetchPlaylist();
    }, [book_id, bookname, music?.type]);

    const showPlayRecordedToast = () => {
        toast.success('聽力次數 + 1', {
            className: "musicnotification",
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            theme: "colored"
        });
    };

    const saveCompletedPlay = async () => {
        if (role !== 'student' || !firebaseUser || !trackId) return null;

        try {
            const result = await recordTrackPlay(firebaseUser, trackId);
            const progress = result?.progress || null;

            if (progress) {
                window.dispatchEvent(new CustomEvent('ae:track-progress-updated', {
                    detail: progress
                }));
            }

            showPlayRecordedToast();
            return progress;
        } catch (error) {
            console.error("更新 Supabase 播放紀錄失敗:", error);
            toast.error('播放完成，但紀錄更新失敗', {
                position: "top-center",
                autoClose: 2200
            });
            return null;
        }
    };

    const getCurrentIndex = () => {
        if (!playlist.length) return -1;

        return playlist.findIndex(track =>
            track.id === currTrack?.id ||
            (track.bookname === bookname && track.page === page)
        );
    };

    const playTrack = track => {
        if (!track) return;

        setCurrTrack(track);
        dispatch(setCurrentPlaying(track));
        dispatch(setPlayPauseStatus(true));
    };

    const handleClickNext = () => {
        if (!playlist.length) return;

        const currentIndex = getCurrentIndex();
        if (currentIndex === -1) return;

        const nextIndex = (currentIndex + 1) % playlist.length;
        playTrack(playlist[nextIndex]);
    };

    const handleClickPrev = () => {
        if (!playlist.length) return;

        const currentIndex = getCurrentIndex();
        if (currentIndex === -1) return;

        const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        playTrack(playlist[prevIndex]);
    };

    const handleEnd = async () => {
        await saveCompletedPlay();

        if (!playlist.length) return;

        const currentIndex = getCurrentIndex();
        if (currentIndex === -1) return;

        const nextIndex = (currentIndex + 1) % playlist.length;
        playTrack(playlist[nextIndex]);
    };

    if (!currTrack) return null;

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
                onClickNext={handleClickNext}
                onClickPrevious={handleClickPrev}
                onEnded={handleEnd}
                onPlay={() => dispatch(setPlayPauseStatus(true))}
                onPause={() => dispatch(setPlayPauseStatus(false))}
                onError={event => {
                    console.error("Audio 播放錯誤:", event);
                    console.error("音檔 URL:", audioURL);
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
                            name={bookname || ''}
                            className="marqueename"
                            length={bookname ? bookname.length : 0}
                        />
                        <Name
                            name={page || ''}
                            className="marqueename"
                            length={page ? page.length : 0}
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