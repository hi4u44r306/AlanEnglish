import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "./supabase-config";
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
    const { role } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [searchText, setSearchText] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [classFilter, setClassFilter] = useState("all");

    const isAdmin = role === "admin";

    useEffect(() => {
        const fetchAccounts = async () => {
            setLoading(true);
            setErrorMessage("");

            let query = supabase
                .from("students")
                .select("id, firebase_uid, email, name, role, class, plan, updated_at")
                .order("name", { ascending: true });

            if (!isAdmin) {
                query = query.eq("role", "student");
            }

            const { data, error } = await query;

            if (error) {
                console.error("讀取帳號清單失敗:", error);
                setErrorMessage("帳號清單讀取失敗");
                setAccounts([]);
            } else {
                setAccounts(data || []);
            }

            setLoading(false);
        };

        fetchAccounts();
    }, [isAdmin]);

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

    return (
        <div className="management-page">
            <section className="management-hero">
                <div>
                    <span className="management-eyebrow">Account Management</span>
                    <h1>帳號管理</h1>
                    <p>
                        {isAdmin
                            ? "查看 Alan English 的學生、教師與管理員帳號。"
                            : "查看目前學生帳號與班級、方案資料。"}
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAccounts.length > 0 ? filteredAccounts.map(account => (
                                        <tr key={account.id}>
                                            <td>{account.name || "-"}</td>
                                            <td>{account.email || "-"}</td>
                                            <td>
                                                <span className={`role-badge role-${account.role || "student"}`}>
                                                    {ROLE_LABELS[account.role] || account.role || "Student"}
                                                </span>
                                            </td>
                                            <td>{account.role === "student" ? account.class || "-" : "-"}</td>
                                            <td>{account.role === "student" ? PLAN_LABELS[account.plan] || account.plan || "-" : "-"}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="management-empty">沒有符合條件的帳號</td>
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