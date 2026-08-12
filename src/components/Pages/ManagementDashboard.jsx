import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "./supabase-config";
import "./css/ManagementDashboard.scss";

function ManagementDashboard() {
    const { role, studentProfile } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const isAdmin = role === "admin";

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            setErrorMessage("");

            let query = supabase
                .from("students")
                .select("id, role, class, plan");

            if (!isAdmin) {
                query = query.eq("role", "student");
            }

            const { data, error } = await query;

            if (error) {
                console.error("讀取 Dashboard 統計失敗:", error);
                setErrorMessage("Dashboard 資料讀取失敗");
                setAccounts([]);
            } else {
                setAccounts(data || []);
            }

            setLoading(false);
        };

        fetchDashboardData();
    }, [isAdmin]);

    const stats = useMemo(() => {
        const students = accounts.filter(account => account.role === "student");
        const teachers = accounts.filter(account => account.role === "teacher");
        const admins = accounts.filter(account => account.role === "admin");

        return {
            total: accounts.length,
            students: students.length,
            teachers: teachers.length,
            admins: admins.length,
            classA: students.filter(account => account.class === "A").length,
            classB: students.filter(account => account.class === "B").length,
            classC: students.filter(account => account.class === "C").length,
            classD: students.filter(account => account.class === "D").length
        };
    }, [accounts]);

    return (
        <div className="management-page">
            <section className="management-hero">
                <div>
                    <span className="management-eyebrow">
                        {isAdmin ? "Admin Dashboard" : "Teacher Dashboard"}
                    </span>
                    <h1>{studentProfile?.name || (isAdmin ? "Admin" : "Teacher")}，歡迎回來</h1>
                    <p>
                        {isAdmin
                            ? "管理 Alan English 的帳號、教材與系統功能。"
                            : "查看學生狀態並快速進入常用的教學管理功能。"}
                    </p>
                </div>
            </section>

            {loading ? (
                <div className="management-state">正在載入 Dashboard...</div>
            ) : errorMessage ? (
                <div className="management-state management-error">{errorMessage}</div>
            ) : (
                <>
                    <section className="dashboard-stat-grid">
                        {isAdmin ? (
                            <>
                                <div className="dashboard-stat-card">
                                    <span>全部帳號</span>
                                    <strong>{stats.total}</strong>
                                </div>
                                <div className="dashboard-stat-card">
                                    <span>學生</span>
                                    <strong>{stats.students}</strong>
                                </div>
                                <div className="dashboard-stat-card">
                                    <span>教師</span>
                                    <strong>{stats.teachers}</strong>
                                </div>
                                <div className="dashboard-stat-card">
                                    <span>管理員</span>
                                    <strong>{stats.admins}</strong>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="dashboard-stat-card">
                                    <span>學生總數</span>
                                    <strong>{stats.students}</strong>
                                </div>
                                <div className="dashboard-stat-card">
                                    <span>A 班</span>
                                    <strong>{stats.classA}</strong>
                                </div>
                                <div className="dashboard-stat-card">
                                    <span>B 班</span>
                                    <strong>{stats.classB}</strong>
                                </div>
                                <div className="dashboard-stat-card">
                                    <span>C / D 班</span>
                                    <strong>{stats.classC + stats.classD}</strong>
                                </div>
                            </>
                        )}
                    </section>

                    <section className="dashboard-actions">
                        <h2>快速管理</h2>

                        <div className="dashboard-action-grid">
                            <Link
                                to={isAdmin ? "/admin/accounts" : "/teacher/accounts"}
                                className="dashboard-action-card"
                            >
                                <strong>帳號管理</strong>
                                <span>{isAdmin ? "查看與編輯所有角色帳號" : "查看與編輯學生帳號"}</span>
                            </Link>

                            <Link to="/teacher/students" className="dashboard-action-card">
                                <strong>建立帳號</strong>
                                <span>{isAdmin ? "建立 Student / Teacher / Admin" : "建立 Student 帳號"}</span>
                            </Link>

                            <Link to="/teacher/add-music" className="dashboard-action-card">
                                <strong>教材音檔</strong>
                                <span>新增教材、上傳與管理音檔</span>
                            </Link>

                            {isAdmin && (
                                <>
                                    <Link to="/admin/navbar" className="dashboard-action-card">
                                        <strong>教材導覽</strong>
                                        <span>管理 Navbar 與教材入口</span>
                                    </Link>

                                    <Link to="/admin/links" className="dashboard-action-card">
                                        <strong>系統連結</strong>
                                        <span>管理 Alan English 連結功能</span>
                                    </Link>
                                </>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

export default ManagementDashboard;