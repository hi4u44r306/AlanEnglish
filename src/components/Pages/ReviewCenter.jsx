import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    FiArrowLeft,
    FiArrowRight,
    FiAward,
    FiBookOpen,
    FiCheckCircle,
    FiClock,
    FiRefreshCw,
    FiSend,
    FiTarget,
    FiTrendingUp,
    FiXCircle,
    FiZap
} from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { getReviewDashboard, submitReviewAnswer } from "../../services/reviewService";
import "./css/ReviewCenter.scss";

const EMPTY_STATS = {
    due: 0,
    learning: 0,
    mastered: 0,
    total: 0,
    mastery_percent: 0,
    next_review_at: null,
    weaknesses: []
};

const formatReviewDate = value => {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
};

const ReviewCenter = () => {
    const { firebaseUser } = useAuth();
    const [stats, setStats] = useState(EMPTY_STATS);
    const [items, setItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState("");
    const [answerResult, setAnswerResult] = useState(null);
    const [sessionCorrect, setSessionCorrect] = useState(0);
    const [sessionMastered, setSessionMastered] = useState(0);
    const [sessionFinished, setSessionFinished] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const loadReview = useCallback(async ({ resetSession = true } = {}) => {
        if (!firebaseUser) return;
        setLoading(true);
        setError("");

        try {
            const result = await getReviewDashboard(firebaseUser);
            setStats(result?.stats || EMPTY_STATS);
            setItems(Array.isArray(result?.items) ? result.items : []);

            if (resetSession) {
                setCurrentIndex(0);
                setSelectedAnswer("");
                setAnswerResult(null);
                setSessionCorrect(0);
                setSessionMastered(0);
                setSessionFinished(false);
            }
        } catch (loadError) {
            console.error("Review center load error:", loadError);
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => {
        loadReview();
    }, [loadReview]);

    const currentItem = items[currentIndex] || null;
    const progress = items.length
        ? Math.round(((currentIndex + (answerResult ? 1 : 0)) / items.length) * 100)
        : 0;
    const topWeakness = stats.weaknesses?.[0] || null;

    const progressDots = useMemo(() => {
        const goal = Number(currentItem?.mastery_goal || 3);
        const streak = Number(answerResult?.correct_streak ?? currentItem?.correct_streak ?? 0);
        return Array.from({ length: goal }, (_, index) => index < streak);
    }, [answerResult, currentItem]);

    const handleSelect = option => {
        if (answerResult || submitting) return;
        setSelectedAnswer(option);
        setError("");
    };

    const handleSubmit = async () => {
        if (!currentItem || !selectedAnswer || submitting) return;
        setSubmitting(true);
        setError("");

        try {
            const response = await submitReviewAnswer(
                firebaseUser,
                currentItem.id,
                selectedAnswer
            );
            const result = response?.result || null;
            setAnswerResult(result);
            if (result?.is_correct) setSessionCorrect(value => value + 1);
            if (result?.mastered) setSessionMastered(value => value + 1);
            window.dispatchEvent(new CustomEvent("ae:review-progress-updated"));
        } catch (submitError) {
            console.error("Review answer submit error:", submitError);
            setError(submitError.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleNext = () => {
        if (currentIndex >= items.length - 1) {
            setSessionFinished(true);
            return;
        }

        setCurrentIndex(index => index + 1);
        setSelectedAnswer("");
        setAnswerResult(null);
        setError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const getOptionClass = option => {
        const classes = ["review-option"];
        if (selectedAnswer === option) classes.push("selected");
        if (answerResult?.correct_answer === option) classes.push("correct");
        if (
            answerResult
            && selectedAnswer === option
            && !answerResult.is_correct
        ) classes.push("wrong");
        return classes.join(" ");
    };

    if (loading) {
        return (
            <main className="review-center">
                <div className="review-loading">
                    <FiRefreshCw />
                    <div>
                        <strong>正在整理你的錯題</strong>
                        <span>分析 AI 練習與老師作業...</span>
                    </div>
                </div>
            </main>
        );
    }

    if (error && !currentItem) {
        return (
            <main className="review-center">
                <div className="review-state review-state--error">
                    <FiXCircle />
                    <h1>複習內容載入失敗</h1>
                    <p>{error}</p>
                    <button type="button" onClick={() => loadReview()}>
                        <FiRefreshCw /> 重新整理
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="review-center">
            <div className="review-center__shell">
                <header className="review-hero">
                    <div className="review-hero__copy">
                        <Link to="/student/dashboard"><FiArrowLeft /> 回到學習首頁</Link>
                        <span><FiTarget /> SMART REVIEW</span>
                        <h1>智慧錯題複習</h1>
                        <p>系統會從 AI 練習與老師作業找出弱點，答對三次後就能真正掌握。</p>
                    </div>
                    <div className="review-hero__score" style={{ "--review-progress": `${stats.mastery_percent * 3.6}deg` }}>
                        <div>
                            <strong>{stats.mastery_percent}%</strong>
                            <span>掌握度</span>
                        </div>
                    </div>
                </header>

                <section className="review-summary" aria-label="複習進度摘要">
                    <article className="review-summary__due">
                        <FiZap />
                        <div><span>今天待複習</span><strong>{stats.due}</strong><small>題</small></div>
                    </article>
                    <article>
                        <FiTrendingUp />
                        <div><span>持續學習</span><strong>{stats.learning}</strong><small>題</small></div>
                    </article>
                    <article>
                        <FiAward />
                        <div><span>已經掌握</span><strong>{stats.mastered}</strong><small>題</small></div>
                    </article>
                    <article>
                        <FiTarget />
                        <div><span>目前弱項</span><strong className="review-summary__word">{topWeakness?.label || "尚無"}</strong></div>
                    </article>
                </section>

                {stats.weaknesses?.length > 0 && (
                    <section className="review-weaknesses">
                        <div>
                            <span>WEAK POINTS</span>
                            <h2>需要加強的能力</h2>
                        </div>
                        <div className="review-weaknesses__list">
                            {stats.weaknesses.map((item, index) => (
                                <span className={index === 0 ? "primary" : ""} key={item.type}>
                                    {item.label}<strong>{item.count} 題</strong>
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {sessionFinished ? (
                    <section className="review-state review-state--finished">
                        <div className="review-state__icon"><FiAward /></div>
                        <span>SESSION COMPLETE</span>
                        <h2>今天這組複習完成！</h2>
                        <p>你答對了 {sessionCorrect} / {items.length} 題{sessionMastered > 0 ? `，並新掌握 ${sessionMastered} 題` : ""}。</p>
                        <div className="review-state__actions">
                            <button type="button" onClick={() => loadReview()}>
                                <FiRefreshCw /> 更新複習進度
                            </button>
                            <Link to="/student/dashboard">回到學習首頁</Link>
                        </div>
                    </section>
                ) : currentItem ? (
                    <section className="review-session">
                        <div className="review-session__top">
                            <div>
                                <span>{currentItem.source_type === "assignment" ? "老師作業錯題" : "AI 練習錯題"}</span>
                                <strong>{currentItem.source_title}</strong>
                            </div>
                            <div className="review-session__count">
                                第 {currentIndex + 1} 題／共 {items.length} 題
                            </div>
                        </div>
                        <div className="review-session__bar"><span style={{ width: `${progress}%` }} /></div>

                        <article className="review-question">
                            <div className="review-question__meta">
                                <span>{currentItem.material_type_label}</span>
                                {currentItem.difficulty && <span>{currentItem.difficulty}</span>}
                            </div>
                            <h2>{currentItem.question_text}</h2>

                            <div className="review-question__mastery">
                                <span>掌握進度</span>
                                <div>
                                    {progressDots.map((filled, index) => (
                                        <i className={filled ? "filled" : ""} key={index} />
                                    ))}
                                </div>
                                <small>連續答對 {currentItem.mastery_goal} 次即掌握</small>
                            </div>

                            <div className="review-options">
                                {currentItem.options.map((option, optionIndex) => (
                                    <button
                                        type="button"
                                        key={`${currentItem.id}-${optionIndex}`}
                                        className={getOptionClass(option)}
                                        onClick={() => handleSelect(option)}
                                        disabled={Boolean(answerResult) || submitting}
                                    >
                                        <span>{String.fromCharCode(65 + optionIndex)}</span>
                                        <strong>{option}</strong>
                                        {answerResult?.correct_answer === option && <FiCheckCircle />}
                                        {answerResult && selectedAnswer === option && !answerResult.is_correct && <FiXCircle />}
                                    </button>
                                ))}
                            </div>

                            {answerResult && (
                                <div className={`review-feedback ${answerResult.is_correct ? "correct" : "wrong"}`}>
                                    {answerResult.is_correct ? <FiCheckCircle /> : <FiXCircle />}
                                    <div>
                                        <strong>{answerResult.is_correct ? "答對了！" : `正確答案：${answerResult.correct_answer}`}</strong>
                                        {answerResult.explanation && <p>{answerResult.explanation}</p>}
                                        <span>
                                            {answerResult.mastered
                                                ? "這一題已經掌握！"
                                                : answerResult.is_correct
                                                    ? `目前連續答對 ${answerResult.correct_streak} 次，之後會再次出現。`
                                                    : "明天會再安排一次，慢慢記住就好。"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {error && <div className="review-inline-error">{error}</div>}

                            <div className="review-question__action">
                                {!answerResult ? (
                                    <button type="button" onClick={handleSubmit} disabled={!selectedAnswer || submitting}>
                                        {submitting ? <><FiRefreshCw className="is-spinning" /> 批改中...</> : <><FiSend /> 送出答案</>}
                                    </button>
                                ) : (
                                    <button type="button" onClick={handleNext}>
                                        {currentIndex >= items.length - 1 ? "查看本次成果" : "下一題"}
                                        <FiArrowRight />
                                    </button>
                                )}
                            </div>
                        </article>
                    </section>
                ) : stats.total === 0 ? (
                    <section className="review-state">
                        <div className="review-state__icon"><FiBookOpen /></div>
                        <span>NO MISTAKES YET</span>
                        <h2>目前還沒有錯題</h2>
                        <p>完成 AI 練習或老師指定作業後，答錯的題目會自動整理到這裡。</p>
                        <div className="review-state__actions">
                            <Link className="primary" to="/student/ai-generator">開始 AI 練習</Link>
                            <Link to="/student/assignments">查看老師作業</Link>
                        </div>
                    </section>
                ) : (
                    <section className="review-state review-state--clear">
                        <div className="review-state__icon"><FiCheckCircle /></div>
                        <span>TODAY IS CLEAR</span>
                        <h2>今天的複習完成了</h2>
                        <p>
                            {stats.next_review_at
                                ? `下一次預計在 ${formatReviewDate(stats.next_review_at)} 出現。`
                                : "所有錯題都已經掌握，繼續挑戰新內容吧！"}
                        </p>
                        <div className="review-state__actions">
                            <Link className="primary" to="/student/ai-generator">挑戰新教材</Link>
                            <Link to="/student/dashboard">回到學習首頁</Link>
                        </div>
                    </section>
                )}

                <footer className="review-center__note">
                    <FiClock /> 答題後隔天再複習，連續答對會逐步延長間隔。
                </footer>
            </div>
        </main>
    );
};

export default ReviewCenter;
