import React, { useEffect, useState } from "react";
import { supabase } from "./supabase-config";
import Logout from "./Logout";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./css/User.scss";

const User = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const useruid = localStorage.getItem("ae-useruid");

    useEffect(() => {
        const fetchUser = async () => {
            if (!useruid) {
                toast.error("找不到登入資料，請重新登入");
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from("students")
                    .select("*")
                    .eq("firebase_uid", useruid)
                    .maybeSingle();

                if (error) throw error;

                if (!data) {
                    toast.error("找不到學生資料");
                    setLoading(false);
                    return;
                }

                setUser(data);
                localStorage.setItem("ae-username", data.name || "");
                localStorage.setItem("ae-class", data.class || "");
                localStorage.setItem("ae-plan", data.plan || "");
                localStorage.setItem("ae-role", data.role || "student");
            } catch (error) {
                console.error("讀取學生資料失敗:", error);
                toast.error(`學生資料讀取失敗：${error.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [useruid]);

    const getInitial = (name) => {
        if (!name) return "A";
        return name.trim().charAt(0).toUpperCase();
    };

    const getPlanName = (plan) => {
        if (plan === "listeningonly") return "純聽力方案";
        if (plan === "allcover") return "全方位方案";
        return "一般方案";
    };

    const getRoleName = (role) => {
        if (role === "teacher") return "教師";
        if (role === "admin") return "管理員";
        return "學生";
    };

    const formatNumber = (number) => {
        return Number(number || 0).toLocaleString();
    };

    if (loading) {
        return (
            <div className="User">
                <div className="user-loading">
                    <div className="user-loading-spinner"></div>
                    <span>正在載入學生資料...</span>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="User">
                <div className="user-error-card">
                    <div className="user-error-icon">!</div>
                    <h2>找不到學生資料</h2>
                    <p>請重新登入，或聯絡老師確認帳號資料。</p>
                    <Logout />
                </div>
            </div>
        );
    }

    return (
        <div className="User">
            <div className="user-page">
                <section className="user-hero">
                    <div className="user-hero-content">
                        <div className="user-avatar">{getInitial(user.name)}</div>
                        <div className="user-hero-info">
                            <span className="user-eyebrow">MY PROFILE</span>
                            <h1>Hi, {user.name || "Student"} 👋</h1>
                            <p>今天也繼續累積你的英文聽力實力。</p>
                            <div className="user-badges">
                                {user.class && <span className="user-badge">{user.class} 班</span>}
                                <span className="user-badge plan">{getPlanName(user.plan)}</span>
                                <span className="user-badge role">{getRoleName(user.role)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="user-hero-decoration">AE</div>
                </section>

                <section className="user-stats">
                    <div className="user-stat-card">
                        <div className="user-stat-icon">🎧</div>
                        <div>
                            <span>累積聽力次數</span>
                            <strong>{formatNumber(user.total_time_played)}</strong>
                        </div>
                    </div>
                    <div className="user-stat-card">
                        <div className="user-stat-icon">▶</div>
                        <div>
                            <span>目前練習次數</span>
                            <strong>{formatNumber(user.current_time_played)}</strong>
                        </div>
                    </div>
                    <div className="user-stat-card">
                        <div className="user-stat-icon">📚</div>
                        <div>
                            <span>學習方案</span>
                            <strong className="stat-text">{getPlanName(user.plan)}</strong>
                        </div>
                    </div>
                </section>

                <div className="user-content-grid">
                    <section className="user-card user-profile-card">
                        <div className="user-card-header">
                            <div>
                                <span className="user-card-eyebrow">ACCOUNT</span>
                                <h2>學生資料</h2>
                            </div>
                            <span className="user-status"><i></i>帳號正常</span>
                        </div>

                        <div className="user-info-list">
                            <div className="user-info-row">
                                <div className="user-info-label">
                                    <span>👤</span>
                                    <div>
                                        <small>姓名</small>
                                        <strong>{user.name || "—"}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="user-info-row">
                                <div className="user-info-label">
                                    <span>✉</span>
                                    <div>
                                        <small>Email</small>
                                        <strong>{user.email || "—"}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="user-info-row">
                                <div className="user-info-label">
                                    <span>🏫</span>
                                    <div>
                                        <small>班級</small>
                                        <strong>{user.class ? `${user.class} 班` : "尚未設定"}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="user-info-row">
                                <div className="user-info-label">
                                    <span>🪪</span>
                                    <div>
                                        <small>帳號角色</small>
                                        <strong>{getRoleName(user.role)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="user-card user-plan-card">
                        <div className="user-card-header">
                            <div>
                                <span className="user-card-eyebrow">PLAN</span>
                                <h2>我的方案</h2>
                            </div>
                        </div>

                        <div className="user-plan-content">
                            <div className="plan-icon">★</div>
                            <span>目前方案</span>
                            <h3>{getPlanName(user.plan)}</h3>

                            {user.plan === "allcover" ? (
                                <p>可以使用完整教材與英文聽力練習內容。</p>
                            ) : user.plan === "listeningonly" ? (
                                <p>目前以英文聽力練習內容為主。</p>
                            ) : (
                                <p>目前使用一般 Alan English 學習方案。</p>
                            )}

                            <div className="plan-features">
                                <div><span>✓</span>個人學習資料</div>
                                <div><span>✓</span>聽力練習紀錄</div>
                                <div><span>✓</span>教材播放功能</div>
                            </div>
                        </div>
                    </section>
                </div>

                <section className="user-account-section">
                    <div>
                        <span className="user-card-eyebrow">SESSION</span>
                        <h2>帳號管理</h2>
                        <p>使用完畢後記得登出，避免其他人使用你的帳號。</p>
                    </div>
                    <div className="user-logout-wrapper">
                        <Logout />
                    </div>
                </section>

                <div className="user-footer">© 2020–2026 Alan English Inc.</div>
            </div>

            <ToastContainer
                position="top-center"
                autoClose={2000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss={false}
                draggable
                pauseOnHover={false}
            />
        </div>
    );
};

export default User;