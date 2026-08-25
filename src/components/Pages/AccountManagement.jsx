import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../auth/AuthContext";
import {
    archiveManagedAccount,
    getManagedAccounts,
    restoreManagedAccount,
    updateManagedAccount
} from "../../services/membershipService";
import {
    deleteAcademyInvitation,
    listAcademyInvitations,
    sendAcademyPasswordReset
} from "../../services/academyStudentService";
import "./css/ManagementDashboard.scss";

const ROLE_LABELS = {
    student: "Student",
    teacher: "Teacher",
    admin: "Admin"
};

const LEARNER_TYPE_LABELS = {
    academy_student: "英文班在學方案",
    textbook_customer: "網購教材聽力權限",
    trial_user: "7 天免費試用"
};

const getAccountPlanLabel = account => (
    LEARNER_TYPE_LABELS[account?.learner_type]
    || account?.membership?.plan?.name
    || "尚未設定"
);

const getAccountPlanKey = account => (
    account?.learner_type
    || account?.membership?.plan?.code
    || account?.plan
    || "unassigned"
);

const ACTIVATION_LABELS = {
    active: "尚未開通",
    claimed: "等待 Email 驗證",
    completed: "已開通",
    expired: "開通碼已過期",
    revoked: "已撤銷"
};

const ACCOUNT_STATUS_LABELS = {
    active: "使用中",
    archived: "已停用"
};

const ACCESS_STATUS_LABELS = {
    enabled: "已啟用",
    disabled: "未啟用"
};

const getAccountActivationStatus = (account, invitationByEmail) => {
    if (account?.role !== "student") return "not_applicable";
    const invitation = invitationByEmail.get(String(account.email || "").toLowerCase());
    return invitation?.status || (account.must_change_password ? "direct_pending" : "legacy");
};

