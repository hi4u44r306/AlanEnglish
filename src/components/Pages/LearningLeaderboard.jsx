import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiCamera, FiGift, FiRefreshCw, FiStar, FiTrendingUp } from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import {
    getGamificationClasses,
    getGamificationLeaderboard,
    getGamificationSummary,
    uploadGamificationImage
} from "../../services/gamificationService";
import "./css/Gamification.scss";

const PERIODS = [
    { value: "week", label: "本週" },
    { value: "month", label: "本月" },
    { value: "all", label: "總排行" }
];

const getInitial = name => String(name || "A").trim().charAt(0).toUpperCase() || "A";
const formatNumber = value => Number(value || 0).toLocaleString("zh-TW");

function LearningLeaderboard() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const isStudent = role === "student";
    const isStaff = role === "teacher" || role === "admin";
    const fileInputRef = useRef(null);
    const [period, setPeriod] = useState("week");
    const [classCode, setClassCode] = useState(studentProfile?.class || "");
    const [classes, setClasses] = useState([]);
    const [data, setData] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!firebaseUser) return;
        silent ? setRefreshing(true) : setLoading(true);
        try {
            const requests = [
                getGamificationLeaderboard(firebaseUser, period, isStaff ? classCode || null : null)
            ];
            if (isStudent) requests.push(getGamificationSummary(firebaseUser));
            if (isStaff) requests.push(getGamificationClasses(firebaseUser));

            const results = await Promise.all(requests);
            setData(results[0]);
            if (isStudent) setSummary(results[1]);
            if (isStaff) {
                const classResult = results[1];
                const nextClasses = classResult?.classes || [];
                setClasses(nextClasses);
                if (!classCode && nextClasses.length > 0) setClassCode(nextClasses[0]);
            }
        } catch (error) {
            toast.error(error.message || "排行榜讀取失敗");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [firebaseUser, period, classCode, isStudent, isStaff]);

    useEffect(() => {
        load();
    }, [load]);

    const handleAvatarChange = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !firebaseUser || !isStudent) return;
        setUploading(true);
        try {
            const result = await uploadGamificationImage(firebaseUser, "avatar", file);
            setSummary(current => current ? {
                ...current,
                profile: { ...current.profile, avatar_url: result.image_url }
            } : current);
            toast.success("排行榜照片已更新");
            await load({ silent: true });
        } catch (error) {
            toast.error(error.message || "照片上傳失敗");
        } finally {
            setUploading(false);
        }
    };

    const rows = data?.leaderboard || [];
    const currentClass = data?.class_code || classCode || studentProfile?.class || "";

    return (
        <main className="gamification-page">
            <section className="gamification-hero">
                <div>
                    <span className="gamification-eyebrow"><FiTrendingUp /> CLASS LEADERBOARD</span>
                    <h1>{currentClass ? `${currentClass} 班排行榜` : "班級排行榜"}</h1>
                    <p>完成聽力、作業與遊戲都能累積 XP；排行榜以 XP 排名，兌換獎品不會讓排名下降。</p>
                </div>
                <div className="gamification-hero__actions">
                    {isStaff && classes.length > 0 && (
                        <label className="gamification-select">
                            <span>班級</span>
                            <select value={classCode} onChange={event => setClassCode(event.target.value)}>
                                {classes.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </label>
                    )}
                    <div className="gamification-segment">
                        {PERIODS.map(item => (
                            <button
                                className={period === item.value ? "active" : ""}
                                key={item.value}
                                type="button"
                                onClick={() => setPeriod(item.value)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <button className="gamification-refresh" type="button" onClick={() => load({ silent: true })} disabled={refreshing}>
                        <FiRefreshCw className={refreshing ? "is-spinning" : ""} />
                        更新
                    </button>
                </div>
            </section>

            {isStudent && summary && (
                <section className="gamification-me-card">
                    <div className="gamification-avatar-wrap">
                        {summary.profile?.avatar_url
                            ? <img className="gamification-avatar gamification-avatar--large" src={summary.profile.avatar_url} alt={`${summary.profile?.name || "學生"} 的排行榜照片`} />
                            : <div className="gamification-avatar gamification-avatar--large gamification-avatar--fallback">{getInitial(summary.profile?.name)}</div>}
                        <button type="button" className="gamification-avatar-edit" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="更換排行榜照片">
                            <FiCamera />
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatarChange} />
                    </div>
                    <div className="gamification-me-card__identity">
                        <span>我的學習角色</span>
                        <strong>{summary.profile?.name || studentProfile?.name}</strong>
                        <small>{uploading ? "照片上傳中…" : "點相機可以更換排行榜照片"}</small>
                    </div>
                    <div className="gamification-stat">
                        <span>LEVEL</span>
                        <strong>Lv.{summary.balance?.level || 1}</strong>
                    </div>
                    <div className="gamification-stat">
                        <span>TOTAL XP</span>
                        <strong>{formatNumber(summary.balance?.total_xp)} XP</strong>
                    </div>
                    <div className="gamification-stat">
                        <span>AE POINTS</span>
                        <strong>{formatNumber(summary.balance?.points_balance)} P</strong>
                    </div>
                    <Link className="gamification-reward-link" to="/student/rewards"><FiGift />獎品商城</Link>
                </section>
            )}

            <section className="gamification-ranking-card">
                <header>
                    <div>
                        <span>RANKING</span>
                        <h2>{period === "week" ? "本週 XP 排行" : period === "month" ? "本月 XP 排行" : "累積 XP 排行"}</h2>
                    </div>
                    <div className="gamification-scoring-note"><FiStar />XP 不會因為兌換獎品而扣除</div>
                </header>

                {loading ? (
                    <div className="gamification-loading">排行榜載入中…</div>
                ) : rows.length === 0 ? (
                    <div className="gamification-empty">這個班級還沒有 XP 紀錄。</div>
                ) : (
                    <div className="gamification-ranking-list">
                        {rows.map(row => {
                            const rank = Number(row.rank_position || 0);
                            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
                            return (
                                <article className={`gamification-ranking-row ${row.is_current_user ? "is-me" : ""} ${rank <= 3 ? `is-top is-top-${rank}` : ""}`} key={row.student_id}>
                                    <div className="gamification-rank">{medal}</div>
                                    <div className="gamification-row-avatar">
                                        {row.avatar_url
                                            ? <img className="gamification-avatar" src={row.avatar_url} alt="" />
                                            : <div className="gamification-avatar gamification-avatar--fallback">{getInitial(row.student_name)}</div>}
                                    </div>
                                    <div className="gamification-student-copy">
                                        <strong>{row.student_name}{row.is_current_user ? " · 你" : ""}</strong>
                                        <span>{row.class_name ? `${row.class_name} 班` : "Alan English"} · Lv.{row.level || 1}</span>
                                    </div>
                                    <div className="gamification-xp">
                                        <strong>{formatNumber(row.period_xp)} XP</strong>
                                        <span>累積 {formatNumber(row.total_xp)} XP</span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}

export default LearningLeaderboard;
