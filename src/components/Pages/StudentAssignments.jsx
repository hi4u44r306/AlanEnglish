import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    BookOpenCheck,
    CalendarDays,
    Check,
    CheckCircle2,
    Clock3,
    Headphones,
    Sparkles,
    Target
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getStudentAssignments, submitAssignment } from "../../services/assignmentService";
import "./css/Assignments.scss";
import "./css/StudentAssignments.scss";

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

const formatToday = value => {
    if (!value) return "今天";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
    }).format(new Date(value));
};

const normalizeListeningTracks = assignment => {
    if (Array.isArray(assignment?.tracks) && assignment.tracks.length) {
        return assignment.tracks.map((item, index) => {
            const track = item?.track || item || {};
            const requiredListens = Number(item?.required_listens || assignment?.required_listens || 7);
            const playCount = Number(item?.play_count ?? track?.play_count ?? 0);
            return {
                key: track?.id || item?.track_id || item?.id || index,
                id: track?.id || item?.track_id || item?.id || null,
                label: track?.display_page || track?.page || track?.title || track?.music_name || `音檔 ${index + 1}`,
                book: track?.book || item?.book || assignment?.track?.book || null,
                requiredListens,
                playCount,
                completed: Boolean(item?.completed) || playCount >= requiredListens
            };
        });
    }

    if (assignment?.track) {
        const requiredListens = Number(assignment?.required_listens || 7);
        const playCount = Number(assignment?.progress?.play_count || 0);
        return [{
            key: assignment.track.id,
            id: assignment.track.id,
            label: assignment.track.display_page || assignment.track.page || assignment.track.title || "音檔",
            book: assignment.track.book || null,
            requiredListens,
            playCount,
            completed: Boolean(assignment?.progress?.completed) || playCount >= requiredListens
        }];
    }

    return [];
};

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

    const load = useCallback(async () => {
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
    }, [firebaseUser]);

    useEffect(() => {
        load();
    }, [load]);

    const counts = useMemo(() => ({
        total: assignments.length,
        completed: assignments.filter(item => item.progress?.completed).length,
        pending: assignments.filter(item => !item.progress?.completed).length
    }), [assignments]);

    const completionRate = counts.total ? Math.round((counts.completed / counts.total) * 100) : 0;

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
            setAssignments(current => current.map(item => item.id === activeAssignment.id
                ? { ...item, progress: response.progress }
                : item
            ));
        } catch (error) {
            setMessage(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="assignment-page student-homework-page">
            <div className="student-homework-shell">
                <section className="student-homework-hero">
                    <div className="student-homework-hero__copy">
                        <span className="student-homework-eyebrow">
                            <CalendarDays aria-hidden="true" size={17} />
                            {formatToday(today)}
                        </span>
                        <h1>{counts.pending ? `今天還有 ${counts.pending} 項任務` : "今天的任務都完成了"}</h1>
                        <p>{counts.pending ? "照自己的節奏完成，每一次練習都會累積進步。" : "做得很好！你已經完成老師今天安排的所有練習。"}</p>
                    </div>

                    <div className="student-homework-progress" role="progressbar" aria-label="今日作業完成進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completionRate}>
                        <div className="student-homework-progress__ring" style={{ "--homework-progress": `${completionRate * 3.6}deg` }}>
                            <div>
                                <strong>{completionRate}</strong>
                                <span>%</span>
                            </div>
                        </div>
                        <div className="student-homework-progress__copy">
                            <span>今日進度</span>
                            <strong>{counts.completed} / {counts.total} 已完成</strong>
                        </div>
                    </div>
                </section>

                <section className="student-homework-summary" aria-label="作業統計">
                    <div className="student-homework-summary__item pending">
                        <span><Clock3 aria-hidden="true" size={18} />待完成</span>
                        <strong>{counts.pending}</strong>
                    </div>
                    <div className="student-homework-summary__item completed">
                        <span><CheckCircle2 aria-hidden="true" size={18} />已完成</span>
                        <strong>{counts.completed}</strong>
                    </div>
                    <div className="student-homework-summary__tip">
                        <Target aria-hidden="true" size={20} />
                        <span>AI 教材達到老師設定的及格分數，聽力完成指定次數，就會自動記錄完成。</span>
                    </div>
                </section>

                {message && <div className="assignment-message">{message}</div>}

                <section className="student-homework-tasks">
                    <div className="student-homework-section-heading">
                        <div>
                            <span>TODAY'S PLAN</span>
                            <h2>今天的學習任務</h2>
                        </div>
                        <span>{counts.total} 項作業</span>
                    </div>

                    <div className="student-homework-task-list">
                        {loading ? (
                            <div className="student-homework-state loading">
                                <span className="student-homework-loader" />
                                <strong>正在整理今天的作業</strong>
                                <p>馬上就好，請稍候一下。</p>
                            </div>
                        ) : assignments.length === 0 ? (
                            <div className="student-homework-state empty">
                                <span className="student-homework-state__icon"><BookOpenCheck aria-hidden="true" size={30} /></span>
                                <strong>今天沒有新作業</strong>
                                <p>目前沒有老師發布的任務，可以自由複習之前學過的內容。</p>
                            </div>
                        ) : assignments.map((item, itemIndex) => {
                            const listeningTracks = normalizeListeningTracks(item);
                            const completedTracks = listeningTracks.filter(track => track.completed).length;
                            const bookCode = listeningTracks[0]?.book?.code || item.track?.book?.code || "";
                            const assignmentTrackIds = listeningTracks.map(track => track.id).filter(Boolean).join(",");
                            const requiredListens = Number(item.required_listens || listeningTracks[0]?.requiredListens || 7);
                            const listeningUrl = `/student/books/${bookCode}?assignment=${encodeURIComponent(item.id)}&tracks=${encodeURIComponent(assignmentTrackIds)}&required=${requiredListens}`;
                            const isCompleted = Boolean(item.progress?.completed);
                            const isAiMaterial = item.source_type === "ai_material";
                            const listeningRate = listeningTracks.length ? Math.round((completedTracks / listeningTracks.length) * 100) : 0;

                            return (
                                <article className={`student-homework-task ${isAiMaterial ? "ai-material" : "listening"} ${isCompleted ? "completed" : ""}`} key={item.id}>
                                    <div className="student-homework-task__rail" aria-hidden="true">
                                        <span>{String(itemIndex + 1).padStart(2, "0")}</span>
                                    </div>

                                    <div className="student-homework-task__body">
                                        <div className="student-homework-task__top">
                                            <div className="student-homework-task__type">
                                                <span>{isAiMaterial ? <Sparkles size={20} /> : <Headphones size={20} />}</span>
                                                <div>
                                                    <small>{isAiMaterial ? "AI PRACTICE" : "LISTENING"}</small>
                                                    <strong>{isAiMaterial ? "AI 教材" : "聽力練習"}</strong>
                                                </div>
                                            </div>
                                            <span className={`student-homework-status ${isCompleted ? "completed" : "pending"}`}>
                                                {isCompleted ? <Check size={15} /> : <Clock3 size={15} />}
                                                {isCompleted ? "已完成" : "待完成"}
                                            </span>
                                        </div>

                                        <div className="student-homework-task__title">
                                            <h3>{item.title}</h3>
                                            {item.description && <p>{item.description}</p>}
                                        </div>

                                        <div className="student-homework-task__meta">
                                            <span><CalendarDays aria-hidden="true" size={15} />{item.assigned_date} 發布</span>
                                            <span><Clock3 aria-hidden="true" size={15} />{formatDateTime(item.due_at)} 截止</span>
                                        </div>

                                        {isAiMaterial ? (
                                            <div className="student-homework-ai">
                                                <div className="student-homework-ai__metric">
                                                    <span>最高分</span>
                                                    <strong>{item.progress?.best_score || 0}<small>分</small></strong>
                                                </div>
                                                <div className="student-homework-ai__metric">
                                                    <span>已作答</span>
                                                    <strong>{item.progress?.attempt_count || 0}<small>次</small></strong>
                                                </div>
                                                <div className="student-homework-ai__metric highlight">
                                                    <span>完成標準</span>
                                                    <strong>{item.passing_score}<small>分</small></strong>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="student-homework-listening">
                                                <div className="student-homework-listening__heading">
                                                    <div>
                                                        <strong>指定音檔</strong>
                                                        <span>{completedTracks} / {listeningTracks.length} 個已完成</span>
                                                    </div>
                                                    <strong>{listeningRate}%</strong>
                                                </div>
                                                <div className="student-homework-listening__bar" aria-hidden="true">
                                                    <span style={{ width: `${listeningRate}%` }} />
                                                </div>
                                                <div className="student-homework-listening__tracks">
                                                    {listeningTracks.length ? listeningTracks.map(track => (
                                                        <div className={`student-homework-track ${track.completed ? "completed" : ""}`} key={track.key}>
                                                            <span className="student-homework-track__check">{track.completed ? <Check size={14} /> : <Headphones size={14} />}</span>
                                                            <strong>{track.label}</strong>
                                                            <span>{track.playCount} / {track.requiredListens} 次</span>
                                                        </div>
                                                    )) : (
                                                        <div className="student-homework-track syncing">正在同步老師指定的音檔...</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="student-homework-task__footer">
                                            <span>{isCompleted ? "這項任務已完成，可以再次複習。" : isAiMaterial ? `達到 ${item.passing_score} 分即可完成` : "每個指定音檔都要聽滿次數"}</span>
                                            {isAiMaterial ? (
                                                <button type="button" className="student-homework-action" onClick={() => openQuiz(item)}>
                                                    {isCompleted ? "再次複習" : "開始作業"}
                                                    <ArrowRight aria-hidden="true" size={18} />
                                                </button>
                                            ) : bookCode && assignmentTrackIds ? (
                                                <Link className="student-homework-action" to={listeningUrl}>
                                                    {isCompleted ? "再次聆聽" : "開始聆聽"}
                                                    <ArrowRight aria-hidden="true" size={18} />
                                                </Link>
                                            ) : (
                                                <button className="student-homework-action" type="button" disabled>音檔同步中...</button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                {activeAssignment?.material && (
                    <section className="assignment-card assignment-quiz" id="assignment-quiz">
                        <div className="assignment-card-heading">
                            <span>HOMEWORK QUIZ</span>
                            <h2>{activeAssignment.material.title}</h2>
                            <p>全部作答後再提交；提交前不會顯示答案。</p>
                        </div>

                        {activeAssignment.material.content?.passage && (
                            <div className="assignment-passage">
                                <h3>Reading</h3>
                                <p>{activeAssignment.material.content.passage}</p>
                            </div>
                        )}

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
                                            return (
                                                <label className={`${checked ? "selected" : ""} ${isCorrectAnswer ? "correct" : ""} ${isWrongSelected ? "wrong" : ""}`} key={optionIndex}>
                                                    <input
                                                        type="radio"
                                                        name={`assignment-question-${questionIndex}`}
                                                        checked={checked}
                                                        disabled={Boolean(result)}
                                                        onChange={() => setAnswers(current => current.map((answer, index) => index === questionIndex ? option : answer))}
                                                    />
                                                    <span>{String.fromCharCode(65 + optionIndex)}.</span>
                                                    <em>{option}</em>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {result?.results?.[questionIndex] && (
                                        <div className={`assignment-explanation ${result.results[questionIndex].correct ? "correct" : "wrong"}`}>
                                            <strong>{result.results[questionIndex].correct ? "答對了" : `正確答案：${result.results[questionIndex].correct_answer}`}</strong>
                                            {result.results[questionIndex].explanation && <p>{result.results[questionIndex].explanation}</p>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {result ? (
                            <div className={`assignment-score-result ${result.passed ? "passed" : "failed"}`}>
                                <strong>{result.score} 分</strong>
                                <span>{result.passed ? "🎉 作業完成" : `尚未完成，需要 ${result.passing_score} 分以上`}</span>
                                {!result.passed && <button type="button" onClick={() => openQuiz(activeAssignment)}>重新挑戰</button>}
                            </div>
                        ) : (
                            <button type="button" className="assignment-primary" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? "批改中..." : "提交答案"}
                            </button>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
};

export default StudentAssignments;
