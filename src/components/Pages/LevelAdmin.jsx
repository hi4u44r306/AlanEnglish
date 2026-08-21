import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getLevelAdminCatalog, setStudentLevel, updateBookLevel, updatePromotionExam } from "../../services/learningProgressService";
import "./css/Platform.scss";

function LevelAdmin() {
    const { firebaseUser } = useAuth();
    const [data, setData] = useState(null);
    const [editingExam, setEditingExam] = useState(null);
    const [questionsJson, setQuestionsJson] = useState("[]");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState("");

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try { setData(await getLevelAdminCatalog(firebaseUser)); }
        catch (error) { toast.error(error.message || "等級管理資料讀取失敗"); }
        finally { setLoading(false); }
    }, [firebaseUser]);
    useEffect(() => { load(); }, [load]);

    const changeBookLevel = async (bookId, levelId) => {
        setWorking(`book-${bookId}`);
        try { await updateBookLevel(firebaseUser, bookId, Number(levelId)); toast.success("教材等級已更新"); await load(); }
        catch (error) { toast.error(error.message || "教材等級更新失敗"); }
        finally { setWorking(""); }
    };
    const changeStudentLevel = async (studentId, levelId) => {
        setWorking(`student-${studentId}`);
        try { await setStudentLevel(firebaseUser, studentId, Number(levelId)); toast.success("學生等級已更新"); await load(); }
        catch (error) { toast.error(error.message || "學生等級更新失敗"); }
        finally { setWorking(""); }
    };
    const openExam = exam => { setEditingExam({ ...exam }); setQuestionsJson(JSON.stringify(exam.questions || [], null, 2)); };
    const saveExam = async event => {
        event.preventDefault();
        let questions;
        try { questions = JSON.parse(questionsJson); } catch { return toast.error("題目 JSON 格式不正確"); }
        setWorking(`exam-${editingExam.id}`);
        try { await updatePromotionExam(firebaseUser, { exam_id: editingExam.id, title: editingExam.title, description: editingExam.description, passing_score: Number(editingExam.passing_score), enabled: editingExam.enabled !== false, questions }); toast.success("晉級測驗已更新"); setEditingExam(null); await load(); }
        catch (error) { toast.error(error.message || "測驗更新失敗"); }
        finally { setWorking(""); }
    };

    if (loading) return <div className="platform-loading">等級管理資料載入中…</div>;
    return <main className="platform-page"><header className="platform-hero"><div><span className="platform-eyebrow">LEVEL ADMIN</span><h1>等級、教材與晉級測驗</h1><p>學生只能進入目前已解鎖等級以下的教材；通過測驗後會自動晉級。</p></div></header><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">LEVELS</span><h2>等級制度</h2></div></div><div className="platform-level-cards">{(data?.levels || []).map(level => <article key={level.id} style={{ "--level-color": level.badge_color }}><strong>{level.rank}</strong><div><h3>{level.name_zh}</h3><span>{level.name_en}</span><p>{level.description}</p></div></article>)}</div></section><div className="platform-two-column"><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">BOOKS</span><h2>教材需要等級</h2></div></div><div className="platform-list compact">{(data?.books || []).map(book => <article key={book.id}><div><strong>{book.name}</strong><p>{book.code}</p></div><select value={book.required_level_id || data.levels?.[0]?.id || ""} disabled={working === `book-${book.id}`} onChange={event => changeBookLevel(book.id, event.target.value)}>{data.levels.map(level => <option key={level.id} value={level.id}>{level.rank}. {level.name_zh}</option>)}</select></article>)}</div></section><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">STUDENTS</span><h2>學生目前等級</h2></div></div><div className="platform-list compact">{(data?.students || []).map(student => <article key={student.id}><div><strong>{student.name}</strong><p>{student.class ? `${student.class} 班` : student.email}</p></div><select value={student.level_progress?.current_level_id || data.levels?.[0]?.id || ""} disabled={working === `student-${student.id}`} onChange={event => changeStudentLevel(student.id, event.target.value)}>{data.levels.map(level => <option key={level.id} value={level.id}>{level.rank}. {level.name_zh}</option>)}</select></article>)}</div></section></div><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">PROMOTION EXAMS</span><h2>晉級測驗</h2></div></div><div className="platform-list">{(data?.exams || []).map(exam => <article key={exam.id}><div><strong>{exam.title}</strong><p>{exam.from_level?.name_zh} → {exam.to_level?.name_zh}｜{exam.question_count} 題｜{exam.passing_score} 分</p></div><button className="platform-secondary" onClick={() => openExam(exam)}>編輯測驗</button></article>)}</div></section>{editingExam && <div className="platform-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setEditingExam(null)}><form className="platform-modal" onSubmit={saveExam}><span className="platform-eyebrow">EDIT EXAM</span><h2>編輯晉級測驗</h2><label><span>標題</span><input value={editingExam.title} onChange={event => setEditingExam(current => ({ ...current, title: event.target.value }))} /></label><label><span>說明</span><textarea value={editingExam.description || ""} onChange={event => setEditingExam(current => ({ ...current, description: event.target.value }))} /></label><div className="platform-form-grid"><label><span>及格分數</span><input type="number" min="50" max="100" value={editingExam.passing_score} onChange={event => setEditingExam(current => ({ ...current, passing_score: Number(event.target.value) }))} /></label><label className="platform-check"><input type="checkbox" checked={editingExam.enabled !== false} onChange={event => setEditingExam(current => ({ ...current, enabled: event.target.checked }))} /><span>啟用測驗</span></label></div><label><span>題目 JSON（5～50 題，每題四個 options，answer 必須在 options 中）</span><textarea className="platform-code-editor" value={questionsJson} onChange={event => setQuestionsJson(event.target.value)} spellCheck="false" /></label><div className="platform-modal-actions"><button type="button" className="platform-secondary" onClick={() => setEditingExam(null)}>取消</button><button className="platform-primary" disabled={working === `exam-${editingExam.id}`}>儲存測驗</button></div></form></div>}</main>;
}

export default LevelAdmin;
