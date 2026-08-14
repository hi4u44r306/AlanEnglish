import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    FiAlertCircle,
    FiArrowLeft,
    FiAward,
    FiBarChart2,
    FiBookOpen,
    FiCalendar,
    FiCheckCircle,
    FiChevronLeft,
    FiChevronRight,
    FiCopy,
    FiHeadphones,
    FiMail,
    FiMessageCircle,
    FiPrinter,
    FiRefreshCw,
    FiStar,
    FiTarget,
    FiTrendingUp
} from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { markGuardianNotificationSent } from "../../services/learningActivityService";
import {
    createWeeklyReportGuardianDraft,
    getWeeklyReport
} from "../../services/weeklyReportService";
import "./css/WeeklyReport.scss";

const formatDate = value => {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric"
    }).format(new Date(`${value}T00:00:00+08:00`));
};

const formatPercent = value => (
    value === null || value === undefined ? "—" : `${Number(value)}%`
);

const copyText = async value => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
};

const WeeklyReport = () => {
    const { firebaseUser, role } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const isManager = role === "teacher" || role === "admin";
    const initialStudentId = isManager ? searchParams.get("student") || "" : "";
    const initialWeekOffset = Math.max(-12, Math.min(0, Number(searchParams.get("week") || 0) || 0));
    const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
    const [weekOffset, setWeekOffset] = useState(initialWeekOffset);
    const [students, setStudents] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailDraft, setEmailDraft] = useState(null);
    const backPath = role === "admin"
        ? "/admin/dashboard"
        : isManager
            ? "/teacher/dashboard"
            : "/student/dashboard";

    const updateQuery = useCallback((studentId, offset) => {
        const next = new URLSearchParams();
        if (isManager && studentId) next.set("student", studentId);
        if (offset) next.set("week", String(offset));
        setSearchParams(next, { replace: true });
    }, [isManager, setSearchParams]);

    const loadReport = useCallback(async () => {
        if (!firebaseUser) return;

        setLoading(true);
        setError("");
        setMessage("");

        try {
            const result = await getWeeklyReport(firebaseUser, {
                studentId: selectedStudentId || undefined,
                weekOffset
            });
            const nextReport = result?.report || null;
            setReport(nextReport);
            setStudents(Array.isArray(result?.students) ? result.students : []);

            if (isManager && nextReport?.student?.id && !selectedStudentId) {
                const nextStudentId = String(nextReport.student.id);
                setSelectedStudentId(nextStudentId);
                updateQuery(nextStudentId, weekOffset);
            }
        } catch (loadError) {
            console.error("Weekly report load error:", loadError);
            setError(loadError.message || "每週學習報告載入失敗");
            setReport(null);
        } finally {
            setLoading(false);
        }
    }, [firebaseUser, isManager, selectedStudentId, updateQuery, weekOffset]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const maxDailyTotal = useMemo(() => Math.max(
        1,
        ...(report?.daily_breakdown || []).map(day => Number(day.total || 0))
    ), [report]);

    const handleStudentChange = event => {
        const studentId = event.target.value;
        setSelectedStudentId(studentId);
        setEmailDraft(null);
        updateQuery(studentId, weekOffset);
    };

    const moveWeek = nextOffset => {
        const safeOffset = Math.max(-12, Math.min(0, nextOffset));
        setWeekOffset(safeOffset);
        setEmailDraft(null);
        updateQuery(selectedStudentId, safeOffset);
    };

    const handleCopy = async () => {
        if (!report?.family_message) return;

        try {
            await copyText(report.family_message);
            setMessage("已複製家長版週報，可以貼到 LINE 或訊息中。");
        } catch {
            setMessage("無法自動複製，請在下方文字框長按選取內容。");
        }
    };

    const prepareEmail = async () => {
        if (!firebaseUser || !report?.student?.id || emailLoading) return;
        setEmailLoading(true);
        setMessage("");

        try {
            const result = await createWeeklyReportGuardianDraft(firebaseUser, {
                studentId: report.student.id,
                weekOffset
            });
            setEmailDraft(result?.draft || null);
        } catch (prepareError) {
            setMessage(prepareError.message || "無法準備家長 Email");
        } finally {
            setEmailLoading(false);
        }
    };

    const openMailClient = () => {
        if (!emailDraft) return;
        window.location.href = `mailto:${encodeURIComponent(emailDraft.email)}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.message)}`;
    };

    const markEmailSent = async () => {
        if (!firebaseUser || !emailDraft?.id) return;

        try {
            await markGuardianNotificationSent(firebaseUser, emailDraft.id);
            setEmailDraft(null);
            setMessage("這份每週報告已標記為寄出。");
        } catch (markError) {
            setMessage(markError.message || "更新寄送紀錄失敗");
        }
    };

    if (loading) {
        return (
            <main className="weekly-report-page">
                <div className="weekly-report-state">
                    <FiRefreshCw className="is-spinning" />
                    <div>
                        <strong>正在整理每週學習成果</strong>
                        <span>彙整聽力、作業、AI、複習與口說紀錄...</span>
                    </div>
                </div>
            </main>
        );
    }

    if (error || !report) {
        return (
            <main className="weekly-report-page">
                <div className="weekly-report-state weekly-report-state--error">
                    <FiAlertCircle />
                    <h1>週報載入失敗</h1>
                    <p>{error || "目前沒有可顯示的報告"}</p>
                    <button type="button" onClick={loadReport}><FiRefreshCw /> 重新整理</button>
                    <Link to={backPath}>返回首頁</Link>
                </div>
            </main>
        );
    }

    const weekLabel = `${formatDate(report.week.start_date)}－${formatDate(report.week.end_date)}`;
    const accuracyText = formatPercent(report.metrics.answer_accuracy);
    const assignmentRate = report.assignments.completion_rate === null
        ? "本週無指定"
        : `${report.assignments.completed}/${report.assignments.assigned}`;

    return (
        <main className={`weekly-report-page ${isManager ? "weekly-report-page--manager" : ""}`}>
            <div className="weekly-report-shell">
                <nav className="weekly-report-toolbar" aria-label="週報工具列">
                    <Link to={backPath}><FiArrowLeft /> 返回{isManager ? "管理首頁" : "學習首頁"}</Link>
                    <div className="weekly-report-toolbar__actions">
                        <button type="button" onClick={handleCopy}><FiCopy /> 複製家長版</button>
                        <button type="button" onClick={() => window.print()}><FiPrinter /> 列印／存 PDF</button>
                    </div>
                </nav>

                {isManager && (
                    <section className="weekly-report-manager-bar">
                        <div>
                            <span>TEACHER REPORT CENTER</span>
                            <strong>選擇要查看的學生</strong>
                        </div>
                        <select value={selectedStudentId} onChange={handleStudentChange} aria-label="選擇學生">
                            {students.map(student => (
                                <option value={student.id} key={student.id}>
                                    {student.name}{student.class ? ` · ${student.class} 班` : ""}
                                </option>
                            ))}
                        </select>
                    </section>
                )}

                {message && <div className="weekly-report-message">{message}</div>}

                <header className={`weekly-report-hero weekly-report-hero--${report.status.code}`}>
                    <div className="weekly-report-hero__copy">
                        <span className="weekly-report-kicker"><FiBarChart2 /> WEEKLY GROWTH REPORT</span>
                        <h1>{report.student.name} 的每週成長報告</h1>
                        <div className="weekly-report-week-picker">
                            <button
                                type="button"
                                aria-label="查看前一週"
                                disabled={!report.week.can_go_previous}
                                onClick={() => moveWeek(weekOffset - 1)}
                            >
                                <FiChevronLeft />
                            </button>
                            <span><FiCalendar /> {weekLabel}</span>
                            <button
                                type="button"
                                aria-label="查看下一週"
                                disabled={!report.week.can_go_next}
                                onClick={() => moveWeek(weekOffset + 1)}
                            >
                                <FiChevronRight />
                            </button>
                        </div>
                        <div className="weekly-report-status-copy">
                            <strong>{report.status.label}</strong>
                            <p>{report.status.message}</p>
                            <span className={report.comparison.change >= 0 ? "positive" : ""}>
                                <FiTrendingUp /> {report.comparison.text}
                            </span>
                        </div>
                    </div>
                    <div className="weekly-report-score" style={{ "--weekly-score": `${report.status.score * 3.6}deg` }}>
                        <div>
                            <strong>{report.status.score}</strong>
                            <span>學習投入度</span>
                        </div>
                    </div>
                </header>

                <section className="weekly-report-key-metrics" aria-label="本週重點數據">
                    <article>
                        <div className="weekly-report-metric-icon weekly-report-metric-icon--days"><FiCalendar /></div>
                        <span>本週學習</span>
                        <strong>{report.metrics.active_days}<small> / 7 天</small></strong>
                    </article>
                    <article>
                        <div className="weekly-report-metric-icon weekly-report-metric-icon--actions"><FiTarget /></div>
                        <span>學習活動</span>
                        <strong>{report.metrics.total_actions}<small> 次</small></strong>
                    </article>
                    <article>
                        <div className="weekly-report-metric-icon weekly-report-metric-icon--homework"><FiBookOpen /></div>
                        <span>老師作業</span>
                        <strong className={report.assignments.completion_rate === null ? "is-text" : ""}>{assignmentRate}</strong>
                    </article>
                    <article>
                        <div className="weekly-report-metric-icon weekly-report-metric-icon--accuracy"><FiAward /></div>
                        <span>答題正確率</span>
                        <strong>{accuracyText}</strong>
                    </article>
                </section>

                <section className="weekly-report-panel weekly-report-activity">
                    <div className="weekly-report-heading">
                        <div>
                            <span>CONSISTENCY</span>
                            <h2>一週學習節奏</h2>
                            <p>短時間、固定頻率，比偶爾一次學很久更容易養成習慣。</p>
                        </div>
                        <strong>{report.metrics.active_days} 天有學習</strong>
                    </div>
                    <div className="weekly-report-chart" aria-label="一週每日學習活動圖">
                        {report.daily_breakdown.map(day => (
                            <div className={`weekly-report-day ${day.total ? "is-active" : ""}`} key={day.date}>
                                <span className="weekly-report-day__count">{day.total || ""}</span>
                                <div className="weekly-report-day__track">
                                    <i style={{ height: day.total ? `${Math.max(10, (day.total / maxDailyTotal) * 100)}%` : "4px" }} />
                                </div>
                                <strong>{day.weekday}</strong>
                                <small>{formatDate(day.date)}</small>
                            </div>
                        ))}
                    </div>
                    <div className="weekly-report-legend">
                        <span><i className="listening" /> 聽力 {report.listening.plays}</span>
                        <span><i className="assignment" /> 作業 {report.assignments.attempts}</span>
                        <span><i className="ai" /> AI {report.ai_practice.attempts}</span>
                        <span><i className="review" /> 複習 {report.review.attempts}</span>
                        <span><i className="speaking" /> 口說 {report.conversation.practice_steps}</span>
                    </div>
                </section>

                <section className="weekly-report-learning-grid" aria-label="各項學習成果">
                    <article className="weekly-report-learning-card weekly-report-learning-card--listening">
                        <div><FiHeadphones /><span>LISTENING</span></div>
                        <h3>聽力累積</h3>
                        <strong>{report.listening.plays}<small> 次播放</small></strong>
                        <p>{report.listening.goal_days} 天達成每日 3 次目標</p>
                    </article>
                    <article className="weekly-report-learning-card weekly-report-learning-card--assignment">
                        <div><FiBookOpen /><span>HOMEWORK</span></div>
                        <h3>老師作業</h3>
                        <strong>{report.assignments.completed}<small> / {report.assignments.assigned} 完成</small></strong>
                        <p>{report.assignments.attempts ? `本週練習 ${report.assignments.attempts} 次，最高 ${report.assignments.best_score} 分` : "本週尚無作業作答紀錄"}</p>
                    </article>
                    <article className="weekly-report-learning-card weekly-report-learning-card--ai">
                        <div><FiStar /><span>AI PRACTICE</span></div>
                        <h3>AI 專屬練習</h3>
                        <strong>{report.ai_practice.attempts}<small> 次完成</small></strong>
                        <p>{report.ai_practice.attempts ? `平均 ${report.ai_practice.average_score} 分，通過 ${report.ai_practice.passed} 次` : "本週尚未完成 AI 測驗"}</p>
                    </article>
                    <article className="weekly-report-learning-card weekly-report-learning-card--review">
                        <div><FiTarget /><span>SMART REVIEW</span></div>
                        <h3>智慧錯題複習</h3>
                        <strong>{report.review.mastered}<small> 題新掌握</small></strong>
                        <p>{report.review.attempts ? `複習 ${report.review.attempts} 題，正確率 ${formatPercent(report.review.accuracy)}` : `還有 ${report.review.learning} 題持續學習中`}</p>
                    </article>
                    <article className="weekly-report-learning-card weekly-report-learning-card--speaking">
                        <div><FiMessageCircle /><span>CONVERSATION</span></div>
                        <h3>情境口說</h3>
                        <strong>{report.conversation.completed_steps}<small> / {report.conversation.total_steps} 關</small></strong>
                        <p>{report.conversation.practice_steps ? `本週推進 ${report.conversation.practice_steps} 次口說步驟` : "本週可以安排一次真實情境口說"}</p>
                    </article>
                </section>

                <section className="weekly-report-insights">
                    <article className="weekly-report-panel weekly-report-highlights">
                        <div className="weekly-report-heading">
                            <div><span>THIS WEEK'S WINS</span><h2>值得鼓勵的進步</h2></div>
                            <FiAward />
                        </div>
                        <ul>
                            {report.highlights.map(item => <li key={item}><FiCheckCircle /> <span>{item}</span></li>)}
                        </ul>
                    </article>
                    <article className="weekly-report-panel weekly-report-focus">
                        <div className="weekly-report-heading">
                            <div><span>NEXT FOCUS</span><h2>下週這樣做</h2></div>
                            <FiTarget />
                        </div>
                        <ol>
                            {report.next_focus.map((item, index) => <li key={item}><strong>{index + 1}</strong><span>{item}</span></li>)}
                        </ol>
                        {report.review.weaknesses.length > 0 && (
                            <div className="weekly-report-weaknesses">
                                <span>目前需要加強</span>
                                {report.review.weaknesses.map(item => <strong key={item.type}>{item.label} · {item.count} 題</strong>)}
                            </div>
                        )}
                    </article>
                </section>

                <section className="weekly-report-panel weekly-report-family">
                    <div className="weekly-report-family__header">
                        <div>
                            <span>FOR FAMILY</span>
                            <h2>家長看得懂的學習摘要</h2>
                            <p>不用整理數字，直接複製到 LINE、Email，或列印保存。</p>
                        </div>
                        <div>
                            <button type="button" onClick={handleCopy}><FiCopy /> 複製摘要</button>
                            {isManager && (
                                <button
                                    type="button"
                                    className="primary"
                                    onClick={prepareEmail}
                                    disabled={!report.guardian.configured || emailLoading}
                                    title={report.guardian.configured ? "準備家長 Email" : "請先在管理首頁設定家長 Email"}
                                >
                                    <FiMail /> {emailLoading ? "準備中..." : "寄給家長"}
                                </button>
                            )}
                        </div>
                    </div>
                    <pre>{report.family_message}</pre>
                    {isManager && !report.guardian.configured && (
                        <p className="weekly-report-family__notice">
                            <FiAlertCircle /> 尚未設定家長 Email；可先複製摘要，或回管理首頁補上家長資料。
                        </p>
                    )}
                </section>

                <footer className="weekly-report-footer">
                    <span>Alan English · 每週成長報告</span>
                    <small>報告產生時間以台灣時間為準；投入度反映學習規律與參與，不等同考試成績。</small>
                </footer>
            </div>

            {emailDraft && (
                <div className="weekly-report-modal-backdrop" onClick={() => setEmailDraft(null)} role="presentation">
                    <div className="weekly-report-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
                        <span>GUARDIAN WEEKLY REPORT</span>
                        <h2>寄送 {report.student.name} 的每週報告</h2>
                        <label><span>寄送至</span><input value={emailDraft.email || ""} readOnly /></label>
                        <label><span>主旨</span><input value={emailDraft.subject || ""} readOnly /></label>
                        <label><span>內容</span><textarea value={emailDraft.message || ""} readOnly rows="11" /></label>
                        <p>網站會開啟裝置上的 Email App，不會假裝已由伺服器自動寄出。</p>
                        <div>
                            <button type="button" onClick={() => setEmailDraft(null)}>取消</button>
                            <button type="button" onClick={openMailClient}><FiMail /> 開啟 Email</button>
                            <button type="button" className="primary" onClick={markEmailSent}><FiCheckCircle /> 我已寄出</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default WeeklyReport;
