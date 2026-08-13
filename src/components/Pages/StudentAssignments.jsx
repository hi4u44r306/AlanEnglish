import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getStudentAssignments, submitAssignment } from "../../services/assignmentService";
import "./css/Assignments.scss";

const formatDateTime = value => {
    if (!value) return "—";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
};

const getListeningTracks = assignment => {
    if (Array.isArray(assignment?.tracks) && assignment.tracks.length) return assignment.tracks;
    if (assignment?.track) return [assignment.track];
    return [];
};

const getTrackLabel = track => track?.page || track?.title || track?.music_name || "音檔";

const StudentAssignments = () => {
    const { firebaseUser } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [today, setToday] = useState("");
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [activeAssignment, setActiveAssignment] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    const load = async () => {
        if (!firebaseUser) return;
        setLoading(true);
        setMessage("");
        try {
            const response = await getStudentAssignments(firebaseUser);
            setAssignments(response.assignments || []);
            setToday(response.today || "");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [firebaseUser]);

    const counts = useMemo(() => ({
        total: assignments.length,
        completed: assignments.filter(item => item.progress?.completed).length,
        pending: assignments.filter(item => !item.progress?.completed).length
    }), [assignments]);

    const openQuiz = assignment => {
        const questionCount = assignment.material?.content?.questions?.length || 0;
        setActiveAssignment(assignment);
        setAnswers(Array(questionCount).fill(""));
        setResult(null);
        setMessage("");
        window.setTimeout(() => document.getElementById("assignment-quiz")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    };

    const handleSubmit = async () => {
        if (!activeAssignment || submitting) return;
        if (answers.some(answer => !answer)) {
            setMessage("請先完成所有題目再提交。");
            return;
        }
        setSubmitting(true);
        setMessage("");
        try {
            const response = await submitAssignment(firebaseUser, activeAssignment.id, answers);
            setResult(response);
            setAssignments(current => current.map(item => item.id === activeAssignment.id ? { ...item, progress: response.progress } : item));
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="assignment-page student-homework-page">
            <section className="assignment-hero">
                <div>
                    <span>MY HOMEWORK</span>
                    <h1>今日作業</h1>
                    <p>{today || "今天"} · 完成老師發布的英文練習，AI 教材需達及格分數才算完成。</p>
                </div>
                <div className="assignment-student-stats">
                    <div><strong>{counts.pending}</strong><span>待完成</span></div>
                    <div><strong>{counts.completed}</strong><span>已完成</span></div>
                </div>
            </section>
            {message && <div className="assignment-message">{message}</div>}
            <section className="student-assignment-grid">
                {loading ? <div className="assignment-card assignment-empty">正在載入今日作業...</div> : assignments.length === 0 ? <div className="assignment-card assignment-empty">今天目前沒有老師發布的作業 🎉</div> : assignments.map(item => {
                    const listeningTracks = getListeningTracks(item);
                    const requiredListens = Number(item.required_listens || listeningTracks[0]?.required_listens || 7);
                    const completedTracks = listeningTracks.filter(track => Number(track.play_count || track.progress?.play_count || 0) >= Number(track.required_listens || requiredListens)).length;
                    const bookCode = item.track?.book?.code || listeningTracks[0]?.book?.code || "";
                    const assignmentTrackIds = listeningTracks.map(track => track.id || track.track_id).filter(Boolean).join(",");
                    const listeningUrl = `/student/books/${bookCode}?assignment=${encodeURIComponent(item.id)}&tracks=${encodeURIComponent(assignmentTrackIds)}`;
                    return (
                        <article className={`assignment-card student-assignment-card ${item.progress?.completed ? "completed" : ""}`} key={item.id}>
                            <div className="student-assignment-top">
                                <span className={`assignment-kind ${item.source_type}`}>{item.source_type === "ai_material" ? "AI 教材" : "聽力作業"}</span>
                                <span>{item.progress?.completed ? "✅ 已完成" : "⏳ 待完成"}</span>
                            </div>
                            <h2>{item.title}</h2>
                            {item.description && <p>{item.description}</p>}
                            <div className="student-assignment-meta"><span>發布：{item.assigned_date}</span><span>截止：{formatDateTime(item.due_at)}</span></div>
                            {item.source_type === "ai_material" ? (
                                <>
                                    <div className="student-assignment-score">
                                        <div><span>最高分</span><strong>{item.progress?.best_score || 0}</strong></div>
                                        <div><span>作答</span><strong>{item.progress?.attempt_count || 0} 次</strong></div>
                                        <div><span>及格</span><strong>{item.passing_score} 分</strong></div>
                                    </div>
                                    <button type="button" className="assignment-primary" onClick={() => openQuiz(item)}>{item.progress?.completed ? "再次複習" : "開始作業"}</button>
                                </>
                            ) : (
                                <>
                                    <div className="assignment-listening-detail">
                                        <div className="assignment-listening-heading">
                                            <div><span>TODAY'S LISTENING</span><strong>今天要聽的音檔</strong></div>
                                            <em>{completedTracks} / {listeningTracks.length} 完成</em>
                                        </div>
                                        <div className="assignment-listening-tracks">
                                            {listeningTracks.length ? listeningTracks.map((track, index) => {
                                                const count = Number(track.play_count || track.progress?.play_count || 0);
                                                const target = Number(track.required_listens || requiredListens);
                                                const done = count >= target;
                                                return <div className={`assignment-listening-track ${done ? "done" : ""}`} key={track.id || track.track_id || index}><strong>{getTrackLabel(track)}</strong><span>{done ? "✓ " : ""}{count} / {target} 次</span></div>;
                                            }) : <div className="assignment-listening-empty">正在同步老師指定的音檔...</div>}
                                        </div>
                                    </div>
                                    <Link className="assignment-primary link" to={listeningUrl}>前往今日聽力</Link>
                                </>
                            )}
                        </article>
                    );
                })}
            </section>
            {activeAssignment?.material && (
                <section className="assignment-card assignment-quiz" id="assignment-quiz">
                    <div className="assignment-card-heading"><span>HOMEWORK QUIZ</span><h2>{activeAssignment.material.title}</h2><p>全部作答後再提交；提交前不會顯示答案。</p></div>
                    {activeAssignment.material.content?.passage && <div className="assignment-passage"><h3>Reading</h3><p>{activeAssignment.material.content.passage}</p></div>}
                    <div className="assignment-question-list">
                        {(activeAssignment.material.content?.questions || []).map((question, questionIndex) => (
                            <div className="assignment-question" key={questionIndex}>
                                <strong>Q{questionIndex + 1}. {question.question}</strong>
                                <div className="assignment-options">
                                    {(question.options || []).map((option, optionIndex) => {
                                        const checked = answers[questionIndex] === option;
                                        const questionResult = result?.results?.[questionIndex];
                                        const isCorrectAnswer = questionResult && questionResult.correct_answer === option;
                                        const isWrongSelected = questionResult && checked && !questionResult.correct;
                                        return <label className={`${checked ? "selected" : ""} ${isCorrectAnswer ? "correct" : ""} ${isWrongSelected ? "wrong" : ""}`} key={optionIndex}><input type="radio" name={`assignment-question-${questionIndex}`} checked={checked} disabled={Boolean(result)} onChange={() => setAnswers(current => current.map((answer, index) => index === questionIndex ? option : answer))}/><span>{String.fromCharCode(65 + optionIndex)}.</span><em>{option}</em></label>;
                                    })}
                                </div>
                                {result?.results?.[questionIndex] && <div className={`assignment-explanation ${result.results[questionIndex].correct ? "correct" : "wrong"}`}><strong>{result.results[questionIndex].correct ? "答對了" : `正確答案：${result.results[questionIndex].correct_answer}`}</strong>{result.results[questionIndex].explanation && <p>{result.results[questionIndex].explanation}</p>}</div>}
                            </div>
                        ))}
                    </div>
                    {result ? <div className={`assignment-score-result ${result.passed ? "passed" : "failed"}`}><strong>{result.score} 分</strong><span>{result.passed ? "🎉 作業完成" : `尚未完成，需要 ${result.passing_score} 分以上`}</span>{!result.passed && <button type="button" onClick={() => openQuiz(activeAssignment)}>重新挑戰</button>}</div> : <button type="button" className="assignment-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? "批改中..." : "提交答案"}</button>}
                </section>
            )}
        </main>
    );
};

export default StudentAssignments;
