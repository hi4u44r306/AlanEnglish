import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Check, Headphones } from "lucide-react";
import MusicCard from "./MusicCard";
import "../assets/scss/Playlist.scss";
import { supabase } from "../Pages/supabase-config";
import { useAuth } from "../../auth/AuthContext";
import { getBookPlaybackProgress } from "../../services/listeningService";

const PLAYLIST_CACHE_PREFIX = "ae-playlist-cache:";
const getPlaylistCacheKey = playlistId => `${PLAYLIST_CACHE_PREFIX}${playlistId}`;

function readPlaylistCache(playlistId) {
    try {
        const raw = sessionStorage.getItem(getPlaylistCacheKey(playlistId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.book || !Array.isArray(parsed.tracks)) return null;
        return parsed;
    } catch (error) {
        console.warn("讀取 Playlist 快取失敗:", error);
        return null;
    }
}

function writePlaylistCache(playlistId, book, tracks) {
    try {
        sessionStorage.setItem(getPlaylistCacheKey(playlistId), JSON.stringify({ book, tracks, cachedAt: Date.now() }));
    } catch (error) {
        console.warn("寫入 Playlist 快取失敗:", error);
    }
}

function Playlist() {
    const { playlistId } = useParams();
    const location = useLocation();
    const { firebaseUser, role } = useAuth();
    const [book, setBook] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [progressMap, setProgressMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const homeworkContext = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const assignmentId = params.get("assignment") || "";
        const trackIds = (params.get("tracks") || "").split(",").map(value => value.trim()).filter(Boolean);
        const requiredListens = Math.max(1, Number(params.get("required")) || 7);
        return { assignmentId, trackIds, requiredListens, active: Boolean(assignmentId && trackIds.length) };
    }, [location.search]);

    const homeworkTrackSet = useMemo(() => new Set(homeworkContext.trackIds.map(String)), [homeworkContext.trackIds]);

    useEffect(() => {
        let cancelled = false;
        const fetchPlaylist = async () => {
            if (!playlistId) return;
            setErrorMessage("");
            const cached = readPlaylistCache(playlistId);
            if (cached) {
                setBook(cached.book);
                setTracks(cached.tracks);
                setLoading(false);
            } else {
                setLoading(true);
            }
            try {
                const { data: bookData, error: bookError } = await supabase.from("books").select("id,name,code,category_id,sort_order,enabled").eq("code", playlistId).eq("enabled", true).maybeSingle();
                if (cancelled) return;
                if (bookError) throw bookError;
                if (!bookData) throw new Error("找不到這本教材");
                const { data: trackData, error: trackError } = await supabase.from("music_tracks").select("*").eq("book_id", bookData.id).eq("enabled", true).order("sort_order", { ascending: true });
                if (cancelled) return;
                if (trackError) throw trackError;
                const convertedTracks = (trackData || []).map(track => {
                    const { data: publicUrlData } = supabase.storage.from("music").getPublicUrl(track.audio_url);
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
                writePlaylistCache(playlistId, bookData, convertedTracks);
                if (firebaseUser && role === "student") {
                    getBookPlaybackProgress(firebaseUser, bookData.id).then(result => {
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
                    }).catch(progressError => console.error("背景讀取播放紀錄失敗:", progressError));
                } else {
                    setProgressMap({});
                }
            } catch (error) {
                console.error("Playlist 載入失敗:", error);
                if (!cached) {
                    setErrorMessage(error?.message || "教材載入失敗");
                    setBook(null);
                    setTracks([]);
                    setLoading(false);
                }
            }
        };
        fetchPlaylist();
        return () => { cancelled = true; };
    }, [playlistId, firebaseUser, role]);

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
        const completedCount = tracks.filter(track => Boolean(progressMap[String(track.id)]?.completed)).length;
        const totalPlayCount = tracks.reduce((total, track) => total + Number(progressMap[String(track.id)]?.playCount || 0), 0);
        return { total: tracks.length, completed: completedCount, totalPlayCount };
    }, [tracks, progressMap]);

    const homeworkTracks = useMemo(() => tracks.filter(track => homeworkTrackSet.has(String(track.id))), [tracks, homeworkTrackSet]);
    const visibleTracks = homeworkContext.active ? homeworkTracks : tracks;
    const isHomeworkTrackCompleted = track => {
        const progress = progressMap[String(track.id)] || {};
        return Boolean(progress.completed) || Number(progress.playCount || 0) >= homeworkContext.requiredListens;
    };
    const homeworkCompletedCount = homeworkTracks.filter(isHomeworkTrackCompleted).length;
    const homeworkCompletionRate = homeworkTracks.length ? Math.round((homeworkCompletedCount / homeworkTracks.length) * 100) : 0;

    if (loading && tracks.length === 0) return <div className="playlist-loading"><div className="playlist-loading__icon">🎧</div><div>音檔載入中...</div></div>;
    if (errorMessage && tracks.length === 0) return <div className="playlist-error"><h2>讀取失敗</h2><p>{errorMessage}</p></div>;

    return (
        <div className="playlist-page">
            <div className="playlist-content">
                <header className="playlist-header">
                    <div className="playlist-header__main">
                        <div>
                            {homeworkContext.active && (
                                <Link className="playlist-homework-back" to="/student/assignments">
                                    <ArrowLeft aria-hidden="true" size={16} />
                                    返回今日作業
                                </Link>
                            )}
                            <h1>{book?.name || playlistId}</h1>
                        </div>
                        {role === "student" && (
                            <div className="playlist-header__stats">
                                <span>{homeworkContext.active ? `本次完成 ${homeworkCompletedCount} / ${homeworkTracks.length || homeworkContext.trackIds.length}` : `完成 ${stats.completed} / ${stats.total}`}</span>
                                <span className="playlist-header__dot">·</span>
                                <span>累計播放 {stats.totalPlayCount} 次</span>
                            </div>
                        )}
                    </div>
                </header>

                {homeworkContext.active && (
                    <section className="playlist-homework-banner">
                        <div className="playlist-homework-banner__icon">
                            <Headphones aria-hidden="true" size={25} />
                        </div>
                        <div className="playlist-homework-banner__copy">
                            <span>TODAY'S HOMEWORK</span>
                            <h2>今天的指定聽力</h2>
                            <p>這裡只顯示老師指定的 {homeworkTracks.length || homeworkContext.trackIds.length} 個音檔，逐一完成就可以回到今日作業。</p>
                            <div className="playlist-homework-chips">
                                {(homeworkTracks.length ? homeworkTracks : tracks.filter(track => homeworkTrackSet.has(String(track.id)))).map(track => {
                                    const completed = isHomeworkTrackCompleted(track);
                                    return (
                                        <strong className={completed ? "completed" : ""} key={track.id}>
                                            {completed && <Check aria-hidden="true" size={12} />}
                                            {track.page || track.title || "音檔"}
                                        </strong>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="playlist-homework-progress" role="progressbar" aria-label="指定聽力完成進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={homeworkCompletionRate}>
                            <strong>{homeworkCompletionRate}%</strong>
                            <span>{homeworkCompletedCount} / {homeworkTracks.length || homeworkContext.trackIds.length} 完成</span>
                            <div aria-hidden="true"><span style={{ width: `${homeworkCompletionRate}%` }} /></div>
                        </div>
                    </section>
                )}

                <section className="playlist-list-section">
                    <div className="playlist-list">
                        {visibleTracks.length > 0 ? visibleTracks.map(track => (
                            <div className={homeworkTrackSet.has(String(track.id)) ? "playlist-homework-track" : ""} key={track.id}>
                                {homeworkTrackSet.has(String(track.id)) && <div className="playlist-homework-track__label">本日任務</div>}
                                <MusicCard
                                    music={track}
                                    playbackQueue={visibleTracks}
                                    progress={progressMap[String(track.id)] || {}}
                                />
                            </div>
                        )) : <div className="playlist-empty">目前沒有音檔</div>}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default Playlist;
