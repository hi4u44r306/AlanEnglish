import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck, FiHeadphones, FiPlus, FiTrash2, FiVideo, FiCheckSquare } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import {
    ATTENDANCE_STATUS_OPTIONS,
    deleteVideoSegment,
    getAttendanceBootstrap,
    getClassSession,
    getMakeupOverview,
    needsMakeup,
    saveClassSession,
    saveVideoSegment
} from "../../services/attendanceService";
import { formatVideoRange, parseTimeInput } from "../../utils/makeupVideo";
import "./css/Attendance.scss";

const ITEM_TYPES = [
    { value: "video", label: "習作本影片", icon: <FiVideo aria-hidden="true" /> },
    { value: "listening", label: "聽力音檔", icon: <FiHeadphones aria-hidden="true" /> },
    { value: "assignment", label: "作業", icon: <FiCheckSquare aria-hidden="true" /> }
];
const itemTypeLabel = type => ITEM_TYPES.find(option => option.value === type)?.label || type;
const statusLabel = status => ATTENDANCE_STATUS_OPTIONS.find(option => option.value === status)?.label || "未點名";
const emptyVideoForm = { url: "", start: "", end: "", title: "", pageFrom: "", pageTo: "" };
const itemKey = item => `${item.item_type}:${item.video_segment_id || ""}:${item.video_url || ""}:${item.start_seconds ?? ""}:${item.track_id || ""}:${item.assignment_id || ""}`;

