import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getLearningDashboard, getPromotionExam, submitPromotionExam } from "../../services/learningProgressService";
import "./css/Platform.scss";

function LearningLevel() {
    const { firebaseUser } = useAuth();
    const [dashboard, setDashboard] = useState(null);
    const [exam, setExam] = useState(null);
    const [answers, setAnswers] = useState({});
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try { setDashboard(await getLearningDashboard(firebaseUser)); }
        catch (error) { toast.error(error.message || "等級資料讀取失敗"); }
        finally { setLoading(false); }
    }, [firebaseUser]);

    useEffect(() => { load(); }, [load]);
    const currentRank = Number(dashboard?.progress?.unlocked_rank || 1);
    const currentLevel = dashboard?.progress?.learning_levels || dashboard?.levels?.find(level => Number(level.rank) === currentRank);
    const groupedBooks = useMemo(() => (dashboard?.levels || []).map(level => ({ ...level, books: (dashboard?.books || []).filter(book => Number(book.required_rank || 1) === Number(level.rank)) })), [dashboard]);

    const openExam = async examId => {
        setWorking(true);
        try {
            const response = await getPromotionExam(firebaseUser, examId);
            setExam(response.exam);
            setAnswers({});
            setResult(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) { toast.error(error.message || "測驗讀取失敗"); }
        finally { setWorking(false); }
    };

    const submit = async event => {
        event.preventDefault();
        if (!exam) return;
        const ordered = exam.questions.map(question => answers[question.index] || "");
        if (ordered.some(answer => !answer)) return toast.error("請完成所有題目再送出");
        setWorking(true);
        try {
            const response = await submitPromotionExam(firebaseUser, exam.id, ordered);
            setResult(response);
            if (response.passed) { toast.success(`晉級成功！已解鎖 ${response.promoted_to?.name_zh || "下一級"}`); await load(); }
        } catch (error) { toast.error(error.message || "送出測驗失敗"); }
        finally { setWorking(false); }
    };

    if (loading) return <div className="platform-loading">等級資料載入中…</div>;

    if (exam) return (
        <main className="platform-page platform-narrow">
            <button className="platform-back" onClick={() => { setExam(null); setResult(null); }}>← 返回等級中心</button>
            <header className="platform-hero"><div><span className="platform-eyebrow">PROMOTION EXAM</span><h1>{exam.title}</h1><p>{exam.description}｜及格標準 {exam.passing_score} 分</p></div></header>
            <form className="platform-quiz" onSubmit={submit}>{exam.questions.map((question, index) => <fieldset key={question.index}><legend><span>{index + 1}</span>{question.question}</legend><div className="platform-options">{question.options.map(option => <label key={option} className={answers[question.index] === option ? "selected" : ""}><input type="radio" name={`question-${question.index}`} value={option} checked={answers[question.index] === option} onChange={() => setAnswers(current => ({ ...current, [question.index]: option }))} disabled={Boolean(result)} /><span>{option}</span></label>)}</div>{result?.results?.[index] && <div className={`platform-feedback ${result.results[index].is_correct ? "correct" : "wrong"}`}><strong>{result.results[index].is_correct ? "答對了" : `正確答案：${result.results[index].correct_answer}`}</strong>{result.results[index].explanation && <p>{result.results[index].explanation}</p>}</div>}</fieldset>)}{result ? <section className={`platform-result ${result.passed ? "passed" : "failed"}`}><h2>{result.passed ? "晉級成功！" : "再練習一下就可以了"}</h2><strong>{result.score} 分</strong><p>及格標準 {result.passing_score} 分</p><button type="button" className="platform-primary" onClick={() => { setExam(null); setResult(null); }}>回到等級中心</button></section> : <button className="platform-primary platform-wide" disabled={working}>{working ? "評分中…" : "送出測驗"}</button>}</form>
        </main>
    );

    return (
        <main className="platform-page">
            <header className="platform-hero"><div><span className="platform-eyebrow">LEARNING LEVEL</span><h1>我的英文等級</h1><p>完成目前階段的練習並通過晉級測驗，就能解鎖下一級教材。</p></div><Link className="platform-secondary" to="/student/leaderboard">查看學習排行榜</Link></header>
            <section className="platform-level-summary" style={{ "--level-color": currentLevel?.badge_color || "#3b82f6" }}><div className="platform-level-badge">{currentRank}</div><div><span>目前等級</span><h2>{currentLevel?.name_zh || "入門級"} <small>{currentLevel?.name_en || "Starter"}</small></h2><p>{currentLevel?.description}</p></div><strong>{dashboard?.progress?.total_points || 0} 點</strong></section>
            {!dashboard?.membership_active && <section className="platform-alert"><strong>會員期限已結束</strong><p>續訂或輸入教材啟用碼後，才能參加晉級測驗。</p><Link to="/student/membership">前往會員方案</Link></section>}
            <section className="platform-level-path">{groupedBooks.map(level => { const unlocked = Number(level.rank) <= currentRank; return <article className={unlocked ? "unlocked" : "locked"} key={level.id}><div className="platform-level-node" style={{ background: level.badge_color }}>{unlocked ? "✓" : "🔒"}</div><div><span>LEVEL {level.rank}</span><h3>{level.name_zh} · {level.name_en}</h3><p>{level.description}</p><div className="platform-chip-row">{level.books.map(book => <Link className={book.locked ? "locked" : ""} key={book.id} to={book.locked ? "/student/level" : `/student/books/${book.code}`}>{book.name}{book.locked ? " 🔒" : ""}</Link>)}</div></div></article>; })}</section>
            <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">EXAMS</span><h2>晉級測驗</h2></div></div><div className="platform-list">{(dashboard?.exams || []).map(item => <article key={item.id}><div><strong>{item.title}</strong><p>{item.from_level?.name_zh} → {item.to_level?.name_zh}｜{item.question_count} 題｜{item.passing_score} 分及格</p>{item.best_attempt && <span>最高 {item.best_attempt.score} 分</span>}</div><button className="platform-secondary" disabled={!item.eligible || working} onClick={() => openExam(item.id)}>{item.already_unlocked ? "已通過" : item.eligible ? "開始測驗" : "尚未開放"}</button></article>)}</div></section>
        </main>
    );
}

export default LearningLevel;
