import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheck, FiCheckSquare, FiHeadphones, FiVideo } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { completeMakeupItem, getStudentMakeups } from "../../services/attendanceService";
import { formatVideoRange, youtubeEmbedUrl, youtubeWatchUrl } from "../../utils/makeupVideo";
import "./css/Attendance.scss";

const formatDate = value => {
    const [, month, day] = String(value).split("-");
    return `${Number(month)} 月 ${Number(day)} 日`;
};

const StudentMakeup = () => {
    const { firebaseUser } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openVideoId, setOpenVideoId] = useState(null);
    const [markingId, setMarkingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const result = await getStudentMakeups(firebaseUser);
            setSessions(result.sessions || []);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => { load(); }, [load]);

    const markDone = async item => {
        setMarkingId(item.id);
        try {
            await completeMakeupItem(firebaseUser, item.id);
            setSessions(current => current.map(session => ({
                ...session,
                items: session.items.map(row => row.id === item.id ? { ...row, done: true } : row)
            })));
        } catch (markError) {
            setError(markError.message);
        } finally {
            setMarkingId(null);
        }
    };

    const renderAction = item => {
        if (item.item_type === "video") {
            const embedUrl = youtubeEmbedUrl(item.video_url, item.start_seconds, item.end_seconds);
            return <>
                {embedUrl
                    ? <button type="button" className="attendance-secondary" aria-expanded={openVideoId === item.id} onClick={() => setOpenVideoId(current => current === item.id ? null : item.id)}><FiVideo aria-hidden="true" />{openVideoId === item.id ? "收起影片" : `看影片 ${formatVideoRange(item.start_seconds, item.end_seconds)}`}</button>
                    : <a className="attendance-secondary" href={item.video_url} target="_blank" rel="noopener noreferrer"><FiVideo aria-hidden="true" />開啟影片</a>}
                {openVideoId === item.id && embedUrl && <div className="makeup-video">
                    <iframe src={embedUrl} title={item.title} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
                    <a href={youtubeWatchUrl(item.video_url, item.start_seconds)} target="_blank" rel="noopener noreferrer">影片打不開？改到 YouTube 觀看</a>
                </div>}
            </>;
        }
        if (item.item_type === "listening") {
            return item.book_code
                ? <Link className="attendance-secondary" to={`/student/books/${encodeURIComponent(item.book_code)}?resume=${encodeURIComponent(item.track_id)}`}><FiHeadphones aria-hidden="true" />去聽這個音檔</Link>
                : <span className="attendance-hint">這個音檔目前無法開啟，請問老師。</span>;
        }
        return item.task_key
            ? <Link className="attendance-secondary" to={`/student/assignments?task=${encodeURIComponent(item.task_key)}`}><FiCheckSquare aria-hidden="true" />去寫這份作業</Link>
            : <span className="attendance-hint">這份作業已經收回，不用補。</span>;
    };

    const pending = sessions.reduce((total, session) => total + session.items.filter(item => !item.done).length, 0);

    return (
        <main className="attendance-page makeup-page">
            <header className="attendance-hero">
                <div>
                    <span>MAKEUP LESSON</span>
                    <h1>補課</h1>
                    <p>{loading ? "正在整理你的補課內容…" : pending ? `還有 ${pending} 個項目要補，按按鈕就會跳到老師教的那一段。` : "沒有需要補的課，太棒了！"}</p>
                </div>
                <Link className="attendance-ghost" to="/student/assignments">回到作業</Link>
            </header>

            {error && <p className="attendance-message error" role="alert">{error} <button type="button" className="attendance-ghost" onClick={load}>重新整理</button></p>}

            {!loading && !error && sessions.length === 0 && <section className="attendance-card"><p>最近 60 天沒有缺席或請假的課。</p></section>}

            {sessions.map(session => <section className="attendance-card" key={session.id} aria-label={`${formatDate(session.session_date)} 的補課`}>
                <div className="attendance-card-heading">
                    <h2>{formatDate(session.session_date)} <small>{session.status === "leave" ? "請假" : "缺席"}</small></h2>
                    <strong>{session.items.filter(item => item.done).length}／{session.items.length}</strong>
                </div>
                {session.note && <p className="makeup-note">老師的話：{session.note}</p>}
                <ol className="makeup-items">
                    {session.items.map(item => <li key={item.id} className={item.done ? "done" : ""}>
                        <div className="makeup-item-title">
                            <span className={`attendance-item-type ${item.item_type}`}>{item.item_type === "video" ? "影片" : item.item_type === "listening" ? "聽力" : "作業"}</span>
                            <strong>{item.title}</strong>
                            {item.book_name && <small>{item.book_name}</small>}
                        </div>
                        <div className="makeup-item-actions">
                            {renderAction(item)}
                            {item.done
                                ? <span className="makeup-done"><FiCheck aria-hidden="true" />已完成</span>
                                : item.self_markable
                                    ? <button type="button" className="attendance-primary" disabled={markingId === item.id} onClick={() => markDone(item)}><FiCheck aria-hidden="true" />{item.item_type === "video" ? "我看完了" : "我完成了"}</button>
                                    : <span className="attendance-hint">{item.item_type === "listening" ? "認真聽完 80% 會自動打勾" : "完成作業會自動打勾"}</span>}
                        </div>
                    </li>)}
                </ol>
            </section>)}
        </main>
    );
};

export default StudentMakeup;
