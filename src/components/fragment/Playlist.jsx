import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Check, Headphones } from "lucide-react";
import MusicCard from "./MusicCard";
import ListeningLearningPanel from "./ListeningLearningPanel";
import "../assets/scss/Playlist.scss";
import "../Pages/css/SpeakingAdventureSession.scss";
import "../assets/scss/ListeningLearning.scss";
import { useAuth } from "../../auth/AuthContext";
import { getBookPlaybackProgress } from "../../services/listeningService";
import { getAccessibleBook } from "../../services/contentAccessService";
import { hasReachedListeningMastery } from "../../constants/listeningProgress";
import { useDispatch, useSelector } from "react-redux";
import { setPlayPauseStatus } from "../../actions/actions";
import { speakingListeningContext } from "../../utils/speakingListening";

const PLAYLIST_CACHE_PREFIX = "ae-playlist-cache:";
const PLAYLIST_CACHE_TTL = 45 * 60 * 1000;
const getPlaylistCacheKey = playlistId => `${PLAYLIST_CACHE_PREFIX}${playlistId}`;

function readPlaylistCache(playlistId) {
    try {
        const raw = sessionStorage.getItem(getPlaylistCacheKey(playlistId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.book || !Array.isArray(parsed.tracks)) return null;
        if (!parsed.cachedAt || Date.now() - parsed.cachedAt > PLAYLIST_CACHE_TTL) {
            sessionStorage.removeItem(getPlaylistCacheKey(playlistId));
            return null;
        }
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
    const dispatch = useDispatch();
    const { firebaseUser, role } = useAuth();
    const [book, setBook] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [progressMap, setProgressMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [progressStatus, setProgressStatus] = useState("loading");
    const [progressRetry, setProgressRetry] = useState(0);
    const [confirmedListen, setConfirmedListen] = useState(null);
    const { playing, playingStatus } = useSelector(state => state.musicReducer);

    const homeworkContext = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const assignmentId = params.get("assignment") || "";
        const trackIds = (params.get("tracks") || "").split(",").map(value => value.trim()).filter(Boolean);
        const requiredListens = Math.max(1, Number(params.get("required")) || 7);
        return { assignmentId, trackIds, requiredListens, active: Boolean(assignmentId && trackIds.length) };
    }, [location.search]);

    const homeworkTrackSet = useMemo(() => new Set(homeworkContext.trackIds.map(String)), [homeworkContext.trackIds]);
    const speakingContext = useMemo(() => homeworkContext.active ? null : speakingListeningContext(location.search), [homeworkContext.active, location.search]);
    useEffect(() => {
        if (!speakingContext) return undefined;
        dispatch(setPlayPauseStatus(false));
        return () => { dispatch(setPlayPauseStatus(false)); };
    }, [speakingContext, dispatch]);

    useEffect(() => {
        let cancelled = false;
        const fetchPlaylist = async () => {
            if (!playlistId) return;
            setErrorMessage("");
            setProgressStatus("loading");
            setProgressMap({});
            setConfirmedListen(null);
            const cached = readPlaylistCache(playlistId);
            if (cached) {
                setBook(cached.book);
                setTracks(cached.tracks);
                setLoading(false);
            } else {
                setLoading(true);
            }
            try {
                const result = await getAccessibleBook(firebaseUser, playlistId);
                if (cancelled) return;
                const bookData = result?.book;
                if (!bookData) throw new Error("找不到這本教材");
                const convertedTracks = (result?.tracks || []).map(track => ({
                    ...track,
                    bookname: bookData.name,
                    type: playlistId,
                    musicName: track.music_name,
                    audioURL: track.audio_url,
                    audio_url: track.audio_url
                }));
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
                                completed: hasReachedListeningMastery(item),
                                completedAt: item.completed_at || null,
                                lastPlayedAt: item.last_played_at || null
                            };
                        });
                        setProgressMap(nextProgressMap);
                        setProgressStatus("ready");
                    }).catch(progressError => {
                        if (cancelled) return;
                        setProgressStatus("error");
                        console.error("背景讀取播放紀錄失敗:", progressError);
                    });
                } else {
                    setProgressMap({});
                    setProgressStatus("ready");
                }
            } catch (error) {
                console.error("Playlist 載入失敗:", error);
                setProgressStatus("error");
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
    }, [playlistId, firebaseUser, role, progressRetry]);

    useEffect(() => {
        const handleProgressUpdated = event => {
            const progress = event?.detail;
            const trackId = progress?.track_id || progress?.result_track_id;
            if (!trackId) return;
            // Progress refreshes alone do not prove that this listen was counted.
            if (role === "student" && progress.listen_counted === true) {
                setConfirmedListen({ trackId: String(trackId), playCount: Number(progress.play_count) || 0 });
            }
            setProgressMap(current => ({
                ...current,
                [String(trackId)]: {
                    ...current[String(trackId)],
                    playCount: Number(progress.play_count) || 0,
                    completed: hasReachedListeningMastery(progress),
                    dailyCount: Number(progress.daily_count) || 0,
                    monthlyCount: Number(progress.monthly_count) || 0,
                    totalCount: Number(progress.total_count) || 0
                }
            }));
        };
        window.addEventListener("ae:track-progress-updated", handleProgressUpdated);
        return () => window.removeEventListener("ae:track-progress-updated", handleProgressUpdated);
    }, [role]);

    useEffect(() => { setConfirmedListen(null); }, [location.search]);

    const stats = useMemo(() => {
        const completedCount = tracks.filter(track => Boolean(progressMap[String(track.id)]?.completed)).length;
        const totalPlayCount = tracks.reduce((total, track) => total + Number(progressMap[String(track.id)]?.playCount || 0), 0);
        return { total: tracks.length, completed: completedCount, totalPlayCount };
    }, [tracks, progressMap]);

    const homeworkTracks = useMemo(() => tracks.filter(track => homeworkTrackSet.has(String(track.id))), [tracks, homeworkTrackSet]);
    const speakingTracks = speakingContext ? tracks.filter(track => speakingContext.trackIds.has(String(track.id))) : [];
    const visibleTracks = homeworkContext.active ? homeworkTracks : speakingContext ? speakingTracks : tracks;
    const isHomeworkTrackCompleted = track => {
        const progress = progressMap[String(track.id)] || {};
        return Boolean(progress.completed) || Number(progress.playCount || 0) >= homeworkContext.requiredListens;
    };
    const homeworkCompletedCount = homeworkTracks.filter(isHomeworkTrackCompleted).length;
    const homeworkCompletionRate = homeworkTracks.length ? Math.round((homeworkCompletedCount / homeworkTracks.length) * 100) : 0;
    const currentTrack = visibleTracks.find(track => String(track.id) === String(playing?.id));
    const confirmedTrack = role === "student" ? visibleTracks.find(track => String(track.id) === confirmedListen?.trackId) : null;
    const confirmedIndex = confirmedTrack ? visibleTracks.indexOf(confirmedTrack) : -1;
    const nextTrack = confirmedIndex >= 0 ? visibleTracks[confirmedIndex + 1] : null;

    const speakingReturn = speakingContext && <Link className="playlist-speaking-return" to={speakingContext.returnPath}><ArrowLeft aria-hidden="true" size={18} />回到原口說關卡</Link>;
    if (loading && tracks.length === 0) return <div className="playlist-loading">{speakingReturn}<div className="playlist-loading__icon">🎧</div><div>音檔載入中...</div></div>;
    if (errorMessage && tracks.length === 0) return <div className="playlist-error">{speakingReturn}<h2>讀取失敗</h2><p>{errorMessage}</p></div>;

    return (
        <div className="playlist-page">
            <div className="playlist-content">
                {speakingContext && <section className="playlist-speaking-preparation" aria-label="本關聽力準備">
                    <div><span><Headphones aria-hidden="true" size={18} />本關聽力準備</span><p>先把教材聽熟，再回到口說關卡試著自己回答。已完成的題目會保留，回去後重新載入本關。</p></div>
                    {speakingReturn}
                </section>}
                <header className="playlist-header">
                    <div className="playlist-header__main">
                        <div className="playlist-header__copy">
                            {homeworkContext.active && (
                                <Link className="playlist-homework-back" to="/student/assignments">
                                    <ArrowLeft aria-hidden="true" size={16} />
                                    返回今日作業
                                </Link>
                            )}
                            <span className="playlist-header__eyebrow"><Headphones aria-hidden="true" size={15} /> 聽力冒險</span>
                            <h1>{book?.name || playlistId}</h1>
                            <p>選一個音檔，專心聽，再跟著開口練習。</p>
                        </div>
                        {role === "student" && (
                            <div className="playlist-header__stats">
                                <span><small>{homeworkContext.active ? "本次任務" : "教材熟練音檔"}</small><strong>{progressStatus !== "ready" ? progressStatus === "loading" ? "讀取中" : "尚未載入" : homeworkContext.active ? `${homeworkCompletedCount} / ${homeworkTracks.length || homeworkContext.trackIds.length}` : `${stats.completed} / ${stats.total}`}</strong></span>
                                <span><small>教材累計有效聆聽</small><strong>{progressStatus === "ready" ? `${stats.totalPlayCount} 次` : "—"}</strong></span>
                            </div>
                        )}
                        <div className="playlist-header__art" aria-hidden="true"><span>ABC</span><i>★</i><i>♪</i><i>✦</i></div>
                    </div>
                </header>

                {homeworkContext.active && (
                    <section className="playlist-homework-banner">
                        <div className="playlist-homework-banner__icon">
                            <Headphones aria-hidden="true" size={25} />
                        </div>
                        <div className="playlist-homework-banner__copy">
                            <span>老師的聽力任務</span>
                            <h2>今天的指定聽力</h2>
                            <p>這裡只顯示老師指定的 {homeworkTracks.length || homeworkContext.trackIds.length} 個音檔，逐一完成就可以回到今日作業。</p>
                            <div className="playlist-homework-chips">
                                {(homeworkTracks.length ? homeworkTracks : tracks.filter(track => homeworkTrackSet.has(String(track.id)))).map(track => {
                                    const completed = progressStatus === "ready" && isHomeworkTrackCompleted(track);
                                    return (
                                        <strong className={completed ? "completed" : ""} key={track.id}>
                                            {completed && <Check aria-hidden="true" size={12} />}
                                            {track.page || track.title || "音檔"}
                                        </strong>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="playlist-homework-progress" role="progressbar" aria-label="指定聽力完成進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressStatus === "ready" ? homeworkCompletionRate : undefined} aria-valuetext={progressStatus === "ready" ? undefined : "聆聽紀錄尚未載入"}>
                            <strong>{progressStatus === "ready" ? `${homeworkCompletionRate}%` : "—"}</strong>
                            <span>{progressStatus === "ready" ? `${homeworkCompletedCount} / ${homeworkTracks.length || homeworkContext.trackIds.length} 完成` : "聆聽紀錄尚未載入"}</span>
                            <div aria-hidden="true"><span style={{ width: `${progressStatus === "ready" ? homeworkCompletionRate : 0}%` }} /></div>
                        </div>
                    </section>
                )}

                {role === "student" && progressStatus === "error" && <div className="playlist-progress-error" role="alert"><span>暫時讀不到聆聽紀錄，你仍可播放音檔；這不代表沒有練習過。</span><button type="button" onClick={() => setProgressRetry(value => value + 1)}>重新讀取紀錄</button></div>}

                {confirmedTrack && <section className="playlist-listening-confirmed" aria-label="本次聆聽紀錄">
                    <div role="status"><Check aria-hidden="true" size={22} /><div><strong>已記下這次有效聆聽！</strong><p>{confirmedTrack.title || confirmedTrack.music_name || confirmedTrack.page || "教材音檔"} · 累計 {confirmedListen.playCount} 次</p></div></div>
                    <div className="playlist-listening-confirmed__actions">
                        {homeworkContext.active && progressStatus === "ready" && homeworkCompletedCount === homeworkTracks.length ? <Link to="/student/assignments">看看今日作業</Link> : speakingContext ? <Link to={speakingContext.returnPath}>聽好了，回口說練習</Link> : <a href={nextTrack ? `#listening-track-${nextTrack.id}` : "#listening-track-list"}>{nextTrack ? "看看下一個音檔" : "選一個音檔再練習"}</a>}
                        <button type="button" onClick={() => setConfirmedListen(null)} aria-label="收起本次聆聽提示">收起</button>
                    </div>
                </section>}

                <div className="playlist-learning-layout">
                <ListeningLearningPanel currentTrack={currentTrack} playingStatus={playingStatus} speakingPreparation={Boolean(speakingContext)} />
                <section className="playlist-list-section" aria-labelledby="listening-track-list-title">
                    <div className="playlist-list-heading"><h2 id="listening-track-list-title">{homeworkContext.active ? "指定音檔" : speakingContext ? "本關練習音檔" : "聽力任務列表"}</h2><span>{visibleTracks.length} 個音檔</span></div>
                    <div className="playlist-list" id="listening-track-list" tabIndex={-1}>
                        {visibleTracks.length > 0 ? visibleTracks.map((track, index) => (
                            <div className={homeworkTrackSet.has(String(track.id)) ? "playlist-homework-track" : ""} id={`listening-track-${track.id}`} tabIndex={-1} key={track.id}>
                                <MusicCard
                                    music={track}
                                    playbackQueue={visibleTracks}
                                    progress={progressMap[String(track.id)] || {}}
                                    index={index}
                                    progressStatus={role === "student" ? progressStatus : "ready"}
                                />
                            </div>
                        )) : <div className="playlist-empty">{speakingContext ? "本關對應音檔目前無法載入，請回到口說關卡繼續練習。" : "目前沒有音檔"}</div>}
                    </div>
                </section>
                </div>
            </div>
        </div>
    );
}

export default Playlist;
