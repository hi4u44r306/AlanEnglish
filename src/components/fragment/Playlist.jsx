import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Check, Headphones } from "lucide-react";
import MusicCard from "./MusicCard";
import "../assets/scss/Playlist.scss";
import "../Pages/css/SpeakingAdventureSession.scss";
import "../assets/scss/ListeningLearning.scss";
import "../Pages/css/StudentAssignmentsMinimal.scss";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { useAuth } from "../../auth/AuthContext";
import { getStudentAssignments } from "../../services/assignmentService";
import { assignmentDisplayTitle, normalizeListeningTracks } from "../../utils/assignmentListening";
import { getAssignmentState } from "../../utils/studentLearning";
import { getBookPlaybackProgress } from "../../services/listeningService";
import { getAccessibleBook } from "../../services/contentAccessService";
import { hasReachedListeningMastery } from "../../constants/listeningProgress";
import { useDispatch } from "react-redux";
import { setPlayPauseStatus } from "../../actions/actions";
import { speakingListeningContext } from "../../utils/speakingListening";
import { studentPageScope } from "../../services/studentPageCache";
import { readStudentLearningHistory, saveStudentLearningResume } from "../../services/studentLearningResume";

function Playlist() {
    const { playlistId } = useParams();
    const location = useLocation();
    const dispatch = useDispatch();
    const { firebaseUser, role, studentProfile } = useAuth();
    const bookQuery = useStudentPageQuery(`book:${playlistId}`, () => getAccessibleBook(firebaseUser, playlistId));
    const book = bookQuery.data?.book;
    const tracks = useMemo(() => (bookQuery.data?.tracks || []).map(track => ({
        ...track, bookname: book?.name, type: playlistId, musicName: track.music_name,
        audioURL: track.audio_url, audio_url: track.audio_url
    })), [bookQuery.data, book?.name, playlistId]);
    const progressQuery = useStudentPageQuery(`progress:${book?.id || playlistId}`, () => getBookPlaybackProgress(firebaseUser, book.id), {
        enabled: Boolean(book?.id && firebaseUser && role === "student")
    });
    const progressStatus = role !== "student" || progressQuery.data ? "ready" : progressQuery.error ? "error" : "loading";
    const loading = bookQuery.loading;
    const errorMessage = bookQuery.error?.message || "";

    const progressOwner = `${firebaseUser?.uid}:${playlistId}`;
    const [progressUpdates, setProgressUpdates] = useState({ owner: progressOwner, items: {} });
    const progressMap = useMemo(() => {
        const next = {};
        (progressQuery.data?.progress || []).forEach(item => {
            next[String(item.track_id)] = {
                playCount: Number(item.play_count) || 0,
                completed: hasReachedListeningMastery(item),
                completedAt: item.completed_at || null,
                lastPlayedAt: item.last_played_at || null
            };
        });
        return { ...next, ...(progressUpdates.owner === progressOwner ? progressUpdates.items : {}) };
    }, [progressQuery.data, progressUpdates, progressOwner]);




    const [confirmedListen, setConfirmedListen] = useState(null);

    const homeworkContext = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const assignmentId = params.get("assignment") || "";
        const trackIds = (params.get("tracks") || "").split(",").map(value => value.trim()).filter(Boolean);
        return { assignmentId, trackIds, active: Boolean(assignmentId) };
    }, [location.search]);

    const assignmentQuery = useStudentPageQuery("assignments:v1", () => getStudentAssignments(firebaseUser), {
        enabled: role === "student" && homeworkContext.active
    });
    const homeworkAssignment = assignmentQuery.data?.assignments?.find(item => String(item.id) === homeworkContext.assignmentId);
    const homeworkProgressTracks = useMemo(() => normalizeListeningTracks(homeworkAssignment), [homeworkAssignment]);
    const homeworkProgress = useMemo(() => new Map(homeworkProgressTracks.map(track => [String(track.id), track])), [homeworkProgressTracks]);
    const homeworkStatus = homeworkAssignment ? "ready" : assignmentQuery.loading ? "loading" : "error";
    const homeworkTrackSet = useMemo(() => new Set(homeworkProgressTracks
        .filter(track => !homeworkContext.trackIds.length || homeworkContext.trackIds.includes(String(track.id)))
        .map(track => String(track.id))), [homeworkProgressTracks, homeworkContext.trackIds]);
    const homeworkReturnPath = `/student/assignments?task=v1-${encodeURIComponent(homeworkContext.assignmentId)}`;
    const homeworkOverdue = homeworkAssignment && getAssignmentState(homeworkAssignment) === "overdue";
    const homeworkClosed = homeworkOverdue && homeworkAssignment.listening_progress_mode === "assignment_window";
    const speakingContext = useMemo(() => homeworkContext.active ? null : speakingListeningContext(location.search), [homeworkContext.active, location.search]);
    useEffect(() => {
        if (!speakingContext) return undefined;
        dispatch(setPlayPauseStatus(false));
        return () => { dispatch(setPlayPauseStatus(false)); };
    }, [speakingContext, dispatch]);

    useEffect(() => {
        setProgressUpdates({ owner: progressOwner, items: {} });
    }, [progressQuery.data, progressOwner]);

    useEffect(() => { setConfirmedListen(null); }, [playlistId, firebaseUser?.uid]);
    useEffect(() => {
        const handleProgressUpdated = event => {
            const progress = event?.detail;
            const trackId = progress?.track_id || progress?.result_track_id;
            if (!trackId) return;
            // Progress refreshes alone do not prove that this listen was counted.
            if (role === "student" && progress.listen_counted === true) {
                setConfirmedListen({ trackId: String(trackId), playCount: Number(progress.play_count) || 0 });
            }
            setProgressUpdates(current => ({
                owner: progressOwner,
                items: { ...(current.owner === progressOwner ? current.items : {}), [String(trackId)]: {
                    playCount: Number(progress.play_count) || 0,
                    completed: hasReachedListeningMastery(progress),
                    dailyCount: Number(progress.daily_count) || 0,
                    monthlyCount: Number(progress.monthly_count) || 0,
                    totalCount: Number(progress.total_count) || 0
                } }
            }));
        };
        window.addEventListener("ae:track-progress-updated", handleProgressUpdated);
        return () => window.removeEventListener("ae:track-progress-updated", handleProgressUpdated);
    }, [role, progressOwner]);

    useEffect(() => { setConfirmedListen(null); }, [location.search]);

    const stats = useMemo(() => {
        const completedCount = tracks.filter(track => Boolean(progressMap[String(track.id)]?.completed)).length;
        const totalPlayCount = tracks.reduce((total, track) => total + Number(progressMap[String(track.id)]?.playCount || 0), 0);
        return { total: tracks.length, completed: completedCount, totalPlayCount };
    }, [tracks, progressMap]);

    const homeworkTracks = useMemo(() => tracks.filter(track => homeworkTrackSet.has(String(track.id))), [tracks, homeworkTrackSet]);
    const speakingTracks = speakingContext ? tracks.filter(track => speakingContext.trackIds.has(String(track.id))) : [];
    const visibleTracks = homeworkContext.active ? homeworkTracks : speakingContext ? speakingTracks : tracks;
    // The whole book, opened from 教材: the header carries the count, so the list needs no heading.
    const plainList = !homeworkContext.active && !speakingContext;
    const resumeTrackId = new URLSearchParams(location.search).get("resume");
    const resumeLocated = useRef("");
    useEffect(() => {
        const targetKey = `${progressOwner}:${location.search}`;
        if (!resumeTrackId || homeworkContext.active || speakingContext || resumeLocated.current === targetKey
            || !visibleTracks.some(track => String(track.id) === resumeTrackId)) return;
        const target = document.getElementById(`listening-track-${resumeTrackId}`);
        if (!target) return;
        target.scrollIntoView?.({ block: "center", behavior: "auto" });
        target.focus({ preventScroll: true });
        resumeLocated.current = targetKey;
    }, [resumeTrackId, progressOwner, location.search, homeworkContext.active, speakingContext, visibleTracks]);
    // Read once per book so the note keeps pointing at where the student stopped last time.
    const lastHeard = useMemo(() => role !== "student" || !book?.id ? null
        : readStudentLearningHistory(studentPageScope(firebaseUser, role, studentProfile)).find(item => item.bookId === String(book.id)) || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book?.id, firebaseUser?.uid, role]);
    const lastHeardTrack = lastHeard && !resumeTrackId && !homeworkContext.active && !speakingContext
        ? visibleTracks.find(track => String(track.id) === lastHeard.trackId) : null;
    const rememberTrack = track => {
        if (role === "student") saveStudentLearningResume(studentPageScope(firebaseUser, role, studentProfile),
            { id: book?.id, code: book?.code || playlistId }, track);
    };
    const isHomeworkTrackCompleted = track => homeworkProgress.get(String(track.id))?.completed === true;
    const homeworkCompletedCount = homeworkProgressTracks.filter(track => track.completed).length;
    const homeworkCompletionRate = homeworkProgressTracks.length ? Math.round((homeworkCompletedCount / homeworkProgressTracks.length) * 100) : 0;
    const homeworkComplete = homeworkProgressTracks.length > 0 && homeworkCompletedCount === homeworkProgressTracks.length;
    // The card the student stopped at keeps a visible frame, so the jump link lands on something obvious.
    const lastHeardMarkId = !plainList || role !== "student" ? "" : String(resumeTrackId || lastHeard?.trackId || "");
    const confirmedTrack = role === "student" ? visibleTracks.find(track => String(track.id) === confirmedListen?.trackId) : null;
    const confirmedIndex = confirmedTrack ? visibleTracks.indexOf(confirmedTrack) : -1;
    const nextTrack = homeworkContext.active ? visibleTracks.find(track => !isHomeworkTrackCompleted(track)) : confirmedIndex >= 0 ? visibleTracks[confirmedIndex + 1] : null;
    const confirmedHomeworkProgress = confirmedTrack && homeworkProgress.get(String(confirmedTrack.id));

    const speakingReturn = speakingContext && <Link className="playlist-speaking-return" to={speakingContext.returnPath}><ArrowLeft aria-hidden="true" size={18} />回到原口說關卡</Link>;
    if (loading && tracks.length === 0) return <div className="playlist-loading">{speakingReturn}<div className="playlist-loading__icon">🎧</div><div>音檔載入中...</div></div>;
    if (errorMessage && tracks.length === 0) return <div className="playlist-error">{speakingReturn}<h2>讀取失敗</h2><p>{errorMessage}</p></div>;

    return (
        <div className="playlist-page">
            <div className="playlist-content">
                {bookQuery.error && bookQuery.data && <p role="status">目前顯示上次教材清單，播放網址暫時無法更新。<button type="button" onClick={() => bookQuery.refresh()}>重新讀取教材</button></p>}
                {resumeTrackId && !homeworkContext.active && !speakingContext && <p role="status">{visibleTracks.some(track => String(track.id) === resumeTrackId) ? "已找到上次學習的音檔，按「播放」即可開始。" : "上次音檔目前不在教材清單中，請選擇其他音檔。"}</p>}
                {lastHeardTrack && <p className="playlist-last-heard" role="status">上次聽到：<a href={`#listening-track-${lastHeardTrack.id}`}>{lastHeardTrack.title || lastHeardTrack.music_name || lastHeardTrack.page || "教材音檔"}</a></p>}
                {speakingContext && <section className="playlist-speaking-preparation" aria-label="本關聽力準備">
                    <div><span><Headphones aria-hidden="true" size={18} />本關聽力準備</span><p>先把教材聽熟，再回到口說關卡試著自己回答。已完成的題目會保留，回去後重新載入本關。</p></div>
                    {speakingReturn}
                </section>}
                <header className="playlist-header">
                    <div className="playlist-header__main">
                        <div className="playlist-header__copy">
                            {homeworkContext.active && (
                                <Link className="playlist-homework-back" to={homeworkReturnPath}>
                                    <ArrowLeft aria-hidden="true" size={16} />
                                    返回這份作業
                                </Link>
                            )}
                            <div className="playlist-header__title">
                                <h1>{book?.name || playlistId}</h1>
                                {plainList && tracks.length > 0 && <strong className="playlist-header__count" aria-label={progressStatus === "ready" ? `已完成 ${stats.completed} 個，共 ${stats.total} 個音檔` : `共 ${stats.total} 個音檔`}>{progressStatus === "ready" ? `${stats.completed} / ${stats.total}` : stats.total}</strong>}
                            </div>
                        </div>
                    </div>
                </header>

                {homeworkContext.active && (
                    <section className="playlist-homework-banner">
                        <div className="playlist-homework-banner__icon">
                            <Headphones aria-hidden="true" size={25} />
                        </div>
                        <div className="playlist-homework-banner__copy">
                            <span>老師的聽力任務</span>
                            <h2>{assignmentDisplayTitle(homeworkAssignment?.title) || "本次聽力作業"}</h2>
                            <p className="playlist-homework-summary" role="status">{homeworkStatus === "ready" ? `本次作業：已完成 ${homeworkCompletedCount} 個，共 ${homeworkProgressTracks.length} 個指定音檔` : homeworkStatus === "loading" ? "正在讀取本次作業進度…" : "目前無法確認這份作業，請返回作業頁重新開啟。"}</p>
                            <p>每首需要的次數都在下方清單，以老師指定次數為準。</p>
                            {homeworkComplete && !confirmedTrack && !assignmentQuery.error && !assignmentQuery.refreshing && <p role="status">{homeworkAssignment?.source_type === "music_track" ? "本次作業已完成" : "本次指定聽力已完成"}。<Link to={homeworkReturnPath}>返回作業頁</Link></p>}
                            {homeworkAssignment?.listening_progress_mode === "legacy_lifetime" && <p>這份作業採累計聆聽制：以作業紀錄顯示的累計次數達標。</p>}
                            {homeworkOverdue && <p className="playlist-homework-deadline">作業已逾期，請向老師確認是否可以補做。{homeworkClosed ? "目前繼續聆聽不會增加這份作業的次數。" : ""}</p>}
                            {(assignmentQuery.error || homeworkStatus === "error") && <button type="button" onClick={() => assignmentQuery.refresh()}>重新讀取作業進度</button>}
                            {assignmentQuery.error && homeworkAssignment && <p role="alert">目前顯示上次作業進度，最新次數暫時無法同步。</p>}
                            {assignmentQuery.refreshing && homeworkAssignment && <p role="status">正在更新本次作業進度…</p>}
                            {homeworkStatus === "ready" && homeworkTracks.length < homeworkProgressTracks.length && <p>這裡顯示本頁可用的 {homeworkTracks.length} 個指定音檔；其他指定音檔請返回這份作業查看。</p>}
                            <div className="playlist-homework-chips">
                                {homeworkTracks.map(track => {
                                    const completed = homeworkStatus === "ready" && isHomeworkTrackCompleted(track);
                                    return (
                                        <strong className={completed ? "completed" : ""} key={track.id}>
                                            {completed && <Check aria-hidden="true" size={12} />}
                                            {track.page || track.title || "音檔"}
                                        </strong>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="playlist-homework-progress" role="progressbar" aria-label="指定聽力完成進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={homeworkStatus === "ready" ? homeworkCompletionRate : undefined} aria-valuetext={homeworkStatus === "ready" ? `已完成 ${homeworkCompletedCount} 個，共 ${homeworkProgressTracks.length} 個指定音檔` : "作業紀錄尚未載入"}>
                            <strong>{homeworkStatus === "ready" ? `${homeworkCompletionRate}%` : "—"}</strong>
                            <span>{homeworkStatus === "ready" ? "指定音檔完成進度" : "作業紀錄尚未載入"}</span>
                            <div aria-hidden="true"><span style={{ width: `${homeworkStatus === "ready" ? homeworkCompletionRate : 0}%` }} /></div>
                        </div>
                    </section>
                )}

                {role === "student" && progressQuery.error && <div className="playlist-progress-error" role="alert"><span>{progressQuery.data ? "目前顯示上次聆聽紀錄，最新次數暫時無法同步。" : "暫時讀不到聆聽紀錄，你仍可播放音檔；這不代表沒有練習過。"}</span><button type="button" onClick={() => progressQuery.refresh()}>重新讀取紀錄</button></div>}

                {confirmedTrack && <section className="playlist-listening-confirmed" aria-label="本次聆聽紀錄">
                    <div role="status"><Check aria-hidden="true" size={22} /><div><strong>{homeworkContext.active && homeworkComplete && !assignmentQuery.refreshing && !assignmentQuery.error ? homeworkAssignment?.source_type === "music_track" ? "本次作業已完成" : "本次指定聽力已完成" : "已記下這次有效聆聽！"}</strong>
                        <p>{homeworkContext.active ? assignmentQuery.refreshing ? "正在核對本次作業進度…" : assignmentQuery.error ? "作業次數尚未確認，請重新讀取作業進度。" : homeworkClosed ? "這份作業已截止；本次聆聽是否計入其他學習紀錄，以系統紀錄為準。" : confirmedHomeworkProgress?.completed ? `${confirmedHomeworkProgress.label} 已完成${nextTrack ? `，接下來請聽 ${homeworkProgress.get(String(nextTrack.id))?.label}` : "，可以返回作業頁查看"}。` : confirmedHomeworkProgress ? `${confirmedHomeworkProgress.label} 本次作業已聽 ${confirmedHomeworkProgress.playCount} 次，還需 ${Math.max(0, confirmedHomeworkProgress.requiredListens - confirmedHomeworkProgress.playCount)} 次。` : "請重新讀取本次作業進度。" : `${confirmedTrack.title || confirmedTrack.music_name || confirmedTrack.page || "教材音檔"} · 累計 ${confirmedListen.playCount} 次`}</p>
                    </div></div>
                    <div className="playlist-listening-confirmed__actions">
                        {homeworkContext.active && (homeworkComplete || homeworkOverdue || !nextTrack) ? <Link to={homeworkReturnPath}>返回作業頁</Link> : speakingContext ? <Link to={speakingContext.returnPath}>聽好了，回口說練習</Link> : <a href={nextTrack ? `#listening-track-${nextTrack.id}` : "#listening-track-list"}>{nextTrack ? homeworkContext.active && String(nextTrack.id) === String(confirmedTrack.id) ? "再聽這個音檔" : "看看下一個音檔" : "選一個音檔再練習"}</a>}
                        <button type="button" onClick={() => setConfirmedListen(null)} aria-label="收起本次聆聽提示">收起</button>
                    </div>
                </section>}

                <div className="playlist-learning-layout">
                <section className="playlist-list-section" aria-labelledby={plainList ? undefined : "listening-track-list-title"} aria-label={plainList ? "音檔列表" : undefined}>
                    {homeworkContext.active && <div className="playlist-homework-rules"><p>每次以原速或較慢速度實際聽滿 80%，播放結束並經系統確認後才計一次；拖到結尾或倍速播放不計次數。</p><p>長期熟練累積與本次作業完成條件分開呈現。{progressStatus === "ready" ? `整本教材累計有效聆聽 ${stats.totalPlayCount} 次，包含作業以外的聆聽。` : "整本教材累計紀錄尚未載入。"}</p></div>}
                    {!plainList && <div className="playlist-list-heading"><h2 id="listening-track-list-title">{homeworkContext.active ? book?.name || "指定音檔" : "本關練習音檔"}</h2><span>{homeworkContext.active ? "指定音檔 " : ""}{visibleTracks.length} 個{homeworkContext.active ? "" : "音檔"}</span></div>}
                    <div className="playlist-list" id="listening-track-list" tabIndex={-1}>
                        {visibleTracks.length > 0 ? visibleTracks.map((track, index) => (
                            <div className={[homeworkTrackSet.has(String(track.id)) ? "playlist-homework-track" : "", String(track.id) === lastHeardMarkId ? "playlist-track--last-heard" : ""].filter(Boolean).join(" ")} id={`listening-track-${track.id}`} tabIndex={-1} key={track.id}>
                                {String(track.id) === lastHeardMarkId && <span className="playlist-track__last-heard">上次聽到這裡</span>}
                                <MusicCard
                                    music={track}
                                    playbackQueue={visibleTracks}
                                    progress={progressMap[String(track.id)] || {}}
                                    index={index}
                                    progressStatus={role === "student" ? progressStatus : "ready"}
                                    assignmentProgress={homeworkContext.active ? homeworkProgress.get(String(track.id)) : null}
                                    assignmentProgressStatus={homeworkStatus}
                                    onStart={rememberTrack}
                                />
                            </div>
                        )) : <div className="playlist-empty">{speakingContext ? "本關對應音檔目前無法載入，請回到口說關卡繼續練習。" : homeworkContext.active ? homeworkStatus === "loading" ? "正在讀取指定音檔…" : "目前沒有可確認的指定音檔，請返回作業頁查看。" : "目前沒有音檔"}</div>}
                    </div>
                </section>
                </div>
            </div>
        </div>
    );
}

export default Playlist;
