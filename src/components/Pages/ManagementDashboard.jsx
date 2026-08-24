import React, { useCallback, useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    createGuardianNotificationDraft,
    getTeacherStudentActivity,
    markGuardianNotificationSent,
    upsertGuardianContact
} from "../../services/learningActivityService";
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

    const openMailClient = () => {
        if (!noticeDraft) return;

        const href = `mailto:${encodeURIComponent(noticeDraft.email)}?subject=${encodeURIComponent(noticeDraft.subject)}&body=${encodeURIComponent(noticeDraft.message)}`;
        window.location.href = href;
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
                                        <th>最後登入</th>
                                        <th>最後活躍</th>
                                        <th>最後學習</th>
                                        <th>Conversation</th>
                                        <th>聽力完成</th>
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
                                                <tr className={student.status?.code === "critical" || student.status?.code === "never" ? "activity-attention-row" : ""}>
                                                    <td>
                                                        <strong className="student-name-cell">{student.name}</strong>
                                                        <span className="student-meta-cell">{student.class ? `${student.class} 班` : "未分班"} · {student.email || "無 Email"}</span>
                                                    </td>
                                                    <td title={formatDateTime(student.last_login_at)}>{relativeText(student.last_login_at)}</td>
                                                    <td title={formatDateTime(student.last_active_at)}>{relativeText(student.last_active_at)}</td>
                                                    <td title={formatDateTime(student.last_learning_at)}>{relativeText(student.last_learning_at)}</td>
                                                    <td>
                                                        <div className="mini-progress-cell">
                                                            <strong>{conversationCompleted} / {conversationTotal}</strong>
                                                            <span><i style={{ width: `${Math.min(100, (conversationCompleted / conversationTotal) * 100)}%` }} /></span>
                                                        </div>
                                                    </td>
                                                    <td><strong>{student.listening?.completed || 0}</strong> 首</td>
                                                    <td>
                                                        <span className={`activity-status ${getStatusClass(student.status?.code)}`}>
                                                            {student.status?.label || "未知"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button type="button" className={`guardian-status-button ${guardianReady ? "ready" : ""}`} onClick={() => openGuardianEditor(student)}>
                                                            {guardianReady ? "✓ 已設定" : "＋ 設定家長"}
                                                        </button>
                                                    </td>
                                                    <td>
                                                        <div className="activity-row-actions">
                                                            <Link to={`${reportPath}?student=${student.id}`}>每週報告</Link>
                                                            <button type="button" onClick={() => openGuardianEditor(student)}>家長資料</button>
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
                                                        <td colSpan="9">
                                                            <div className="guardian-editor">
                                                                <div className="guardian-editor-heading">
                                                                    <div>
                                                                        <strong>{student.name}｜家長聯絡資料</strong>
                                                                        <span>第一版使用 Email 手動寄送；未來可再接 LINE 官方帳號與自動提醒。</span>
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
                                                                    <label>
                                                                        <span>偏好通知</span>
                                                                        <select value={guardianForm.preferred_channel} onChange={event => setGuardianForm(previous => ({ ...previous, preferred_channel: event.target.value }))}>
                                                                            <option value="email">Email</option>
                                                                            <option value="line">LINE（預留）</option>
                                                                            <option value="none">不通知</option>
                                                                        </select>
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

                    <section className="dashboard-actions">
                        <h2>快速管理</h2>
                        <div className="dashboard-action-grid">
                            <Link to={reportPath} className="dashboard-action-card">
                                <strong>每週學習報告</strong>
                                <span>整理學生進度並寄給家長</span>
                            </Link>
                            <Link to={isAdmin ? "/admin/accounts" : "/teacher/accounts"} className="dashboard-action-card">
                                <strong>帳號管理</strong>
                                <span>查看與編輯學生帳號資料</span>
                            </Link>
                            <Link to="/teacher/students" className="dashboard-action-card">
                                <strong>建立學生邀請</strong>
                                <span>填寫學生資料並傳送註冊連結</span>
                            </Link>
                            <Link to="/teacher/add-music" className="dashboard-action-card">
                                <strong>教材音檔</strong>
                                <span>新增教材、上傳與管理音檔</span>
                            </Link>
                        </div>
                    </section>
                </>
            )}

            {noticeDraft && noticeStudent && (
                <div className="guardian-reminder-modal-backdrop" onClick={() => setNoticeDraft(null)} role="presentation">
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
                        <p>目前這一步會開啟裝置上的 Email App；網站會保留提醒紀錄，但不會假裝已經由伺服器自動寄出。</p>
                        <div className="guardian-reminder-actions">
                            <button type="button" onClick={() => setNoticeDraft(null)}>取消</button>
                            <button type="button" onClick={openMailClient}>開啟 Email</button>
                            <button type="button" className="primary" onClick={markReminderSent}>我已寄出</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManagementDashboard;