function AccountManagement() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resettingEmail, setResettingEmail] = useState("");
    const [changingStatusId, setChangingStatusId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [searchText, setSearchText] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [classFilter, setClassFilter] = useState("all");
    const [planFilter, setPlanFilter] = useState("all");
    const [activationFilter, setActivationFilter] = useState("all");
    const [accountStatusFilter, setAccountStatusFilter] = useState("active");
    const [accessFilter, setAccessFilter] = useState("all");
    const [editingAccount, setEditingAccount] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        role: "student",
        class: "",
        plan: ""
    });

    const isAdmin = role === "admin";

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");

        try {
            const [accountResult, invitationResult] = await Promise.all([
                getManagedAccounts(firebaseUser),
                listAcademyInvitations(firebaseUser)
            ]);
            setAccounts(accountResult?.accounts || []);
            setInvitations(invitationResult);
        } catch (error) {
            console.error("讀取帳號清單失敗:", error);
            setErrorMessage(error?.message || "帳號清單讀取失敗");
            setAccounts([]);
            setInvitations([]);
        }

        setLoading(false);
    }, [firebaseUser]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const invitationByEmail = useMemo(() => {
        const result = new Map();
        invitations.forEach(invitation => {
            const email = String(invitation.invited_email || "").toLowerCase();
            if (email && !result.has(email)) result.set(email, invitation);
        });
        return result;
    }, [invitations]);

    const planOptions = useMemo(() => {
        const options = new Map();
        accounts.forEach(account => {
            if (account.role !== "student") return;
            const key = getAccountPlanKey(account);
            if (!options.has(key)) options.set(key, getAccountPlanLabel(account));
        });
        return Array.from(options, ([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
    }, [accounts]);

    const filteredAccounts = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return accounts.filter(account => {
            const matchKeyword = !keyword ||
                String(account.name || "").toLowerCase().includes(keyword) ||
                String(account.email || "").toLowerCase().includes(keyword);
            const matchRole = roleFilter === "all" || account.role === roleFilter;
            const matchClass = classFilter === "all" || account.class === classFilter;
            const matchPlan = planFilter === "all" || (
                account.role === "student" && getAccountPlanKey(account) === planFilter
            );
            const activationStatus = getAccountActivationStatus(account, invitationByEmail);
            const matchActivation = activationFilter === "all"
                || activationStatus === activationFilter;
            const accountStatus = account.account_status || "active";
            const matchAccountStatus = accountStatusFilter === "all"
                || accountStatus === accountStatusFilter;
            const accessStatus = account?.membership?.is_active === true ? "enabled" : "disabled";
            const matchAccess = accessFilter === "all" || (
                account.role === "student" && accessStatus === accessFilter
            );

            return matchKeyword
                && matchRole
                && matchClass
                && matchPlan
                && matchActivation
                && matchAccountStatus
                && matchAccess;
        });
    }, [
        accounts,
        searchText,
        roleFilter,
        classFilter,
        planFilter,
        activationFilter,
        accountStatusFilter,
        accessFilter,
        invitationByEmail
    ]);

    const pendingInvitations = useMemo(() => invitations.filter(invitation => (
        ["active", "claimed", "expired"].includes(invitation.status)
    )), [invitations]);

    const startEdit = account => {
        if (!isAdmin && account.role !== "student") return;

        setEditingAccount(account);
        setEditForm({
            name: account.name || "",
            role: account.role || "student",
            class: account.class || "",
            plan: account.plan || ""
        });
    };

    const cancelEdit = () => {
        if (saving) return;
        setEditingAccount(null);
    };

    const sendPasswordReset = async account => {
        if (!firebaseUser || !account?.email) return;
        if (!window.confirm(`要寄送密碼重設信給 ${account.email} 嗎？`)) return;

        setResettingEmail(account.email);
        try {
            await sendAcademyPasswordReset(firebaseUser, account.email);
            toast.success("密碼重設信已寄出");
        } catch (error) {
            toast.error(error?.message || "密碼重設信寄送失敗");
        } finally {
            setResettingEmail("");
        }
    };

    const handleRoleChange = event => {
        const nextRole = event.target.value;
        setEditForm(prev => ({
            ...prev,
            role: nextRole,
            class: nextRole === "student" ? prev.class : "",
            plan: nextRole === "student" ? prev.plan : ""
        }));
    };

    const saveAccount = async event => {
        event.preventDefault();

        if (!editingAccount) return;

        if (!editForm.name.trim()) {
            toast.error("Name 不可空白");
            return;
        }

        if (editForm.role === "student" && !editForm.class) {
            toast.error("英文班學生必須選擇班級");
            return;
        }

        if (!firebaseUser) {
            toast.error("登入狀態已失效，請重新登入");
            return;
        }

        setSaving(true);

        try {
            const result = await updateManagedAccount(firebaseUser, {
                id: editingAccount.id,
                name: editForm.name.trim(),
                role: isAdmin ? editForm.role : "student",
                class: editForm.role === "student" ? editForm.class : null,
                plan: editingAccount.plan || null
            });
            setAccounts(prev => prev.map(account => (
                account.id === result.account.id ? { ...account, ...result.account } : account
            )));

            setEditingAccount(null);
            toast.success("帳號資料更新成功");
        } catch (error) {
            console.error("帳號更新失敗:", error);
            toast.error(error.message || "帳號更新失敗");
        } finally {
            setSaving(false);
        }
    };

    const changeAccountStatus = async account => {
        if (!isAdmin || !firebaseUser || account?.role !== "student") return;
        const isArchived = account.account_status === "archived";
        const actionLabel = isArchived ? "恢復" : "停用";
        const confirmation = isArchived
            ? `要恢復 ${account.name || account.email} 的登入與使用權嗎？`
            : `要停用 ${account.name || account.email} 嗎？\n\n學習紀錄會保留，之後仍可恢復。`;
        if (!window.confirm(confirmation)) return;

        setChangingStatusId(account.id);
        try {
            const result = isArchived
                ? await restoreManagedAccount(firebaseUser, account.id)
                : await archiveManagedAccount(firebaseUser, account.id, "由帳號管理頁停用");
            setAccounts(prev => prev.map(item => (
                item.id === result.account.id ? { ...item, ...result.account } : item
            )));
            toast.success(isArchived
                ? "帳號已恢復，會重新出現在使用中清單"
                : "帳號已停用並從預設清單隱藏；可切換帳號狀態為已停用後恢復");
        } catch (error) {
            toast.error(error?.message || `帳號${actionLabel}失敗`);
        } finally {
            setChangingStatusId(null);
        }
    };

    const openInvitationDelete = invitation => {
        if (!isAdmin || invitation.claimed_by_student_id) return;
        setDeleteTarget({
            type: "invitation",
            id: invitation.id,
            email: String(invitation.invited_email || "").toLowerCase(),
            name: invitation.chinese_name || invitation.invited_email || "待開通學生"
        });
        setDeleteConfirmation("");
    };

    const closeDeleteDialog = () => {
        if (deleting) return;
        setDeleteTarget(null);
        setDeleteConfirmation("");
    };

    const confirmInvitationDelete = async event => {
        event.preventDefault();
        if (!firebaseUser || !deleteTarget) return;
        const normalizedConfirmation = deleteConfirmation.trim().toLowerCase();
        if (normalizedConfirmation !== deleteTarget.email) {
            toast.error("請輸入完整 Email 確認刪除邀請");
            return;
        }

        setDeleting(true);
        try {
            await deleteAcademyInvitation(
                firebaseUser,
                deleteTarget.id,
                normalizedConfirmation
            );
            setInvitations(prev => prev.filter(invitation => invitation.id !== deleteTarget.id));
            toast.success("待開通邀請已刪除");
            setDeleteTarget(null);
            setDeleteConfirmation("");
        } catch (error) {
            toast.error(error?.message || "刪除邀請失敗");
        } finally {
            setDeleting(false);
        }
    };

    const editingOwnAdminAccount = Boolean(
        isAdmin &&
        editingAccount &&
        editingAccount.firebase_uid === studentProfile?.firebase_uid
    );

    const resetFilters = () => {
        setSearchText("");
        setRoleFilter("all");
        setClassFilter("all");
        setPlanFilter("all");
        setActivationFilter("all");
        setAccountStatusFilter("active");
        setAccessFilter("all");
    };

    return (
        <div className="management-page">
            <section className="management-hero">
                <div>
                    <span className="management-eyebrow">Account Management</span>
                    <h1>帳號管理</h1>
                    <p>
                        {isAdmin
                            ? "查看並安全編輯 Alan English 的學生、教師與管理員帳號。"
                            : "查看學生帳號，並修改學生姓名、班級與方案。"}
                    </p>
                </div>

                <Link to="/teacher/students" className="management-primary-link">
                    快速建立學生
                </Link>
            </section>

            <section className="management-panel">
                <div className="management-toolbar">
                    <label className="management-filter management-search-filter">
                        <span>搜尋</span>
                        <input
                            type="search"
                            placeholder="姓名或 Email"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </label>

                    {isAdmin && (
                        <label className="management-filter">
                            <span>Role</span>
                            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                <option value="all">全部角色</option>
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="admin">Admin</option>
                            </select>
                        </label>
                    )}

                    <label className="management-filter">
                        <span>Class</span>
                        <select value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                            <option value="all">全部班級</option>
                            <option value="E1">E1 班</option>
                            <option value="E3">E3 班</option>
                            <option value="E5">E5 班</option>
                            <option value="E7">E7 班</option>
                        </select>
                    </label>

                    <label className="management-filter">
                        <span>Plan</span>
                        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
                            <option value="all">全部方案</option>
                            {planOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="management-filter">
                        <span>開通狀態</span>
                        <select value={activationFilter} onChange={e => setActivationFilter(e.target.value)}>
                            <option value="all">全部開通狀態</option>
                            <option value="direct_pending">待首次改密碼</option>
                            <option value="active">尚未開通</option>
                            <option value="claimed">等待 Email 驗證</option>
                            <option value="completed">已開通（邀請）</option>
                            <option value="legacy">已開通</option>
                            <option value="expired">開通碼已過期</option>
                            <option value="revoked">已撤銷</option>
                            <option value="not_applicable">不適用</option>
                        </select>
                    </label>

                    <label className="management-filter">
                        <span>帳號狀態</span>
                        <select value={accountStatusFilter} onChange={e => setAccountStatusFilter(e.target.value)}>
                            <option value="active">使用中（預設）</option>
                            <option value="archived">已停用</option>
                            <option value="all">全部帳號狀態</option>
                        </select>
                    </label>

                    <label className="management-filter">
                        <span>是否啟用</span>
                        <select value={accessFilter} onChange={e => setAccessFilter(e.target.value)}>
                            <option value="all">全部啟用狀態</option>
                            <option value="enabled">已啟用</option>
                            <option value="disabled">未啟用</option>
                        </select>
                    </label>

                    <button type="button" className="management-filter-reset" onClick={resetFilters}>
                        清除篩選
                    </button>
                </div>

                <p className="management-filter-hint">
                    已停用帳號預設隱藏；將「帳號狀態」切換為「已停用」即可查看並恢復。
                    「是否啟用」代表目前是否具有有效學習權限。
                </p>

                {loading ? (
                    <div className="management-state">正在讀取帳號資料...</div>
                ) : errorMessage ? (
                    <div className="management-state management-error">{errorMessage}</div>
                ) : (
                    <>
                        <div className="management-count">
                            顯示 {filteredAccounts.length} 筆／全部 {accounts.length} 筆帳號
                        </div>

                        <div className="management-table-wrap management-account-table-wrap">
                            <table className="management-table management-account-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Class</th>
                                        <th>Plan</th>
                                        <th>開通狀態</th>
                                        <th>帳號狀態</th>
                                        <th>是否啟用</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAccounts.length > 0 ? filteredAccounts.map(account => (
                                        <React.Fragment key={account.id}>
                                            <tr className={`management-account-row ${account.account_status === "archived" ? "is-archived" : ""}`}>
                                                <td data-label="Name">
                                                    <span className="management-account-name">{account.name || "-"}</span>
                                                    {account.account_status === "archived" && (
                                                        <span className="management-account-archived-note">已停用帳號</span>
                                                    )}
                                                </td>
                                                <td data-label="Email">{account.email || "-"}</td>
                                                <td data-label="Role">
                                                    <span className={`role-badge role-${account.role || "student"}`}>
                                                        {ROLE_LABELS[account.role] || account.role || "Student"}
                                                    </span>
                                                </td>
                                                <td data-label="Class">{account.role === "student" ? account.class || "-" : "-"}</td>
                                                <td data-label="Plan">{account.role === "student" ? getAccountPlanLabel(account) : "-"}</td>
                                                <td data-label="開通狀態">
                                                    {account.role === "student" ? (() => {
                                                        const status = getAccountActivationStatus(account, invitationByEmail);
                                                        return (
                                                            <span className={`activation-badge activation-${status}`}>
                                                                {status === "direct_pending"
                                                                    ? "待首次改密碼"
                                                                    : ACTIVATION_LABELS[status] || "已開通"}
                                                            </span>
                                                        );
                                                    })() : "-"}
                                                </td>
                                                <td data-label="帳號狀態">
                                                    <span className={`account-status-badge account-status-${account.account_status || "active"}`}>
                                                        {ACCOUNT_STATUS_LABELS[account.account_status || "active"]}
                                                    </span>
                                                </td>
                                                <td data-label="是否啟用">
                                                    {account.role === "student" ? (() => {
                                                        const status = account?.membership?.is_active === true
                                                            ? "enabled"
                                                            : "disabled";
                                                        return (
                                                            <span className={`access-status-badge access-status-${status}`}>
                                                                {ACCESS_STATUS_LABELS[status]}
                                                            </span>
                                                        );
                                                    })() : "-"}
                                                </td>
                                                <td data-label="操作">
                                                    <div className="management-row-actions">
                                                        {account.account_status !== "archived" && (
                                                            <button
                                                                type="button"
                                                                className="management-edit-button"
                                                                onClick={() => startEdit(account)}
                                                            >
                                                                編輯
                                                            </button>
                                                        )}
                                                        {isAdmin && account.email && account.account_status !== "archived" && (
                                                            <button
                                                                type="button"
                                                                className="management-reset-button"
                                                                onClick={() => sendPasswordReset(account)}
                                                                disabled={resettingEmail === account.email}
                                                            >
                                                                {resettingEmail === account.email ? "寄送中…" : "寄送密碼重設信"}
                                                            </button>
                                                        )}
                                                        {isAdmin && account.role === "student" && (
                                                            <button
                                                                type="button"
                                                                className={account.account_status === "archived"
                                                                    ? "management-restore-button"
                                                                    : "management-archive-button"}
                                                                onClick={() => changeAccountStatus(account)}
                                                                disabled={changingStatusId === account.id}
                                                            >
                                                                {changingStatusId === account.id
                                                                    ? "處理中…"
                                                                    : account.account_status === "archived" ? "恢復" : "停用"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {editingAccount?.id === account.id && (
                                                <tr className="management-edit-row">
                                                    <td colSpan="9">
                                                        <form className="management-edit-form" onSubmit={saveAccount}>
                                                            <div className="management-edit-grid">
                                                                <label>
                                                                    <span>Name</span>
                                                                    <input
                                                                        type="text"
                                                                        value={editForm.name}
                                                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                                        disabled={saving}
                                                                    />
                                                                </label>

                                                                <label>
                                                                    <span>Role</span>
                                                                    <select
                                                                        value={editForm.role}
                                                                        onChange={handleRoleChange}
                                                                        disabled={!isAdmin || saving || editingOwnAdminAccount}
                                                                    >
                                                                        <option value="student">Student</option>
                                                                        <option value="teacher">Teacher</option>
                                                                        <option value="admin">Admin</option>
                                                                    </select>
                                                                </label>

                                                                {editForm.role === "student" && (
                                                                    <>
                                                                        <label>
                                                                            <span>Class</span>
                                                                            <select
                                                                                value={editForm.class}
                                                                                onChange={e => setEditForm(prev => ({ ...prev, class: e.target.value }))}
                                                                                disabled={saving}
                                                                            >
                                                                                <option value="">選擇 Class</option>
                                                                                <option value="E1">E1</option>
                                                                                <option value="E3">E3</option>
                                                                                <option value="E5">E5</option>
                                                                                <option value="E7">E7</option>
                                                                            </select>
                                                                        </label>

                                                                        <label>
                                                                            <span>Plan（自動判定）</span>
                                                                            <input
                                                                                type="text"
                                                                                value={getAccountPlanLabel(editingAccount)}
                                                                                disabled
                                                                                readOnly
                                                                            />
                                                                        </label>
                                                                    </>
                                                                )}
                                                            </div>

                                                            <div className="management-edit-actions">
                                                                <button type="submit" className="management-save-button" disabled={saving}>
                                                                    {saving ? "儲存中..." : "儲存修改"}
                                                                </button>
                                                                <button type="button" className="management-cancel-button" onClick={cancelEdit} disabled={saving}>
                                                                    取消
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )) : (
                                        <tr>
                                            <td colSpan="9" className="management-empty">沒有符合條件的帳號</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>

            <section className="management-panel">
                <div className="management-pending-heading">
                    <div>
                        <span className="management-eyebrow">Account Activation</span>
                        <h2>待開通學生</h2>
                        <p>學生完成設定密碼與 Email 驗證後，狀態會自動更新為已開通。</p>
                    </div>
                    <strong>{pendingInvitations.length} 位</strong>
                </div>

                <div className="management-table-wrap">
                    <table className="management-table">
                        <thead>
                            <tr>
                                <th>學生</th>
                                <th>登入 Email</th>
                                <th>班級</th>
                                <th>開通狀態</th>
                                <th>開通期限</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingInvitations.length > 0 ? pendingInvitations.map(invitation => (
                                <tr key={invitation.id}>
                                    <td>{invitation.chinese_name || "-"}</td>
                                    <td>{invitation.invited_email || "-"}</td>
                                    <td>{invitation.class_code || "-"}</td>
                                    <td>
                                        <span className={`activation-badge activation-${invitation.status}`}>
                                            {ACTIVATION_LABELS[invitation.status] || invitation.status}
                                        </span>
                                    </td>
                                    <td>{invitation.expires_at ? new Date(invitation.expires_at).toLocaleDateString("zh-TW") : "-"}</td>
                                    <td>
                                        {isAdmin && !invitation.claimed_by_student_id ? (
                                            <button
                                                type="button"
                                                className="management-delete-button"
                                                onClick={() => openInvitationDelete(invitation)}
                                            >
                                                刪除邀請
                                            </button>
                                        ) : invitation.claimed_by_student_id ? "請於上方停用帳號" : "-"}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="6" className="management-empty">目前沒有待開通學生</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {deleteTarget && (
                <div className="management-delete-backdrop" role="presentation">
                    <section
                        className="management-delete-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="management-delete-title"
                    >
                        <span className="management-eyebrow">Invitation cleanup</span>
                        <h2 id="management-delete-title">刪除待開通邀請</h2>
                        <p>這會永久移除尚未被領取、且尚未建立學生帳號的邀請。</p>
                        <div className="management-delete-target">
                            <strong>{deleteTarget.name}</strong>
                            <span>{deleteTarget.email}</span>
                        </div>
                        <form onSubmit={confirmInvitationDelete}>
                            <label>
                                <span>輸入完整 Email 確認</span>
                                <input
                                    type="email"
                                    value={deleteConfirmation}
                                    onChange={event => setDeleteConfirmation(event.target.value)}
                                    placeholder={deleteTarget.email}
                                    autoFocus
                                    disabled={deleting}
                                />
                            </label>
                            <div className="management-delete-dialog__actions">
                                <button type="button" onClick={closeDeleteDialog} disabled={deleting}>取消</button>
                                <button
                                    type="submit"
                                    disabled={deleting || deleteConfirmation.trim().toLowerCase() !== deleteTarget.email}
                                >
                                    {deleting ? "刪除中…" : "確認刪除邀請"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

        </div>
    );
}

export default AccountManagement;
