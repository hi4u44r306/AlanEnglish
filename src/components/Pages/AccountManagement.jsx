import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../auth/AuthContext";
import { getManagedAccounts, updateManagedAccount } from "../../services/membershipService";
import "./css/ManagementDashboard.scss";

const ROLE_LABELS = {
    student: "Student",
    teacher: "Teacher",
    admin: "Admin"
};

const PLAN_LABELS = {
    listeningonly: "純聽力",
    allcover: "全方位"
};

function AccountManagement() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [searchText, setSearchText] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [classFilter, setClassFilter] = useState("all");
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
            const result = await getManagedAccounts(firebaseUser);
            setAccounts(result?.accounts || []);
        } catch (error) {
            console.error("讀取帳號清單失敗:", error);
            setErrorMessage(error?.message || "帳號清單讀取失敗");
            setAccounts([]);
        }

        setLoading(false);
    }, [firebaseUser]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const filteredAccounts = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return accounts.filter(account => {
            const matchKeyword = !keyword ||
                String(account.name || "").toLowerCase().includes(keyword) ||
                String(account.email || "").toLowerCase().includes(keyword);

            const matchRole = roleFilter === "all" || account.role === roleFilter;
            const matchClass = classFilter === "all" || account.class === classFilter;

            return matchKeyword && matchRole && matchClass;
        });
    }, [accounts, searchText, roleFilter, classFilter]);

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

        if (editForm.role === "student" && (!editForm.class || !editForm.plan)) {
            toast.error("學生必須選擇 Class 與 Plan");
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
                plan: editForm.role === "student" ? editForm.plan : null
            });
            setAccounts(prev => prev.map(account => (
                account.id === result.account.id ? result.account : account
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

    const editingOwnAdminAccount = Boolean(
        isAdmin &&
        editingAccount &&
        editingAccount.firebase_uid === studentProfile?.firebase_uid
    );

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
                    建立帳號
                </Link>
            </section>

            <section className="management-panel">
                <div className="management-toolbar">
                    <input
                        type="search"
                        placeholder="搜尋姓名或 Email"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />

                    {isAdmin && (
                        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                            <option value="all">全部角色</option>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                    )}

                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                        <option value="all">全部班級</option>
                        <option value="A">A 班</option>
                        <option value="B">B 班</option>
                        <option value="C">C 班</option>
                        <option value="D">D 班</option>
                    </select>
                </div>

                {loading ? (
                    <div className="management-state">正在讀取帳號資料...</div>
                ) : errorMessage ? (
                    <div className="management-state management-error">{errorMessage}</div>
                ) : (
                    <>
                        <div className="management-count">共 {filteredAccounts.length} 筆帳號</div>

                        <div className="management-table-wrap">
                            <table className="management-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Class</th>
                                        <th>Plan</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAccounts.length > 0 ? filteredAccounts.map(account => (
                                        <React.Fragment key={account.id}>
                                            <tr>
                                                <td>{account.name || "-"}</td>
                                                <td>{account.email || "-"}</td>
                                                <td>
                                                    <span className={`role-badge role-${account.role || "student"}`}>
                                                        {ROLE_LABELS[account.role] || account.role || "Student"}
                                                    </span>
                                                </td>
                                                <td>{account.role === "student" ? account.class || "-" : "-"}</td>
                                                <td>{account.role === "student" ? PLAN_LABELS[account.plan] || account.plan || "-" : "-"}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="management-edit-button"
                                                        onClick={() => startEdit(account)}
                                                    >
                                                        編輯
                                                    </button>
                                                </td>
                                            </tr>

                                            {editingAccount?.id === account.id && (
                                                <tr className="management-edit-row">
                                                    <td colSpan="6">
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
                                                                                <option value="A">A</option>
                                                                                <option value="B">B</option>
                                                                                <option value="C">C</option>
                                                                                <option value="D">D</option>
                                                                            </select>
                                                                        </label>

                                                                        <label>
                                                                            <span>Plan</span>
                                                                            <select
                                                                                value={editForm.plan}
                                                                                onChange={e => setEditForm(prev => ({ ...prev, plan: e.target.value }))}
                                                                                disabled={saving}
                                                                            >
                                                                                <option value="">選擇 Plan</option>
                                                                                <option value="listeningonly">純聽力</option>
                                                                                <option value="allcover">全方位</option>
                                                                            </select>
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
                                            <td colSpan="6" className="management-empty">沒有符合條件的帳號</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>

        </div>
    );
}

export default AccountManagement;
