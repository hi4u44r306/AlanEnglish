import React, { useCallback, useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    createGuardianNotificationDraft,
    getTeacherStudentActivity,
    markGuardianNotificationSent,
    upsertGuardianContact
} from "../../services/learningActivityService";
import {
    previewGuardianNotificationClass,
    resendGuardianNotification,
    sendGuardianNotification,
    sendGuardianNotificationClass
} from "../../services/guardianEmailService";
import "./css/ManagementDashboard.scss";
import "./css/ManagementActivity.scss";

const formatDateTime = value => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
};

const getRelativeDays = value => {
    if (!value) return null;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return null;
    return Math.max(0, Math.floor((Date.now() - time) / 86400000));
};

const relativeText = value => {
    const days = getRelativeDays(value);
    if (days === null) return "從未";
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    return `${days} 天前`;
};

const getStatusClass = code => {
    if (code === "normal") return "activity-normal";
    if (code === "warning") return "activity-warning";
    if (code === "concern") return "activity-concern";
    if (code === "critical") return "activity-critical";
    return "activity-never";
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

const createMailtoHref = draft => {
    if (!draft) return "";
    return `mailto:${encodeURIComponent(draft.email || "")}?subject=${encodeURIComponent(draft.subject || "")}&body=${encodeURIComponent(draft.message || "")}`;
};

const CLASS_CODES = ["E1", "E3", "E5", "E7"];

const createResendRequestId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

function ManagementDashboard() {
    const { role, studentProfile, firebaseUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [searchText, setSearchText] = useState("");
    const [filter, setFilter] = useState("all");
    const [editingGuardianId, setEditingGuardianId] = useState(null);
    const [guardianForm, setGuardianForm] = useState({
        guardian_name: "",
        email: "",
        phone: "",
        preferred_channel: "email",
        notification_enabled: true
    });
    const [guardianSaving, setGuardianSaving] = useState(false);
    const [noticeDraft, setNoticeDraft] = useState(null);
    const [noticeStudent, setNoticeStudent] = useState(null);
    const [noticeLoadingId, setNoticeLoadingId] = useState(null);
    const [noticeMessage, setNoticeMessage] = useState("");
    const [mailClientMessage, setMailClientMessage] = useState("");
    const [directSending, setDirectSending] = useState(false);
    const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
    const [resendReason, setResendReason] = useState("");
    const [resendRequestId, setResendRequestId] = useState("");
    const [resendSending, setResendSending] = useState(false);
    const [batchClass, setBatchClass] = useState("");
    const [batchPreview, setBatchPreview] = useState(null);
    const [batchWorking, setBatchWorking] = useState("");

    const isAdmin = role === "admin";
    const reportPath = isAdmin ? "/admin/reports" : "/teacher/reports";

    const fetchDashboardData = useCallback(async () => {
        if (!firebaseUser) return;

        setLoading(true);
        setErrorMessage("");

        try {
            const result = await getTeacherStudentActivity(firebaseUser);
            setStudents(result?.students || []);
        } catch (error) {
            console.error("讀取學生學習後台失敗:", error);
            setErrorMessage(error.message || "學生學習資料讀取失敗");
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const stats = useMemo(() => {
        const inactive7 = students.filter(student => {
            const days = student.status?.inactive_days;
            return days !== null && days >= 7;
        }).length;
        const inactive30 = students.filter(student => {
            const days = student.status?.inactive_days;
            return days !== null && days >= 30;
        }).length;
        const never = students.filter(student => student.status?.code === "never").length;

        return {
            students: students.length,
            inactive7,
            inactive30,
            never
        };
    }, [students]);

    const filteredStudents = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return students.filter(student => {
            const matchKeyword = !keyword || [student.name, student.email, student.class]
                .filter(Boolean)
                .some(value => String(value).toLowerCase().includes(keyword));

            if (!matchKeyword) return false;

            const days = student.status?.inactive_days;

            if (filter === "inactive7") return days !== null && days >= 7;
            if (filter === "inactive14") return days !== null && days >= 14;
            if (filter === "inactive30") return days !== null && days >= 30;
            if (filter === "never") return student.status?.code === "never";
            if (filter === "conversation") return !student.conversation?.completed;
            return true;
        });
    }, [students, searchText, filter]);

    const openGuardianEditor = student => {
        const guardian = student.guardian || {};
        setEditingGuardianId(student.id);
        setGuardianForm({
            guardian_name: guardian.guardian_name || "",
            email: guardian.email || "",
            phone: guardian.phone || "",
            preferred_channel: guardian.preferred_channel || "email",
            notification_enabled: guardian.notification_enabled !== false
        });
        setNoticeMessage("");
    };

    const saveGuardian = async studentId => {
        if (!firebaseUser || guardianSaving) return;

        setGuardianSaving(true);
        setNoticeMessage("");

        try {
            const result = await upsertGuardianContact(firebaseUser, {
                student_id: studentId,
                ...guardianForm
            });

            setStudents(previous => previous.map(student => (
                student.id === studentId
                    ? { ...student, guardian: result.guardian }
                    : student
            )));
            setEditingGuardianId(null);
            setNoticeMessage("家長資料已儲存");
        } catch (error) {
            console.error("儲存家長資料失敗:", error);
            setNoticeMessage(error.message || "家長資料儲存失敗");
        } finally {
            setGuardianSaving(false);
        }
    };

    const prepareReminder = async student => {
        if (!firebaseUser || noticeLoadingId) return;

        setNoticeLoadingId(student.id);
        setNoticeMessage("");
        setMailClientMessage("");
        setResendConfirmOpen(false);
        setResendReason("");
        setResendRequestId("");

        try {
            const result = await createGuardianNotificationDraft(firebaseUser, student.id);
            setNoticeDraft(result.draft);
            setNoticeStudent(student);
        } catch (error) {
            console.error("建立家長提醒失敗:", error);
            setNoticeMessage(error.message || "建立家長提醒失敗");
        } finally {
            setNoticeLoadingId(null);
        }
    };

    const copyReminderEmail = async () => {
        if (!noticeDraft) return;

        const text = `收件人：${noticeDraft.email || ""}\n主旨：${noticeDraft.subject || ""}\n\n${noticeDraft.message || ""}`;

        try {
            await copyText(text);
            setMailClientMessage("郵件內容已複製，可以直接貼到 Gmail 或其他 Email App。");
        } catch (error) {
            console.error("複製家長提醒失敗:", error);
            setMailClientMessage("瀏覽器無法自動複製，請手動選取上方內容後複製。");
        }
    };

    const sendPreparedReminder = async () => {
        if (!firebaseUser || !noticeDraft || directSending) return;

        setDirectSending(true);
        setMailClientMessage("");
        try {
            const result = await sendGuardianNotification(firebaseUser, noticeDraft.id);
            if (result?.reason === "already_sent") {
                setNoticeDraft(previous => ({ ...previous, already_sent_today: true }));
                setMailClientMessage("今天已寄送過；如確實需要補寄，請使用「再次寄送」並填寫原因。");
                return;
            }
            setNoticeMessage(`已直接寄送給 ${noticeDraft.email}`);
            setNoticeDraft(null);
            setNoticeStudent(null);
        } catch (error) {
            setMailClientMessage(error.message || "家長通知寄送失敗");
        } finally {
            setDirectSending(false);
        }
    };

    const openResendConfirmation = () => {
        setResendConfirmOpen(true);
        setResendReason("");
        setResendRequestId(createResendRequestId());
        setMailClientMessage("");
    };

    const closeResendConfirmation = () => {
        if (resendSending) return;
        setResendConfirmOpen(false);
        setResendReason("");
        setResendRequestId("");
    };

    const confirmResendReminder = async () => {
        const reason = resendReason.trim();
        if (!firebaseUser || !noticeDraft || resendSending || reason.length < 3) return;

        setResendSending(true);
        setMailClientMessage("");
        try {
            await resendGuardianNotification(firebaseUser, noticeDraft.id, reason, resendRequestId);
            setNoticeMessage(`已再次寄送給 ${noticeDraft.email}，並記錄重寄原因`);
            setNoticeDraft(null);
            setNoticeStudent(null);
            setResendConfirmOpen(false);
            setResendReason("");
            setResendRequestId("");
        } catch (error) {
            setMailClientMessage(error.message || "家長通知再次寄送失敗");
        } finally {
            setResendSending(false);
        }
    };

    const previewClassNotifications = async () => {
        if (!firebaseUser || !batchClass || batchWorking) return;

        setBatchWorking("preview");
        setNoticeMessage("");
        try {
            const result = await previewGuardianNotificationClass(firebaseUser, batchClass);
            setBatchPreview(result);
        } catch (error) {
            setBatchPreview(null);
            setNoticeMessage(error.message || "班級通知預覽失敗");
        } finally {
            setBatchWorking("");
        }
    };

    const sendClassNotifications = async () => {
        if (!firebaseUser || !batchClass || !batchPreview || batchWorking) return;

        setBatchWorking("send");
        try {
            const result = await sendGuardianNotificationClass(firebaseUser, batchClass);
            const totals = result?.totals || {};
            setNoticeMessage(`${batchClass} 班批量寄送完成：成功 ${totals.sent || 0}、略過 ${totals.skipped || 0}、失敗 ${totals.failed || 0}、缺家長 Email ${totals.missing_guardian_email || 0}`);
            setBatchPreview(null);
        } catch (error) {
            setNoticeMessage(error.message || "班級通知批量寄送失敗");
        } finally {
            setBatchWorking("");
        }
    };

    const markReminderSent = async () => {
        if (!firebaseUser || !noticeDraft) return;

        try {
            await markGuardianNotificationSent(firebaseUser, noticeDraft.id);
            setNoticeMessage("已將這次提醒標記為已寄出");
            setNoticeDraft(null);
            setNoticeStudent(null);
        } catch (error) {
            setNoticeMessage(error.message || "更新提醒紀錄失敗");
        }
    };

    return (
        <div className="management-page">
            <section className="management-hero">
                <div>
                    <span className="management-eyebrow">{isAdmin ? "Admin Dashboard" : "Teacher Dashboard"}</span>
                    <h1>{studentProfile?.name || (isAdmin ? "Admin" : "Teacher")}，歡迎回來</h1>
                    <p>查看學生最後登入、實際活躍與學習狀況，快速找到需要提醒的學生。</p>
                </div>
                <Link to={reportPath} className="management-primary-link">📊 每週學習報告</Link>
            </section>

            {loading ? (
                <div className="management-state">正在載入學生學習資料...</div>
            ) : errorMessage ? (
                <div className="management-state management-error">{errorMessage}</div>
            ) : (
                <>
                    <section className="dashboard-stat-grid">
                        <div className="dashboard-stat-card">
                            <span>學生總數</span>
                            <strong>{stats.students}</strong>
                        </div>
                        <div className="dashboard-stat-card dashboard-stat-warning">
                            <span>7 天以上未使用</span>
                            <strong>{stats.inactive7}</strong>
                        </div>
                        <div className="dashboard-stat-card dashboard-stat-danger">
                            <span>30 天以上未使用</span>
                            <strong>{stats.inactive30}</strong>
                        </div>
                        <div className="dashboard-stat-card dashboard-stat-muted">
                            <span>從未使用</span>
                            <strong>{stats.never}</strong>
                        </div>
                    </section>

                    <section className="management-panel student-activity-panel">
                        <div className="student-activity-heading">
                            <div>
                                <span>STUDENT ACTIVITY</span>
                                <h2>學生學習狀況</h2>
                                <p>最後登入是帳密登入時間；最後活躍則會持續追蹤學生實際打開 Alan English 的時間。</p>
                            </div>
                            <button type="button" className="activity-refresh-button" onClick={fetchDashboardData}>重新整理</button>
                        </div>

                        {isAdmin && (
                            <div className="guardian-batch-panel">
                                <div>
                                    <strong>按班級批量通知家長</strong>
                                    <span>每位家長會收到獨立信件；先預覽人數，再確認寄送。</span>
                                </div>
                                <div className="guardian-batch-controls">
                                    <select
                                        aria-label="選擇批量寄送班級"
                                        value={batchClass}
                                        onChange={event => {
                                            setBatchClass(event.target.value);
                                            setBatchPreview(null);
                                        }}
                                    >
                                        <option value="">選擇班級</option>
                                        {CLASS_CODES.map(code => <option key={code} value={code}>{code} 班</option>)}
                                    </select>
                                    <button type="button" onClick={previewClassNotifications} disabled={!batchClass || Boolean(batchWorking)}>
                                        {batchWorking === "preview" ? "預覽中…" : "預覽寄送名單"}
                                    </button>
                                </div>
                                {batchPreview && (
                                    <div className="guardian-batch-confirm" role="status">
                                        <p>
                                            <strong>{batchPreview.class_code} 班</strong>共 {batchPreview.totals?.students || 0} 位；
                                            本次可寄 {batchPreview.totals?.ready_to_send || 0} 封、
                                            今日已寄 {batchPreview.totals?.already_sent_today || 0} 封、
                                            缺家長 Email {batchPreview.totals?.missing_guardian_email || 0} 位。
                                        </p>
                                        {!batchPreview.provider_configured && <span>寄信服務尚未完成設定，暫時不能寄送。</span>}
                                        <button
                                            type="button"
                                            className="primary"
                                            onClick={sendClassNotifications}
                                            disabled={!batchPreview.provider_configured || !batchPreview.totals?.ready_to_send || Boolean(batchWorking)}
                                        >
                                            {batchWorking === "send" ? "寄送中…" : `確認寄送 ${batchPreview.totals?.ready_to_send || 0} 封`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="activity-filter-bar">
                            <input
                                type="search"
                                value={searchText}
                                onChange={event => setSearchText(event.target.value)}
                                placeholder="搜尋學生姓名、Email、班級..."
                            />
                            <select value={filter} onChange={event => setFilter(event.target.value)}>
                                <option value="all">全部學生</option>
                                <option value="inactive7">7 天以上未使用</option>
                                <option value="inactive14">14 天以上未使用</option>
                                <option value="inactive30">30 天以上未使用</option>
                                <option value="never">從未使用</option>
                                <option value="conversation">Conversation 未完成</option>
                            </select>
                            <strong>{filteredStudents.length} 位</strong>
                        </div>

                        {noticeMessage && <div className="activity-inline-message">{noticeMessage}</div>}

                        <div className="management-table-wrap">
                            <table className="management-table student-activity-table">
                                <thead>
                                    <tr>
                                        <th>學生</th>
                                        <th>最近動態</th>
                                        <th>學習進度</th>
                                        <th>狀態</th>
                                        <th>家長</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map(student => {
                                        const conversation = student.conversation;
                                        const conversationCompleted = conversation?.completed_steps || 0;
                                        const conversationTotal = conversation?.total_steps || 9;
                                        const guardianReady = Boolean(student.guardian?.email && student.guardian?.notification_enabled);

                                        return (
                                            <React.Fragment key={student.id}>
                                                <tr className={`student-activity-row ${student.status?.code === "critical" || student.status?.code === "never" ? "activity-attention-row" : ""}`}>
                                                    <td data-label="學生">
                                                        <strong className="student-name-cell">{student.name}</strong>
                                                        <span className="student-meta-cell">{student.class ? `${student.class} 班` : "未分班"} · {student.email || "無 Email"}</span>
                                                    </td>
                                                    <td data-label="最近動態">
                                                        <dl className="student-activity-summary">
                                                            <div title={formatDateTime(student.last_login_at)}><dt>登入</dt><dd>{relativeText(student.last_login_at)}</dd></div>
                                                            <div title={formatDateTime(student.last_active_at)}><dt>活躍</dt><dd>{relativeText(student.last_active_at)}</dd></div>
                                                            <div title={formatDateTime(student.last_learning_at)}><dt>學習</dt><dd>{relativeText(student.last_learning_at)}</dd></div>
                                                        </dl>
                                                    </td>
                                                    <td className="student-learning-cell" data-label="學習進度">
                                                        <div className="mini-progress-cell">
                                                            <strong>Conversation {conversationCompleted} / {conversationTotal}</strong>
                                                            <span><i style={{ width: `${Math.min(100, (conversationCompleted / conversationTotal) * 100)}%` }} /></span>
                                                        </div>
                                                        <span>聽力完成 {student.listening?.completed || 0} 首</span>
                                                    </td>
                                                    <td data-label="狀態">
                                                        <span className={`activity-status ${getStatusClass(student.status?.code)}`}>
                                                            {student.status?.label || "未知"}
                                                        </span>
                                                    </td>
                                                    <td data-label="家長">
                                                        <button type="button" className={`guardian-status-button ${guardianReady ? "ready" : ""}`} onClick={() => openGuardianEditor(student)}>
                                                            {guardianReady ? "✓ 已設定" : "＋ 設定家長"}
                                                        </button>
                                                    </td>
                                                    <td data-label="操作">
                                                        <div className="activity-row-actions">
                                                            <Link to={`${reportPath}?student=${student.id}`}>每週報告</Link>
                                                            <button
                                                                type="button"
                                                                className="reminder-button"
                                                                disabled={!guardianReady || noticeLoadingId === student.id}
                                                                onClick={() => prepareReminder(student)}
                                                            >
                                                                {noticeLoadingId === student.id ? "準備中..." : "提醒家長"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {editingGuardianId === student.id && (
                                                    <tr className="guardian-editor-row">
                                                        <td colSpan="6">
                                                            <div className="guardian-editor">
                                                                <div className="guardian-editor-heading">
                                                                    <div>
                                                                        <strong>{student.name}｜家長聯絡資料</strong>
                                                                        <span>儲存可收信的 Email，供學習提醒使用。</span>
                                                                    </div>
                                                                    <button type="button" onClick={() => setEditingGuardianId(null)}>關閉</button>
                                                                </div>
                                                                <div className="guardian-editor-grid">
                                                                    <label>
                                                                        <span>家長姓名</span>
                                                                        <input value={guardianForm.guardian_name} onChange={event => setGuardianForm(previous => ({ ...previous, guardian_name: event.target.value }))} />
                                                                    </label>
                                                                    <label>
                                                                        <span>家長 Email</span>
                                                                        <input type="email" value={guardianForm.email} onChange={event => setGuardianForm(previous => ({ ...previous, email: event.target.value }))} />
                                                                    </label>
                                                                    <label>
                                                                        <span>手機</span>
                                                                        <input value={guardianForm.phone} onChange={event => setGuardianForm(previous => ({ ...previous, phone: event.target.value }))} />
                                                                    </label>
                                                                </div>
                                                                <label className="guardian-notification-toggle">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={guardianForm.notification_enabled}
                                                                        onChange={event => setGuardianForm(previous => ({ ...previous, notification_enabled: event.target.checked }))}
                                                                    />
                                                                    <span>允許寄送學習提醒</span>
                                                                </label>
                                                                <div className="guardian-editor-actions">
                                                                    <button type="button" onClick={() => setEditingGuardianId(null)}>取消</button>
                                                                    <button type="button" className="primary" disabled={guardianSaving} onClick={() => saveGuardian(student.id)}>
                                                                        {guardianSaving ? "儲存中..." : "儲存家長資料"}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {filteredStudents.length === 0 && <div className="management-empty">沒有符合條件的學生。</div>}
                    </section>

                </>
            )}

            {noticeDraft && noticeStudent && (
                <div className="guardian-reminder-modal-backdrop" onClick={() => !resendSending && setNoticeDraft(null)} role="presentation">
                    <div className="guardian-reminder-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
                        <span>GUARDIAN REMINDER</span>
                        <h2>提醒 {noticeStudent.name} 的家長</h2>
                        <label>
                            <span>寄送至</span>
                            <input value={noticeDraft.email || ""} readOnly />
                        </label>
                        <label>
                            <span>主旨</span>
                            <input value={noticeDraft.subject || ""} readOnly />
                        </label>
                        <label>
                            <span>通知內容</span>
                            <textarea value={noticeDraft.message || ""} readOnly rows="8" />
                        </label>
                        <p>管理員可由網站直接寄送；也可以複製內容或開啟裝置上的 Email App 自行寄出。只有實際寄送成功後才會留下已寄出紀錄。</p>
                        {noticeDraft.already_sent_today && !resendConfirmOpen && (
                            <div className="guardian-resend-notice">
                                這位學生今天已寄送過提醒。只有確實需要補寄時才使用再次寄送，系統會保留原因與原信關聯。
                            </div>
                        )}
                        {resendConfirmOpen && (
                            <section className="guardian-resend-confirmation" aria-label="確認再次寄送">
                                <strong>確認再次寄送</strong>
                                <p>這會再次寄出相同通知。請填寫原因，留下管理稽核紀錄。</p>
                                <label>
                                    <span>重寄原因（至少 3 個字）</span>
                                    <textarea
                                        rows="3"
                                        maxLength="500"
                                        value={resendReason}
                                        onChange={event => setResendReason(event.target.value)}
                                        placeholder="例如：家長表示未收到，確認地址後補寄"
                                    />
                                </label>
                                <div className="guardian-resend-confirmation__actions">
                                    <button type="button" onClick={closeResendConfirmation} disabled={resendSending}>返回</button>
                                    <button
                                        type="button"
                                        className="danger"
                                        onClick={confirmResendReminder}
                                        disabled={resendSending || resendReason.trim().length < 3}
                                    >
                                        {resendSending ? "再次寄送中…" : "確認再次寄送"}
                                    </button>
                                </div>
                            </section>
                        )}
                        {mailClientMessage && <div className="guardian-mail-status" role="status">{mailClientMessage}</div>}
                        <div className="guardian-reminder-actions">
                            <button type="button" onClick={() => setNoticeDraft(null)} disabled={resendSending}>取消</button>
                            <button type="button" onClick={copyReminderEmail}>複製郵件內容</button>
                            <a
                                className="open-mail-button"
                                href={createMailtoHref(noticeDraft)}
                                onClick={() => setMailClientMessage("已請裝置開啟 Email App；若沒有反應，請改用「複製郵件內容」。")}
                            >
                                開啟 Email
                            </a>
                            <button type="button" onClick={markReminderSent}>已自行寄出</button>
                            {isAdmin && (
                                <>
                                    {noticeDraft.already_sent_today && !resendConfirmOpen && (
                                        <button type="button" className="resend" onClick={openResendConfirmation}>再次寄送</button>
                                    )}
                                    {!noticeDraft.already_sent_today && (
                                        <button type="button" className="primary" onClick={sendPreparedReminder} disabled={directSending}>
                                            {directSending ? "寄送中…" : "直接寄送"}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManagementDashboard;
