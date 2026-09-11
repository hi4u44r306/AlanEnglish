import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
    FiArrowRight,
    FiBookOpen,
    FiCheckSquare,
    FiMic,
    FiMoreHorizontal,
    FiStar
} from "react-icons/fi";
import Logout from "./Logout";
import { useAuth } from "../../auth/AuthContext";
import "./css/User.scss";

export const StudentLaunchpad = ({ user }) => {
    const features = user?.membership?.effective_access?.features || {};
    const hasActiveAccess = user?.membership?.is_active === true;
    const hasAiAccess = hasActiveAccess && features.ai_materials === true;
    const hasAssignmentsAccess = hasActiveAccess && features.assignments === true;
    const hasMaterialsAccess = hasActiveAccess && features.listening === true;
    const hasSpeakingAccess = hasActiveAccess && (
        features.pronunciation === true
        || features.pronunciation_practice === true
        || user?.membership?.effective_access?.plan_codes?.includes("academy_internal") === true
    );

    const launchItems = useMemo(() => [
        hasMaterialsAccess && {
            id: "materials",
            title: "我的教材",
            description: "打開課本，開始聽英文",
            action: "選擇教材",
            icon: FiBookOpen,
            tone: "blue",
            menu: "materials"
        },
        hasSpeakingAccess && {
            id: "speaking",
            title: "開口說",
            description: "練發音，挑戰完整回答",
            action: "選擇練習",
            icon: FiMic,
            tone: "orange",
            menu: "speaking"
        },
        hasAssignmentsAccess && {
            id: "assignments",
            title: "我的作業",
            description: "查看老師交代的學習內容",
            action: "查看作業",
            icon: FiCheckSquare,
            tone: "yellow",
            path: "/student/assignments"
        },
        hasAiAccess && {
            id: "ai",
            title: "AI 教材",
            description: "做一份適合自己的英文練習",
            action: "開始使用",
            icon: FiStar,
            tone: "purple",
            path: "/student/ai-generator"
        },
        {
            id: "more",
            title: "更多功能",
            description: "複習、成果、設定都在這裡",
            action: "打開更多",
            icon: FiMoreHorizontal,
            tone: "navy",
            menu: "more"
        }
    ].filter(Boolean), [hasAiAccess, hasAssignmentsAccess, hasMaterialsAccess, hasSpeakingAccess]);

    const openStudentMenu = menu => {
        window.dispatchEvent(new CustomEvent("ae:open-student-menu", { detail: menu }));
    };

    return (
        <main className="student-launchpad">
            <header className="student-launchpad__hero">
                <span>ALAN ENGLISH</span>
                <h1>{user.name || "同學"}，想學什麼？</h1>
                <p>選一個喜歡的功能，就可以開始囉！</p>
            </header>

            <section className="student-launchpad__features" aria-label="學習功能">
                {launchItems.map(item => {
                    const Icon = item.icon;
                    const content = (
                        <>
                            <span className="student-launchpad__icon"><Icon /></span>
                            <span className="student-launchpad__copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                            <span className="student-launchpad__action">{item.action}<FiArrowRight /></span>
                        </>
                    );

                    return item.path
                        ? <Link key={item.id} className={`student-launchpad__card is-${item.tone}`} to={item.path}>{content}</Link>
                        : <button key={item.id} className={`student-launchpad__card is-${item.tone}`} type="button" onClick={() => openStudentMenu(item.menu)}>{content}</button>;
                })}
            </section>
            <footer className="student-launchpad__footer">需要幫忙嗎？打開「更多功能」就能找到使用教學。</footer>
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
