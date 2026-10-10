import useUnsavedChanges from "../../hooks/useUnsavedChanges";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getLevelAdminCatalog, setStudentLevel, updateBookLevel, updatePromotionExam } from "../../services/learningProgressService";
import "./css/Platform.scss";
import PromotionQuestionsEditor, { validatePromotionQuestions } from "../fragment/PromotionQuestionsEditor";

function LevelAdmin() {
    const { firebaseUser } = useAuth();
    const examBaseline = useRef("");
    const [data, setData] = useState(null);
    const [editingExam, setEditingExam] = useState(null);
    const [questionsJson, setQuestionsJson] = useState("[]");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState("");
    const examDialog = useRef(null);
    const examBusy = useRef(false);
    examBusy.current = Boolean(working);
    const examSnapshot = JSON.stringify([editingExam, questionsJson]);
    const confirmDiscardExam = useUnsavedChanges(Boolean(editingExam && examSnapshot !== examBaseline.current), { enabled: Boolean(firebaseUser?.uid) });
    const closeExam = useCallback(() => { if (!examBusy.current && confirmDiscardExam()) setEditingExam(null); }, [confirmDiscardExam]);
    const examId = editingExam?.id;
    useEffect(() => {
        if (examId == null) return;
        const previous = document.activeElement, overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        examDialog.current?.focus();
        const keydown = event => {
            if (event.key === "Escape" && !examBusy.current) { event.preventDefault(); closeExam(); }
            if (event.key !== "Tab") return;
            const nodes = Array.from(examDialog.current?.querySelectorAll("button, input, textarea, select, summary") || [])
                .filter(node => !node.matches(":disabled") && node.getClientRects().length);
            if (!nodes.length) { event.preventDefault(); examDialog.current?.focus(); return; }
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === examDialog.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === examDialog.current)) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener("keydown", keydown);
        return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
    }, [examId, closeExam]);

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
    const openExam = exam => { const json = JSON.stringify(exam.questions || [], null, 2); examBaseline.current = JSON.stringify([{ ...exam }, json]); setEditingExam({ ...exam }); setQuestionsJson(json); };
    const saveExam = async event => {
        event.preventDefault();
        if (examBusy.current) return;
        let questions;
        try { questions = JSON.parse(questionsJson); } catch { return toast.error("題目 JSON 格式不正確"); }
        const validationError = validatePromotionQuestions(questionsJson);
        if (validationError) return toast.error(validationError);
        setWorking(`exam-${editingExam.id}`);
        try { await updatePromotionExam(firebaseUser, { exam_id: editingExam.id, title: editingExam.title, description: editingExam.description, passing_score: Number(editingExam.passing_score), enabled: editingExam.enabled !== false, questions }); toast.success("晉級測驗已更新"); setEditingExam(null); await load(); }
        catch (error) { toast.error(error.message || "測驗更新失敗"); }
        finally { setWorking(""); }
    };

    if (loading) return <div className="platform-loading">等級管理資料載入中…</div>;
    return <main className="platform-page"><header className="platform-hero"><div><span className="platform-eyebrow">LEVEL ADMIN</span><h1>等級、教材與晉級測驗</h1><p>學生只能進入目前已解鎖等級以下的教材；通過測驗後會自動晉級。</p></div></header><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">LEVELS</span><h2>等級制度</h2></div></div><div className="platform-level-cards">{(data?.levels || []).map(level => <article key={level.id} style={{ "--level-color": level.badge_color }}><strong>{level.rank}</strong><div><h3>{level.name_zh}</h3><span>{level.name_en}</span><p>{level.description}</p></div></article>)}</div></section><div className="platform-two-column"><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">BOOKS</span><h2>教材需要等級</h2></div></div><div className="platform-list compact">{(data?.books || []).map(book => <article key={book.id}><div><strong>{book.name}</strong><p>{book.code}</p></div><select value={book.required_level_id || data.levels?.[0]?.id || ""} disabled={working === `book-${book.id}`} onChange={event => changeBookLevel(book.id, event.target.value)}>{data.levels.map(level => <option key={level.id} value={level.id}>{level.rank}. {level.name_zh}</option>)}</select></article>)}</div></section><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">STUDENTS</span><h2>學生目前等級</h2></div></div><div className="platform-list compact">{(data?.students || []).map(student => <article key={student.id}><div><strong>{student.name}</strong><p>{student.class ? `${student.class} 班` : student.email}</p></div><select value={student.level_progress?.current_level_id || data.levels?.[0]?.id || ""} disabled={working === `student-${student.id}`} onChange={event => changeStudentLevel(student.id, event.target.value)}>{data.levels.map(level => <option key={level.id} value={level.id}>{level.rank}. {level.name_zh}</option>)}</select></article>)}</div></section></div><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">PROMOTION EXAMS</span><h2>晉級測驗</h2></div></div><div className="platform-list">{(data?.exams || []).map(exam => <article key={exam.id}><div><strong>{exam.title}</strong><p>{exam.from_level?.name_zh} → {exam.to_level?.name_zh}｜{exam.question_count} 題｜{exam.passing_score} 分</p></div><button className="platform-secondary" onClick={() => openExam(exam)}>編輯測驗</button></article>)}</div></section>{editingExam && <div className="platform-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeExam()}><form ref={examDialog} tabIndex={-1} className="platform-modal" role="dialog" aria-modal="true" aria-labelledby="level-exam-title" onSubmit={saveExam}><fieldset disabled={Boolean(working)} style={{ border: 0, padding: 0, minWidth: 0 }}><span className="platform-eyebrow">EDIT EXAM</span><h2 id="level-exam-title">編輯晉級測驗</h2><label><span>標題</span><input value={editingExam.title} onChange={event => setEditingExam(current => ({ ...current, title: event.target.value }))} /></label><label><span>說明</span><textarea value={editingExam.description || ""} onChange={event => setEditingExam(current => ({ ...current, description: event.target.value }))} /></label><div className="platform-form-grid"><label><span>及格分數</span><input type="number" min="50" max="100" value={editingExam.passing_score} onChange={event => setEditingExam(current => ({ ...current, passing_score: Number(event.target.value) }))} /></label><label className="platform-check"><input type="checkbox" checked={editingExam.enabled !== false} onChange={event => setEditingExam(current => ({ ...current, enabled: event.target.checked }))} /><span>啟用測驗</span></label></div><PromotionQuestionsEditor value={questionsJson} onChange={setQuestionsJson} disabled={working === `exam-${editingExam.id}`} /><div className="platform-modal-actions"><button type="button" className="platform-secondary" onClick={closeExam}>取消</button><button className="platform-primary" disabled={working === `exam-${editingExam.id}`}>儲存測驗</button></div></fieldset></form></div>}</main>;
}

export default LevelAdmin;
