import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import MusicCard from "./MusicCard";
import "../assets/scss/Playlist.scss";
import { supabase } from "../Pages/supabase-config";
import { useAuth } from "../../auth/AuthContext";
import { getBookPlaybackProgress } from "../../services/listeningService";

const PLAYLIST_CACHE_PREFIX = "ae-playlist-cache:";

function Playlist() {
    const { playlistId } = useParams();
    const { firebaseUser, role } = useAuth();
    const [book, setBook] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [progressMap, setProgressMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let cancelled = false;
        const cacheKey = `${PLAYLIST_CACHE_PREFIX}${playlistId}`;
        let hasCachedContent = false;

        const restoreCache = () => {
            try {
                const raw = sessionStorage.getItem(cacheKey);
                if (!raw) return;

                const cached = JSON.parse(raw);
                if (!cached?.book || !Array.isArray(cached?.tracks)) return;

                hasCachedContent = true;
                setBook(cached.book);
                setTracks(cached.tracks);
                setLoading(false);
            } catch (error) {
                console.warn("Playlist 快取讀取失敗:", error);
                sessionStorage.removeItem(cacheKey);
            }
        };

        const fetchPlaylist = async () => {
            if (!playlistId) return;

            if (!hasCachedContent) setLoading(true);
            setErrorMessage("");

            try {
                const { data: bookData, error: bookError } = await supabase
                    .from("books")
                    .select("id,name,code,category_id,sort_order,enabled")
                    .eq("code", playlistId)
                    .eq("enabled", true)
                    .maybeSingle();

                if (bookError) throw bookError;
                if (!bookData) throw new Error("找不到這本教材");

                const { data: trackData, error: trackError } = await supabase
                    .from("music_tracks")
                    .select("id,book_id,page,title,music_name,audio_url,image,sort_order,enabled")
                    .eq("book_id", bookData.id)
                    .eq("enabled", true)
                    .order("sort_order", { ascending: true });

                if (trackError) throw trackError;

                const convertedTracks = (trackData || []).map(track => {
                    const { data: publicUrlData } = supabase.storage
                        .from("music")
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

                if (cancelled) return;

                setBook(bookData);
                setTracks(convertedTracks);
                setLoading(false);

                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        book: bookData,
                        tracks: convertedTracks,
                        cachedAt: Date.now()
                    }));
                } catch (cacheError) {
                    console.warn("Playlist 快取寫入失敗:", cacheError);
                }
            } catch (error) {
                console.error("Playlist 載入失敗:", error);

                if (cancelled) return;

                if (!hasCachedContent) {
                    setBook(null);
                    setTracks([]);
                    setErrorMessage(error?.message || "教材載入失敗");
                    setLoading(false);
                }
            }
        };

        restoreCache();
        fetchPlaylist();

        return () => {
            cancelled = true;
        };
    }, [playlistId]);

    useEffect(() => {
        let cancelled = false;

        const fetchProgress = async () => {
            if (!firebaseUser || role !== "student" || !book?.id) {
                setProgressMap({});
                return;
            }

            try {
                const result = await getBookPlaybackProgress(firebaseUser, book.id);
                if (cancelled) return;

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
            } catch (error) {
                console.error("讀取播放進度失敗:", error);
            }
        };

        fetchProgress();

        return () => {
            cancelled = true;
        };
    }, [firebaseUser, role, book?.id]);

    useEffect(() => {
        const handleProgressUpdated = event => {
            const progress = event?.detail;
            const trackId = progress?.track_id || progress?.result_track_id;
            if (!trackId) return;

            setProgressMap(current => ({
                ...current,
                [String(trackId)]: {
                    ...current[String(trackId)],
                    playCount: Number(progress.play_count) || 0,
                    completed: Boolean(progress.completed),
                    dailyCount: Number(progress.daily_count) || 0,
                    monthlyCount: Number(progress.monthly_count) || 0,
                    totalCount: Number(progress.total_count) || 0
                }
            }));
        };

        window.addEventListener("ae:track-progress-updated", handleProgressUpdated);
        return () => window.removeEventListener("ae:track-progress-updated", handleProgressUpdated);
    }, []);

    const stats = useMemo(() => {
        const completed = tracks.filter(track =>
            Boolean(progressMap[String(track.id)]?.completed)
        ).length;

        const totalPlayCount = tracks.reduce((total, track) => {
            return total + Number(progressMap[String(track.id)]?.playCount || 0);
        }, 0);

        return {
            total: tracks.length,
            completed,
            totalPlayCount
        };
    }, [tracks, progressMap]);

    if (loading) {
        return (
            <div className="playlist-loading">
                <div className="playlist-loading__icon">🎧</div>
                <div>音檔載入中...</div>
            </div>
        );
    }

    if (errorMessage) {
        return (
            <div className="playlist-error">
                <h2>讀取失敗</h2>
                <p>{errorMessage}</p>
            </div>
        );
    }

    return (
        <div className="playlist-page">
            <div className="playlist-content">
                <header className="playlist-header">
                    <div className="playlist-header__main">
                        <h1>{book?.name || playlistId}</h1>

                        {role === "student" && (
                            <div className="playlist-header__stats">
                                <span>完成 {stats.completed} / {stats.total}</span>
                                <span className="playlist-header__dot">·</span>
                                <span>累計播放 {stats.totalPlayCount} 次</span>
                            </div>
                        )}
                    </div>
                </header>

                <section className="playlist-list-section">
                    <div className="playlist-list">
                        {tracks.length > 0 ? tracks.map(track => (
                            <MusicCard
                                key={track.id}
                                music={track}
                                progress={progressMap[String(track.id)] || {}}
                            />
                        )) : (
                            <div className="playlist-empty">目前沒有音檔</div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default Playlist;