const TeacherAttendance = () => {
    const { firebaseUser } = useAuth();
    const [boot, setBoot] = useState(null);
    const [classCode, setClassCode] = useState("");
    const [sessionDate, setSessionDate] = useState("");
    const [view, setView] = useState(null);
    const [attendance, setAttendance] = useState({});
    const [items, setItems] = useState([]);
    const [note, setNote] = useState("");
    const [overview, setOverview] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [itemType, setItemType] = useState("video");
    const [bookId, setBookId] = useState("");
    const [trackId, setTrackId] = useState("");
    const [assignmentId, setAssignmentId] = useState("");
    const [videoForm, setVideoForm] = useState(emptyVideoForm);

    const applyView = useCallback(result => {
        setView(current => ({ ...current, ...result }));
        setAttendance(Object.fromEntries((result.attendance || []).map(row => [row.student_id, row.status])));
        setItems(result.items || []);
        setNote(result.session?.note || "");
    }, []);

    useEffect(() => {
        let active = true;
        getAttendanceBootstrap(firebaseUser).then(result => {
            if (!active) return;
            setBoot(result);
            setClassCode(result.classes?.[0] || "");
            setSessionDate(result.today);
            if (!result.classes?.length) setLoading(false);
        }).catch(error => {
            if (!active) return;
            setMessage({ type: "error", text: error.message });
            setLoading(false);
        });
        return () => { active = false; };
    }, [firebaseUser]);

    const loadSession = useCallback(async () => {
        if (!classCode || !sessionDate) return;
        setLoading(true);
        try {
            const [session, makeup] = await Promise.all([
                getClassSession(firebaseUser, classCode, sessionDate),
                getMakeupOverview(firebaseUser, classCode)
            ]);
            applyView(session);
            setOverview(makeup.sessions || []);
            setBookId(current => session.options.books.some(book => String(book.id) === current) ? current : String(session.options.books[0]?.id || ""));
        } catch (error) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setLoading(false);
        }
    }, [applyView, classCode, firebaseUser, sessionDate]);

    useEffect(() => { loadSession(); }, [loadSession]);

    const options = view?.options;
    const roster = useMemo(() => view?.roster || [], [view]);
    const bookSegments = useMemo(() => (options?.video_segments || []).filter(segment => String(segment.book_id) === bookId), [options, bookId]);
    const bookTracks = useMemo(() => (options?.tracks || []).filter(track => String(track.book_id) === bookId), [options, bookId]);
    const markedCount = roster.filter(student => attendance[student.id]).length;
    const makeupStudents = roster.filter(student => needsMakeup(attendance[student.id]));

    const addItem = item => {
        setItems(current => current.some(existing => itemKey(existing) === itemKey(item)) ? current : [...current, item]);
        setMessage(null);
    };

    const addManualVideo = () => {
        const start = parseTimeInput(videoForm.start) ?? 0;
        const end = parseTimeInput(videoForm.end);
        if (!videoForm.url.trim()) return setMessage({ type: "error", text: "請貼上 YouTube 影片網址" });
        if (videoForm.start.trim() && parseTimeInput(videoForm.start) === null) return setMessage({ type: "error", text: "開始時間請用 分:秒，例如 12:30" });
        if (videoForm.end.trim() && end === null) return setMessage({ type: "error", text: "結束時間請用 分:秒，例如 18:45" });
        if (end !== null && end <= start) return setMessage({ type: "error", text: "結束時間要晚於開始時間" });
        addItem({
            item_type: "video", title: videoForm.title.trim() || "習作本影片", book_id: Number(bookId) || null,
            video_url: videoForm.url.trim(), start_seconds: start, end_seconds: end
        });
        return setVideoForm(emptyVideoForm);
    };

    const saveSegment = async () => {
        const start = parseTimeInput(videoForm.start) ?? 0;
        const end = parseTimeInput(videoForm.end);
        setSaving(true);
        try {
            await saveVideoSegment(firebaseUser, {
                book_id: Number(bookId), page_from: Number(videoForm.pageFrom), page_to: Number(videoForm.pageTo || videoForm.pageFrom),
                video_url: videoForm.url.trim(), start_seconds: start, end_seconds: end, title: videoForm.title.trim()
            });
            const session = await getClassSession(firebaseUser, classCode, sessionDate);
            setView(current => ({ ...current, options: session.options }));
            setVideoForm(emptyVideoForm);
            setMessage({ type: "success", text: "已存入影片時間對照表，之後直接點選頁碼就能加入。" });
        } catch (error) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const removeSegment = async segment => {
        if (!window.confirm(`停用「${segment.title}」的影片時間對照？已發布的補課不受影響。`)) return;
        try {
            await deleteVideoSegment(firebaseUser, segment.id);
            setView(current => ({
                ...current,
                options: { ...current.options, video_segments: current.options.video_segments.filter(row => row.id !== segment.id) }
            }));
        } catch (error) {
            setMessage({ type: "error", text: error.message });
        }
    };

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const result = await saveClassSession(firebaseUser, {
                class_code: classCode,
                session_date: sessionDate,
                note,
                attendance: roster.filter(student => attendance[student.id]).map(student => ({ student_id: student.id, status: attendance[student.id] })),
                items
            });
            applyView(result);
            const makeup = await getMakeupOverview(firebaseUser, classCode);
            setOverview(makeup.sessions || []);
            const missed = (result.attendance || []).filter(row => needsMakeup(row.status)).length;
            setMessage({
                type: "success",
                text: missed && result.items.length
                    ? `已儲存。${missed} 位缺席／請假的學生已經看得到 ${result.items.length} 個補課按鈕。`
                    : missed ? "已儲存點名。加入今天的教學進度後，缺席／請假的學生才會看到補課按鈕。" : "已儲存點名與教學進度。"
            });
        } catch (error) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    if (boot && !boot.classes?.length) {
        return <main className="attendance-page"><section className="attendance-card"><h1>點名與補課</h1><p>目前沒有可以點名的班級，請管理員先設定你的班級權限。</p></section></main>;
    }

    return (
        <main className="attendance-page">
            <header className="attendance-hero">
                <div>
                    <span>CLASS ATTENDANCE</span>
                    <h1>點名與補課</h1>
                    <p>點名後填上今天教到哪裡，缺席或請假的學生就會自動拿到補課按鈕。</p>
                </div>
                <div className="attendance-controls">
                    <label>班級
                        <select value={classCode} onChange={event => setClassCode(event.target.value)}>
                            {(boot?.classes || []).map(code => <option key={code} value={code}>{code}</option>)}
                        </select>
                    </label>
                    <label>上課日期
                        <input type="date" value={sessionDate} max={boot?.today} onChange={event => event.target.value && setSessionDate(event.target.value)} />
                    </label>
                </div>
            </header>

            {message && <p className={`attendance-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}

            {loading ? <section className="attendance-card"><p>正在讀取班級資料…</p></section> : <>
                <section className="attendance-card" aria-labelledby="attendance-roster-title">
                    <div className="attendance-card-heading">
                        <h2 id="attendance-roster-title">1. 點名 <small>{markedCount}／{roster.length} 人</small></h2>
                        <button type="button" className="attendance-ghost" onClick={() => setAttendance(Object.fromEntries(roster.map(student => [student.id, attendance[student.id] || "present"])))}>未點名的都設為出席</button>
                    </div>
                    {roster.length === 0 ? <p>這個班級目前沒有在學學生。</p> : <ul className="attendance-roster">
                        {roster.map(student => <li key={student.id}>
                            <strong>{student.name}{student.english_name && student.english_name !== student.name ? <small>{student.english_name}</small> : null}</strong>
                            <div role="group" aria-label={`${student.name} 的出席狀態`}>
                                {ATTENDANCE_STATUS_OPTIONS.map(option => <button
                                    type="button" key={option.value} className={`attendance-status ${option.value}`}
                                    aria-pressed={attendance[student.id] === option.value}
                                    onClick={() => setAttendance(current => ({ ...current, [student.id]: option.value }))}
                                >{option.label}</button>)}
                            </div>
                        </li>)}
                    </ul>}
                </section>

                <section className="attendance-card" aria-labelledby="attendance-progress-title">
                    <div className="attendance-card-heading"><h2 id="attendance-progress-title">2. 今天的教學進度 <small>{items.length} 項</small></h2></div>
                    {items.length === 0 ? <p className="attendance-hint">還沒有加入進度。請從下方加入今天教的影片段落、聽力音檔或作業。</p> : <ol className="attendance-items">
                        {items.map((item, index) => <li key={item.id || itemKey(item)}>
                            <span className={`attendance-item-type ${item.item_type}`}>{itemTypeLabel(item.item_type)}</span>
                            <strong>{item.title}</strong>
                            {item.item_type === "video" && <small>{formatVideoRange(item.start_seconds, item.end_seconds)}</small>}
                            <button type="button" className="attendance-icon" aria-label={`移除 ${item.title}`} onClick={() => setItems(current => current.filter((_, position) => position !== index))}><FiTrash2 aria-hidden="true" /></button>
                        </li>)}
                    </ol>}

                    <div className="attendance-add">
                        <div className="attendance-tabs" role="group" aria-label="選擇要加入的進度類型">
                            {ITEM_TYPES.map(option => <button type="button" key={option.value} aria-pressed={itemType === option.value} onClick={() => setItemType(option.value)}>{option.icon}{option.label}</button>)}
                        </div>

                        {itemType !== "assignment" && <label>教材
                            <select value={bookId} onChange={event => { setBookId(event.target.value); setTrackId(""); }}>
                                {(options?.books || []).map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
                            </select>
                        </label>}

                        {itemType === "video" && <>
                            {bookSegments.length > 0 && <div className="attendance-segments">
                                <span>已建好時間的頁碼（點一下加入）</span>
                                <ul>{bookSegments.map(segment => <li key={segment.id}>
                                    <button type="button" onClick={() => addItem({ item_type: "video", title: segment.title, book_id: segment.book_id, video_segment_id: segment.id, video_url: segment.video_url, start_seconds: segment.start_seconds, end_seconds: segment.end_seconds })}>
                                        <FiPlus aria-hidden="true" />P.{segment.page_from}{segment.page_to > segment.page_from ? `–${segment.page_to}` : ""} · {formatVideoRange(segment.start_seconds, segment.end_seconds)}
                                    </button>
                                    {boot?.can_manage_segments && <button type="button" className="attendance-icon" aria-label={`停用 ${segment.title} 的對照`} onClick={() => removeSegment(segment)}><FiTrash2 aria-hidden="true" /></button>}
                                </li>)}</ul>
                            </div>}
                            <fieldset className="attendance-video-form">
                                <legend>{bookSegments.length ? "沒有對照的段落，手動填時間" : "手動填影片時間"}</legend>
                                <label className="wide">YouTube 影片網址<input type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={videoForm.url} onChange={event => setVideoForm(current => ({ ...current, url: event.target.value }))} /></label>
                                <label>開始（分:秒）<input type="text" inputMode="numeric" placeholder="12:30" value={videoForm.start} onChange={event => setVideoForm(current => ({ ...current, start: event.target.value }))} /></label>
                                <label>結束（分:秒）<input type="text" inputMode="numeric" placeholder="18:45" value={videoForm.end} onChange={event => setVideoForm(current => ({ ...current, end: event.target.value }))} /></label>
                                <label className="wide">顯示名稱（可不填）<input type="text" maxLength={120} placeholder="例如：習作本 3 P.12–13" value={videoForm.title} onChange={event => setVideoForm(current => ({ ...current, title: event.target.value }))} /></label>
                                <button type="button" className="attendance-secondary" onClick={addManualVideo}><FiPlus aria-hidden="true" />加入今天的進度</button>
                                {boot?.can_manage_segments && <div className="attendance-segment-save">
                                    <label>頁碼從<input type="number" min="1" max="999" value={videoForm.pageFrom} onChange={event => setVideoForm(current => ({ ...current, pageFrom: event.target.value }))} /></label>
                                    <label>到<input type="number" min="1" max="999" value={videoForm.pageTo} onChange={event => setVideoForm(current => ({ ...current, pageTo: event.target.value }))} /></label>
                                    <button type="button" className="attendance-ghost" disabled={saving || !bookId || !videoForm.pageFrom || !videoForm.url.trim()} onClick={saveSegment}>存成對照表（管理員）</button>
                                </div>}
                            </fieldset>
                        </>}

                        {itemType === "listening" && <div className="attendance-inline">
                            <label>音檔
                                <select value={trackId} onChange={event => setTrackId(event.target.value)}>
                                    <option value="">請選擇音檔</option>
                                    {bookTracks.map(track => <option key={track.id} value={track.id}>{track.page ? `P.${track.page} ` : ""}{track.title}</option>)}
                                </select>
                            </label>
                            <button type="button" className="attendance-secondary" disabled={!trackId} onClick={() => {
                                const track = bookTracks.find(row => String(row.id) === trackId);
                                if (track) addItem({ item_type: "listening", title: track.title, book_id: track.book_id, track_id: track.id });
                            }}><FiPlus aria-hidden="true" />加入</button>
                        </div>}

                        {itemType === "assignment" && <div className="attendance-inline">
                            <label>作業
                                <select value={assignmentId} onChange={event => setAssignmentId(event.target.value)}>
                                    <option value="">{options?.assignments?.length ? "請選擇已發布的作業" : "這個班級目前沒有已發布的作業"}</option>
                                    {(options?.assignments || []).map(assignment => <option key={assignment.id} value={assignment.id}>{assignment.assigned_date} {assignment.title || "老師指定的作業"}</option>)}
                                </select>
                            </label>
                            <button type="button" className="attendance-secondary" disabled={!assignmentId} onClick={() => {
                                const assignment = options.assignments.find(row => String(row.id) === assignmentId);
                                if (assignment) addItem({ item_type: "assignment", title: assignment.title || "老師指定的作業", assignment_id: assignment.id });
                            }}><FiPlus aria-hidden="true" />加入</button>
                        </div>}
                    </div>

                    <label className="attendance-note">給補課學生的話（可不填）
                        <textarea rows={2} maxLength={500} value={note} onChange={event => setNote(event.target.value)} />
                    </label>
                </section>

                <section className="attendance-save">
                    <p>{makeupStudents.length
                        ? `需要補課：${makeupStudents.map(student => student.name).join("、")}`
                        : "目前沒有缺席或請假的學生。"}</p>
                    <button type="button" className="attendance-primary" disabled={saving || roster.length === 0} onClick={save}><FiCheck aria-hidden="true" />{saving ? "儲存中…" : "儲存點名與進度"}</button>
                </section>

                <section className="attendance-card" aria-labelledby="attendance-overview-title">
                    <div className="attendance-card-heading"><h2 id="attendance-overview-title">補課進度 <small>最近 60 天</small></h2></div>
                    {overview.length === 0 ? <p className="attendance-hint">最近沒有需要補課的學生。</p> : <ul className="attendance-overview">
                        {overview.map(session => <li key={session.id}>
                            <button type="button" className="attendance-ghost" onClick={() => setSessionDate(session.session_date)}>{session.session_date}</button>
                            <ul>{session.students.map(student => <li key={student.student_id} className={session.total && student.done >= session.total ? "done" : ""}>
                                <span>{student.name}<small>{statusLabel(student.status)}</small></span>
                                <strong>{session.total ? `${student.done}／${session.total}` : "尚未填進度"}</strong>
                            </li>)}</ul>
                        </li>)}
                    </ul>}
                </section>
            </>}
        </main>
    );
};

export default TeacherAttendance;
