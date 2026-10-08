import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    FiAlertCircle,
    FiArrowLeft,
    FiAward,
    FiCalendar,
    FiCheckCircle,
    FiChevronLeft,
    FiChevronRight,
    FiCopy,
    FiHeadphones,
    FiMail,
    FiMic,
    FiPrinter,
    FiRefreshCw,
    FiTarget,
    FiTrendingUp
} from "react-icons/fi";
import WeeklyLineChart from "./WeeklyLineChart";
import WeeklyReportOverview from "./WeeklyReportOverview";
import { getWeeklyChartDays } from "../../utils/weeklyReportChart";
import { useAuth } from "../../auth/AuthContext";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { markGuardianNotificationSent } from "../../services/learningActivityService";
import {
    createWeeklyReportGuardianDraft,
    getWeeklyReport
} from "../../services/weeklyReportService";
import "./css/WeeklyReport.scss";
import "./css/WeeklyReportOverview.scss";

const formatDate = value => {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric"
    }).format(new Date(`${value}T00:00:00+08:00`));
};

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

const currentTaipeiWeek = () => Math.floor((Date.now() + 8 * 3600000 + 3 * 86400000) / (7 * 86400000));

const WeeklyReport = () => {
    const { firebaseUser, role, studentProfile } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const isManager = role === "teacher" || role === "admin";
    const initialStudentId = isManager ? searchParams.get("student") || "" : "";
    const initialWeekOffset = Math.max(-12, Math.min(0, Number(searchParams.get("week") || 0) || 0));
    const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
    const [weekOffset, setWeekOffset] = useState(initialWeekOffset);
    const weekKey = currentTaipeiWeek() + weekOffset;
    const reportQuery = useStudentPageQuery(`weekly:${weekKey}:${selectedStudentId || "self"}`, () => getWeeklyReport(firebaseUser, {
        studentId: selectedStudentId || undefined, weekOffset: Math.max(-12, Math.min(0, weekKey - currentTaipeiWeek()))
    }), { persist: !isManager });
    const report = reportQuery.data?.report;
    const students = reportQuery.data?.students || [];
    const loading = reportQuery.loading;
    const error = reportQuery.error?.message;
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

    const loadReport = () => {
        setMessage("");
        reportQuery.refresh();
    };

    useEffect(() => {
        if (isManager && report?.student?.id && !selectedStudentId) {
            const nextStudentId = String(report.student.id);
            setSelectedStudentId(nextStudentId);
            updateQuery(nextStudentId, weekOffset);
        }
    }, [isManager, report, selectedStudentId, updateQuery, weekOffset]);

    const chartDays = useMemo(() => getWeeklyChartDays(report), [report]);

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
                        <span>彙整聽力、作業、AI、複習、情境口說與口說大挑戰...</span>
                    </div>
                </div>
            </main>
        );
    }

    if (!report) {
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
    const speakingChallenge = report.speaking_challenge;

    return (
        <main className={`weekly-report-page ${isManager ? "weekly-report-page--manager" : ""}`}>
            <div className="weekly-report-shell">
                <nav className="weekly-report-toolbar" aria-label="週報工具列">
                    <Link to={backPath}><FiArrowLeft /> 返回{isManager ? "管理首頁" : "學習首頁"}</Link>
                    <div className="weekly-report-toolbar__actions">
                        <button type="button" onClick={handleCopy} disabled={!report.family_message}><FiCopy /> 複製文字摘要</button>
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
                {error && <div className="weekly-report-message" role="status">目前顯示上次週報，最新資料暫時無法同步。<button type="button" onClick={loadReport}>重新整理</button></div>}

                <header className="weekly-report-hero weekly-report-hero--parent">
                    <div className="weekly-report-hero__copy">
                        <span className="weekly-report-kicker"><FiTrendingUp aria-hidden="true" />每週一起看見進步</span>
                        <h1>{report.student.name} 的每週學習報告</h1>
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
                            <strong>看見聆聽的累積，也看見開口的進步。</strong>
                            <p>本週有效聆聽次數與口說大挑戰進度，依每天的紀錄呈現。</p>
                        </div>
                        <nav className="weekly-report-reading-links" aria-label="閱讀週報">
                            <a href="#weekly-report-trends">查看每日圖表</a>
                            <a href="#weekly-report-family">文字摘要與分享</a>
                        </nav>
                    </div>
                    <div className="weekly-report-parent-note">
                        <FiHeadphones aria-hidden="true" /><FiMic aria-hidden="true" />
                        <span>聽力 × 口說</span>
                        <small>家長每週學習紀錄</small>
                    </div>
                </header>

                <WeeklyReportOverview report={report} />

                <div className="weekly-report-trends" id="weekly-report-trends">
                    <WeeklyLineChart days={chartDays} valueKey="listening" title="每日有效聆聽" unit="次"
                        description="每天實際完成的有效聆聽次數；點選日期可查看數字。" />
                    <WeeklyLineChart days={chartDays} valueKey="speakingCumulative" title="口說大挑戰累計進度" unit="題" tone="green"
                        description="從週一開始累計本週新完成題數，重練同題不重複增加。" />
                </div>
                <p className="weekly-report-counting-note">聽力依系統保存的有效聆聽紀錄統計；口說曲線表示本週新增的完成題數，不代表整本教材完成率。當週尚未到來的日期顯示待更新。</p>

                <section className="weekly-report-learning-grid" aria-label="各項學習成果">
                    <article className="weekly-report-learning-card weekly-report-learning-card--listening">
                        <div><FiHeadphones /><span>LISTENING</span></div>
                        <h3>聽力累積</h3>
                        <strong>{report.listening.plays}<small> 次有效聆聽</small></strong>
                        <p>{report.listening.goal_days} 天達成每日 3 次目標</p>
                    </article>
                    <article className="weekly-report-learning-card weekly-report-learning-card--challenge">
                        <div><FiMic /><span>SPEAKING CHALLENGE</span></div>
                        <h3>口說大挑戰</h3>
                        {speakingChallenge ? <>
                        <strong>{speakingChallenge.completed_questions}<small> 題新完成</small></strong>
                        <p>
                            {speakingChallenge.completed_challenges
                                ? `本週通過 ${speakingChallenge.completed_challenges} 關，獲得 ${speakingChallenge.xp_awarded} XP${speakingChallenge.ae_points_awarded ? `、${speakingChallenge.ae_points_awarded} AE Points` : ""}`
                                : "完成整個小關卡即可獲得通關獎勵"}
                        </p>
                        {speakingChallenge.current_challenge && (
                            <div className="weekly-report-challenge-progress">
                                <small>截至本週的最近關卡</small>
                                <span>
                                    <b>{speakingChallenge.current_challenge.book_name}</b>
                                    {speakingChallenge.current_challenge.completed_questions}/{speakingChallenge.current_challenge.total_questions}
                                </span>
                                <div role="progressbar" aria-label="目前口說關卡完成率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={speakingChallenge.current_challenge.progress_percent}>
                                    <i style={{ width: `${speakingChallenge.current_challenge.progress_percent}%` }} />
                                </div>
                                <small>{speakingChallenge.current_challenge.title}</small>
                            </div>
                        )}
                        </> : <p>本週口說紀錄尚無資料，無法判讀完成題數與通關。</p>}
                        {isManager || (studentProfile?.membership?.is_active && studentProfile?.membership?.effective_access?.features?.pronunciation === true)
                            ? <Link className="weekly-report-challenge-link" to="/student/speaking-challenges"><FiMic />查看口說冒險</Link>
                            : <Link className="weekly-report-challenge-link" to="/student/membership"><FiMic />查看口說功能權限</Link>}
                    </article>
                </section>

                <details className="weekly-report-extra">
                    <summary>更多進步與練習建議</summary>
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
                </details>

                <section className="weekly-report-panel weekly-report-family weekly-report-family--summary" id="weekly-report-family" aria-label="家長文字摘要與分享">
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
                    <pre>{report.family_message || "正在同步文字摘要，完成後即可複製。"}</pre>
                    {isManager && !report.guardian.configured && (
                        <p className="weekly-report-family__notice">
                            <FiAlertCircle /> 尚未設定家長 Email；可先複製摘要，或回管理首頁補上家長資料。
                        </p>
                    )}
                </section>

                <footer className="weekly-report-footer">
                    <span>Alan English · 每週成長報告</span>
                    <small>每週範圍為台灣時間週一至週日；次數與完成進度不等同考試成績。</small>
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
