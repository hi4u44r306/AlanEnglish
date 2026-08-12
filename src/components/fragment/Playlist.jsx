import React, { useEffect, useMemo, useState } from 'react';
import '../assets/scss/Playlist.scss';
import MusicCard from "./MusicCard";
import { useParams } from 'react-router-dom';
import { supabase } from "../Pages/supabase-config";
import { useAuth } from "../../auth/AuthContext";
import { getBookPlaybackProgress } from "../../services/listeningService";

const Playlist = () => {
    const { playlistId } = useParams();
    const { firebaseUser, role } = useAuth();
    const [tracks, setTracks] = useState([]);
    const [bookName, setBookName] = useState('');
    const [progressMap, setProgressMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const fetchPlaylist = async () => {
            try {
                setLoading(true);
                setErrorMessage('');
                setProgressMap({});

                const { data: bookData, error: bookError } = await supabase
                    .from('books')
                    .select('id, name, code')
                    .eq('code', playlistId)
                    .single();

                if (bookError) {
                    console.error('讀取 books 發生錯誤:', bookError);
                    setErrorMessage('找不到這本教材');
                    return;
                }

                setBookName(bookData.name);

                const { data: trackData, error: trackError } = await supabase
                    .from('music_tracks')
                    .select('*')
                    .eq('book_id', bookData.id)
                    .eq('enabled', true)
                    .order('sort_order', { ascending: true });

                if (trackError) {
                    console.error('讀取 music_tracks 發生錯誤:', trackError);
                    setErrorMessage('讀取音檔資料失敗');
                    return;
                }

                const convertedTracks = (trackData || []).map(track => {
                    const { data: publicUrlData } = supabase.storage
                        .from('music')
                        .getPublicUrl(track.audio_url);

                    return {
                        id: track.id,
                        book_id: track.book_id,
                        page: track.page,
                        title: track.title,
                        sort_order: track.sort_order,
                        bookname: bookData.name,
                        type: playlistId,
                        musicName: track.music_name,
                        audioURL: publicUrlData.publicUrl,
                        audio_url: publicUrlData.publicUrl,
                        image: track.image
                    };
                });

                setTracks(convertedTracks);

                if (firebaseUser && role === 'student') {
                    try {
                        const result = await getBookPlaybackProgress(firebaseUser, bookData.id);
                        const nextProgressMap = {};

                        (result?.progress || []).forEach(item => {
                            nextProgressMap[String(item.track_id)] = {
                                playCount: Number(item.play_count) || 0,
                                completed: Boolean(item.completed),
                                completedAt: item.completed_at || null,
                                lastPlayedAt: item.last_played_at || null
                            };
                        });

                        setProgressMap(nextProgressMap);
                    } catch (progressError) {
                        console.error('讀取播放進度失敗:', progressError);
                    }
                }
            } catch (error) {
                console.error('Playlist 發生未知錯誤:', error);
                setErrorMessage('載入教材時發生錯誤');
            } finally {
                setLoading(false);
            }
        };

        if (playlistId) fetchPlaylist();
    }, [playlistId, firebaseUser, role]);

    useEffect(() => {
        const handleProgressUpdated = event => {
            const progress = event?.detail;
            if (!progress?.track_id) return;

            setProgressMap(current => ({
                ...current,
                [String(progress.track_id)]: {
                    ...current[String(progress.track_id)],
                    playCount: Number(progress.play_count) || 0,
                    completed: Boolean(progress.completed)
                }
            }));
        };

        window.addEventListener('ae:track-progress-updated', handleProgressUpdated);
        return () => window.removeEventListener('ae:track-progress-updated', handleProgressUpdated);
    }, []);

    const playlistStats = useMemo(() => {
        const completedTracks = tracks.filter(track => progressMap[String(track.id)]?.completed).length;

        return {
            total: tracks.length,
            completed: completedTracks
        };
    }, [tracks, progressMap]);

    if (loading) {
        return (
            <div className="Playlist">
                <div className="playlisttitle">載入中...</div>
            </div>
        );
    }

    if (errorMessage) {
        return (
            <div className="Playlist">
                <div className="playlisttitle">{errorMessage}</div>
            </div>
        );
    }

    return (
        <div className="Playlist">
            <div className="playlisttitle">
                {bookName || playlistId}
                {role === 'student' && tracks.length > 0 ? `（完成 ${playlistStats.completed} / ${playlistStats.total}）` : ''}
            </div>

            <div className="Playlist-container">
                {tracks.length > 0 ? tracks.map(item => (
                    <MusicCard
                        key={item.id}
                        music={item}
                        progress={progressMap[String(item.id)] || null}
                    />
                )) : (
                    <div>目前沒有音檔</div>
                )}
            </div>
        </div>
    );
};

export default Playlist;