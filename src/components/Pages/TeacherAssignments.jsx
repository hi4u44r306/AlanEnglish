import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
    createAssignment,
    getAssignmentResults,
    getTeacherAssignmentBootstrap,
    getTeacherAssignments
} from "../../services/assignmentService";
import "./css/Assignments.scss";

const todayTaiwan = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());

const TeacherAssignments = () => {
    const { firebaseUser } = useAuth();
    const [classes, setClasses] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [tracks, setTracks] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [results, setResults] = useState(null);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [form, setForm] = useState({
        title: "",
        description: "",
        source_type: "ai_material",
        source_id: "",
        target_class: "",
        assigned_date: todayTaiwan(),
        due_date: todayTaiwan(),
        passing_score: 90
    });

    const sourceOptions = useMemo(() => form.source_type === "ai_material" ? materials : tracks, [form.source_type, materials, tracks]);

    const load = async () => {
        if (!firebaseUser) return;
        setLoading(true);
        setMessage("");
        try {
            const [bootstrap, list] = await Promise.all([
                getTeacherAssignmentBootstrap(firebaseUser),
                getTeacherAssignments(firebaseUser)
            ]);
            setClasses(bootstrap.classes || []);
            setMaterials(bootstrap.materials || []);
            setTracks(bootstrap.tracks || []);
            setAssignments(list.assignments || []);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [firebaseUser]);

    const handleSourceType = value => {
        setForm(current => ({ ...current, source_type: value, source_id: "" }));
    };

    const handleSubmit = async event => {
        event.preventDefault();
        if (!form.title.trim()) return setMessage("請輸入作業名稱");
        if (!form.source_id) return setMessage("請選擇要發布的教材或音檔");

        setSaving(true);
        setMessage("");
        try {
            const dueAt = form.due_date ? new Date(`${form.due_date}T23:59:00+08:00`).toISOString() : null;
            await createAssignment(firebaseUser, {
                title: form.title.trim(),
                description: form.description.trim(),
                source_type: form.source_type,
                ai_material_id: form.source_type === "ai_material" ? Number(form.source_id) : null,
                track_id: form.source_type === "music_track" ? Number(form.source_id) : null,
                target_class: form.target_class || null,
                assigned_date: form.assigned_date,
                due_at: dueAt,
                passing_score: Number(form.passing_score) || 90
            });
            setMessage("作業已發布。");
            setForm(current => ({ ...current, title: "", description: "", source_id: "" }));
            await load();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSaving(false);
        }
    };

    const openResults = async assignment => {
        setResultsLoading(true);
        setMessage("");
        try {
            const result = await getAssignmentResults(firebaseUser, assignment.id);
            setResults(result);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setResultsLoading(false);
        }
    };

    return (
        <main className="assignment-page">
            <section className="assignment-hero">
                <div>
                    <span>TEACHER HOMEWORK</span>
                    <h1>發布作業</h1>
                    <p>把已生成的 AI 教材或指定聽力音檔直接發布給班級，不需要重新消耗 AI 額度。</p>
                </div>
                <div className="assignment-date-card"><strong>{todayTaiwan()}</strong><span>台灣日期</span></div>
            </section>

            {message && <div className="assignment-message">{message}</div>}

            <section className="assignment-layout">
                <form className="assignment-card assignment-form" onSubmit={handleSubmit}>
                    <div className="assignment-card-heading"><span>NEW ASSIGNMENT</span><h2>建立今日作業</h2></div>

                    <label><span>作業名稱</span><input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="例如：Unit 3 School Life" /></label>
                    <label><span>作業說明（選填）</span><textarea rows="3" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="例如：回家完成，90 分以上才算通過。" /></label>

                    <div className="assignment-source-tabs">
                        <button type="button" className={form.source_type === "ai_material" ? "active" : ""} onClick={() => handleSourceType("ai_material")}>AI 教材</button>
                        <button type="button" className={form.source_type === "music_track" ? "active" : ""} onClick={() => handleSourceType("music_track")}>聽力音檔</button>
                    </div>

                    <label>
                        <span>{form.source_type === "ai_material" ? "選擇我的 AI 教材" : "選擇指定音檔"}</span>
                        <select value={form.source_id} onChange={event => setForm({ ...form, source_id: event.target.value })}>
                            <option value="">請選擇...</option>
                            {sourceOptions.map(item => (
                                <option key={item.id} value={item.id}>
                                    {form.source_type === "ai_material"
                                        ? `${item.title}${item.difficulty ? ` · ${item.difficulty}` : ""}`
                                        : `${item.book?.name || "教材"} · ${item.display_page || item.page}`
                                    }
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="assignment-form-grid">
                        <label><span>班級</span><select value={form.target_class} onChange={event => setForm({ ...form, target_class: event.target.value })}><option value="">全部學生</option>{classes.map(className => <option key={className} value={className}>{className} 班</option>)}</select></label>
                        <label><span>及格標準</span><select value={form.passing_score} disabled={form.source_type === "music_track"} onChange={event => setForm({ ...form, passing_score: event.target.value })}><option value="90">90 分</option><option value="80">80 分</option><option value="100">100 分</option></select></label>
                        <label><span>發布日期</span><input type="date" value={form.assigned_date} onChange={event => setForm({ ...form, assigned_date: event.target.value })} /></label>
                        <label><span>截止日期</span><input type="date" value={form.due_date} onChange={event => setForm({ ...form, due_date: event.target.value })} /></label>
                    </div>

                    <button className="assignment-primary" type="submit" disabled={saving || loading}>{saving ? "發布中..." : "發布作業"}</button>
                    <small>{form.source_type === "ai_material" ? "學生必須達到設定分數才完成。" : "聽力作業沿用音檔規則：播放 7 次即完成。"}</small>
                </form>

                <section className="assignment-card assignment-history">
                    <div className="assignment-card-heading"><span>HISTORY</span><h2>已發布作業</h2></div>
                    {loading ? <div className="assignment-empty">載入中...</div> : assignments.length === 0 ? <div className="assignment-empty">目前還沒有作業。</div> : (
                        <div className="assignment-list">
                            {assignments.map(item => (
                                <article key={item.id}>
                                    <div><strong>{item.title}</strong><span>{item.target_class ? `${item.target_class} 班` : "全部學生"} · {item.assigned_date}</span></div>
                                    <div className="assignment-history-actions">
                                        <span className={`assignment-kind ${item.source_type}`}>{item.source_type === "ai_material" ? "AI 教材" : "聽力"}</span>
                                        <button type="button" onClick={() => openResults(item)}>查看完成狀況</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </section>

            {(results || resultsLoading) && (
                <section className="assignment-card assignment-results">
                    <div className="assignment-card-heading"><span>RESULTS</span><h2>{resultsLoading ? "載入中..." : results.assignment?.title}</h2></div>
                    {!resultsLoading && (
                        <div className="assignment-result-table">
                            <div className="assignment-result-row header"><span>學生</span><span>班級</span><span>成績 / 次數</span><span>狀態</span></div>
                            {(results.rows || []).map(row => (
                                <div className="assignment-result-row" key={row.student.id}>
                                    <span>{row.student.name}</span><span>{row.student.class || "—"}</span>
                                    <span>{results.assignment.source_type === "ai_material" ? `${row.best_score || 0} 分 · ${row.attempt_count || 0} 次` : `${row.play_count || 0} / 7 次`}</span>
                                    <span>{row.completed ? "✅ 已完成" : "⏳ 未完成"}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </main>
    );
};

export default TeacherAssignments;
