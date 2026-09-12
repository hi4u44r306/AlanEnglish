import React from "react";
import { Link } from "react-router-dom";
import {
    FiArrowRight,
    FiCheckSquare,
    FiHeadphones,
    FiMic
} from "react-icons/fi";
import Logout from "./Logout";
import { useAuth } from "../../auth/AuthContext";
import "./css/User.scss";

export const StudentLaunchpad = ({ user }) => {
    const features = user?.membership?.effective_access?.features || {};
    const hasActiveAccess = user?.membership?.is_active === true;
    const hasAssignmentsAccess = hasActiveAccess && features.assignments === true;

    return (
        <main className="student-launchpad">
            <header className="student-launchpad__hero">
                <span>今天也一起進步</span>
                <h1>嗨，{user.name || "同學"}！</h1>
                <p>教材、開口說和其他功能，都可以從導覽列找到。</p>
            </header>

            {hasAssignmentsAccess && (
                <section className="student-launchpad__mission" aria-label="今天的任務">
                    <span className="student-launchpad__mission-icon"><FiCheckSquare aria-hidden="true" /></span>
                    <span className="student-launchpad__mission-copy">
                        <small>老師交代的事</small>
                        <strong>看看今天的作業</strong>
                        <span>完成老師安排的內容，再去自由練習。</span>
                    </span>
                    <Link to="/student/assignments">
                        查看作業
                        <FiArrowRight aria-hidden="true" />
                    </Link>
                </section>
            )}

            <section className="student-launchpad__tips" aria-labelledby="student-learning-tip-title">
                <header>
                    <span>學習小撇步</span>
                    <h2 id="student-learning-tip-title">聽清楚，再勇敢說</h2>
                </header>
                <div>
                    <article>
                        <FiHeadphones aria-hidden="true" />
                        <span><strong>先聽一遍</strong><small>不用急著看答案</small></span>
                    </article>
                    <article>
                        <FiMic aria-hidden="true" />
                        <span><strong>再開口說</strong><small>說錯也沒關係</small></span>
                    </article>
                </div>
            </section>

            <footer className="student-launchpad__footer">找不到功能時，打開導覽列的「更多」就能找到使用教學。</footer>
        </main>
    );
};

const User = () => {
    const { studentProfile: user, authLoading } = useAuth();

    if (authLoading) {
        return (
            <div className="User">
                <div className="user-loading">
                    <div className="user-loading-spinner" />
                    <div>
                        <strong>正在打開學習首頁</strong>
                        <span>準備你的教材與功能...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="User">
                <div className="user-error-card">
                    <div className="user-error-icon">!</div>
                    <h2>找不到帳號資料</h2>
                    <p>請重新登入，或聯絡管理員確認帳號資料。</p>
                    <Logout />
                </div>
            </div>
        );
    }

    return (
        <div className="User">
            <StudentLaunchpad user={user} />
        </div>
    );
};

export default User;
