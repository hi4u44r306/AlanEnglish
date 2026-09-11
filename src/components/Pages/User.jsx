import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    FiArrowRight,
    FiBarChart2,
    FiBookOpen,
    FiCheck,
    FiClock,
    FiHeadphones,
    FiMic,
    FiRefreshCw,
    FiTarget,
    FiTrendingUp,
    FiZap
} from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getAiMaterialUsage } from "../../services/aiMaterialService";
import { getStudentAssignments } from "../../services/assignmentService";
import { getReviewDashboard } from "../../services/reviewService";
import { getDashboardStats } from "../../services/listeningService";
import { getSpeakingLearningSummary } from "../../services/pronunciationCoachService";
import Logout from "./Logout";
import "./css/User.scss";

const DAILY_LISTENING_GOAL = 3;
const DEFAULT_AI_LIMIT = 5;

const EMPTY_HOME_DATA = {
    today: "",
    listening: {
        dailyCount: 0,
        monthlyCount: 0,
        totalCount: 0
    },
    assignments: {
        total: 0,
        completed: 0,
        pending: 0
    },
    review: {
        due: 0,
        learning: 0,
        mastered: 0,
        total: 0
    },
    ai: {
        used: 0,
        limit: DEFAULT_AI_LIMIT,
        remaining: DEFAULT_AI_LIMIT
    },
    speaking: {
        learnedSentences: 0,
        learnedWords: 0,
        savedRecordings: 0
    },
    firstBookPath: ""
};

const formatNumber = value => Number(value || 0).toLocaleString("zh-TW");

const formatToday = value => {
    const date = value
        ? new Date(`${value}T00:00:00+08:00`)
        : new Date();

    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "long",
        day: "numeric",
        weekday: "long"
    }).format(date);
};

const normalizeAssignments = result => {
    const assignments = Array.isArray(result?.assignments)
        ? result.assignments
        : [];
    const completed = assignments.filter(item => item?.progress?.completed).length;

    return {
        total: assignments.length,
        completed,
        pending: Math.max(0, assignments.length - completed)
    };
};

const User = () => {
    const { firebaseUser, studentProfile: user, authLoading } = useAuth();
    const displayName = user?.nickname || user?.name || "同學";
    const [homeData, setHomeData] = useState(EMPTY_HOME_DATA);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dataWarning, setDataWarning] = useState("");

    const loadHomeData = useCallback(async ({ silent = false } = {}) => {
        if (!firebaseUser || !user || user.role !== "student") {
            setHomeData(current => ({
                ...current,
                listening: {
                    dailyCount: 0,
                    monthlyCount: 0,
                    totalCount: Number(user?.total_time_played || 0)
                }
            }));
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        const canUseAssignments = user?.membership?.effective_access?.features?.assignments === true;
        const assignmentRequest = canUseAssignments
            ? getStudentAssignments(firebaseUser)
            : Promise.resolve({ assignments: [] });
        const canUseSpeaking = user?.membership?.effective_access?.features?.pronunciation === true;
        const speakingRequest = canUseSpeaking
            ? getSpeakingLearningSummary(firebaseUser)
            : Promise.resolve({ summary: {} });

        const requests = await Promise.allSettled([
            getDashboardStats(firebaseUser),
            assignmentRequest,
            getReviewDashboard(firebaseUser),
            getAiMaterialUsage(firebaseUser),
            getAccessibleCatalog(firebaseUser),
            speakingRequest
        ]);

        const [listeningResult, assignmentResult, reviewResult, aiResult, bookResult, speakingResult] = requests;
        const failedCount = requests.filter(result => result.status === "rejected").length;

        setHomeData(current => {
            const next = { ...current };

            if (listeningResult.status === "fulfilled") {
                next.listening = {
                    dailyCount: Number(listeningResult.value?.daily_count || 0),
                    monthlyCount: Number(listeningResult.value?.monthly_count || 0),
                    totalCount: Number(listeningResult.value?.total_count || 0)
                };
            }

            if (assignmentResult.status === "fulfilled") {
                next.today = assignmentResult.value?.today || "";
                next.assignments = normalizeAssignments(assignmentResult.value);
            }

            if (reviewResult.status === "fulfilled") {
                const reviewStats = reviewResult.value?.stats || {};
                next.review = {
                    due: Number(reviewStats.due || 0),
                    learning: Number(reviewStats.learning || 0),
                    mastered: Number(reviewStats.mastered || 0),
                    total: Number(reviewStats.total || 0)
                };
            }

            if (aiResult.status === "fulfilled") {
                const usage = aiResult.value?.usage || {};
                next.ai = {
                    used: Number(usage.used || 0),
                    limit: Number(usage.limit || DEFAULT_AI_LIMIT),
                    remaining: Number(usage.remaining ?? DEFAULT_AI_LIMIT)
                };
            }

            if (bookResult.status === "fulfilled") {
                const firstUnlockedBook = (bookResult.value?.categories || [])
                    .flatMap(category => category.books || [])
                    .find(book => !book.locked);
                next.firstBookPath = firstUnlockedBook?.code
                    ? `/student/books/${firstUnlockedBook.code}`
                    : "/student/level";
            }

            if (speakingResult.status === "fulfilled") {
                const speaking = speakingResult.value?.summary || {};
                next.speaking = {
                    learnedSentences: Number(speaking.learned_sentences || 0),
                    learnedWords: Number(speaking.learned_words || 0),
                    savedRecordings: Number(speaking.saved_recordings || 0)
                };
            }

            return next;
        });

        setDataWarning(failedCount > 0 ? "部分學習資料暫時無法更新，其餘內容仍可正常使用。" : "");
        setLoading(false);
        setRefreshing(false);
    }, [firebaseUser, user]);

    useEffect(() => {
        loadHomeData();
    }, [loadHomeData]);

    useEffect(() => {
        const refreshProgress = () => loadHomeData({ silent: true });

        window.addEventListener("ae:track-progress-updated", refreshProgress);
        window.addEventListener("ae:review-progress-updated", refreshProgress);
        window.addEventListener("focus", refreshProgress);

        return () => {
            window.removeEventListener("ae:track-progress-updated", refreshProgress);
            window.removeEventListener("ae:review-progress-updated", refreshProgress);
            window.removeEventListener("focus", refreshProgress);
        };
    }, [loadHomeData]);

    const hasAiAccess = user?.membership?.effective_access?.features?.ai_materials === true;
    const hasSpeakingAccess = user?.membership?.effective_access?.features?.pronunciation === true
        || user?.membership?.effective_access?.features?.pronunciation_practice === true;
    const hasAcademyRewards = user?.learner_type === "academy_student"
        && user?.membership?.effective_access?.plan_codes?.includes("academy_internal") === true;

    const dailyTasks = useMemo(() => {
        const tasks = [];

        if (homeData.assignments.total > 0) {
            tasks.push({
                id: "assignment",
                title: "完成今日作業",
                description: homeData.assignments.pending > 0
                    ? `還有 ${homeData.assignments.pending} 項老師指定的任務`
                    : `今天的 ${homeData.assignments.total} 項作業都完成了`,
                metaValue: `${homeData.assignments.completed}/${homeData.assignments.total}`,
                metaLabel: "完成",
                completed: homeData.assignments.pending === 0,
                icon: FiBookOpen,
                path: "/student/assignments",
                action: homeData.assignments.pending > 0 ? "開始作業" : "再次複習",
                tone: "blue"
            });
        }

        if (homeData.review.due > 0) {
            tasks.push({
                id: "review",
                title: "智慧錯題複習",
                description: `今天有 ${homeData.review.due} 題需要重新想一次`,
                metaValue: `${homeData.review.due}`,
                metaLabel: "題待複習",
                completed: false,
                icon: FiRefreshCw,
                path: "/student/review",
                action: "開始複習",
                tone: "review"
            });
        }

        tasks.push({
            id: "listening",
            title: "聽力暖身",
            description: homeData.listening.dailyCount >= DAILY_LISTENING_GOAL
                ? "今天的聽力目標已經達成"
                : `再聽 ${Math.max(0, DAILY_LISTENING_GOAL - homeData.listening.dailyCount)} 次，完成今日暖身`,
            metaValue: `${Math.min(homeData.listening.dailyCount, DAILY_LISTENING_GOAL)}/${DAILY_LISTENING_GOAL}`,
            metaLabel: "完成",
            completed: homeData.listening.dailyCount >= DAILY_LISTENING_GOAL,
            icon: FiHeadphones,
            path: homeData.firstBookPath || "/student/assignments",
            action: homeData.listening.dailyCount >= DAILY_LISTENING_GOAL ? "繼續聆聽" : "開始聆聽",
            tone: "orange"
        });

        return tasks;
    }, [homeData]);

    const completedTaskCount = dailyTasks.filter(task => task.completed).length;
    const dailyProgress = dailyTasks.length
        ? Math.round((completedTaskCount / dailyTasks.length) * 100)
        : 0;

    const primaryAction = useMemo(() => {
        const pendingTask = dailyTasks.find(task => !task.completed);

        if (pendingTask) {
            return {
                path: pendingTask.path,
                label: pendingTask.action
            };
        }

        return {
            path: homeData.firstBookPath || "/student/review",
            label: "自由練習"
        };
    }, [dailyTasks, homeData.firstBookPath]);

    if (authLoading || loading) {
        return (
            <div className="User">
                <div className="user-loading">
                    <div className="user-loading-spinner" />
                    <div>
                        <strong>正在整理今天的學習任務</strong>
                        <span>同步作業、聽力與學習進度...</span>
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
            <div className="student-home">
                <section className="student-home__hero">
                    <div className="student-home__hero-copy">
                        <span className="student-home__eyebrow">
                            <FiTarget /> TODAY'S MISSION · {formatToday(homeData.today)}
                        </span>
                        <h1>{displayName}，今天先完成這些！</h1>
                        <p>
                            {dailyProgress === 100
                                ? "太棒了，今天的學習任務全部完成，可以自由複習最喜歡的內容。"
                                : `已完成 ${completedTaskCount} 項，跟著順序練習，大約 10 分鐘就能完成。`}
                        </p>
                        <Link className="student-home__primary" to={primaryAction.path}>
                            <span>
                                <small>NEXT STEP</small>
                                <strong>{primaryAction.label}</strong>
                            </span>
                            <FiArrowRight />
                        </Link>
                    </div>

                    <div className="student-home__progress" style={{ "--mission-progress": `${dailyProgress * 3.6}deg` }}>
                        <div>
                            <strong>{dailyProgress}%</strong>
                            <span>今日進度</span>
                        </div>
                    </div>
                </section>

                {dataWarning && (
                    <div className="student-home__warning">
                        <span>{dataWarning}</span>
                        <button type="button" onClick={() => loadHomeData()} disabled={refreshing}>
                            <FiRefreshCw className={refreshing ? "is-spinning" : ""} />
                            重新整理
                        </button>
                    </div>
                )}

                <section className="student-home__section">
                    <div className="student-home__section-heading">
                        <div>
                            <span>LEARNING PATH</span>
                            <h2>今天的學習路線</h2>
                            <p>照順序完成，不用自己煩惱下一步要做什麼。</p>
                            <div className="student-home__reward-note">
                                <FiZap />
                                <strong>
                                    {homeData.assignments.total > 0
                                        ? hasAcademyRewards ? "完成老師作業可獲得 +30 XP 與 +5 AE Points" : "完成老師作業與練習可累積 XP"
                                        : hasAcademyRewards ? "完成聽力、作業與挑戰，可以累積 XP 與 AE Points！" : "完成聽力與複習，可以累積 XP！"}
                                </strong>
                            </div>
                        </div>
                        <div className="student-home__completion-chip">
                            <FiCheck /> {completedTaskCount} / {dailyTasks.length} 完成
                        </div>
                    </div>

                    {homeData.assignments.total === 0 && (
                        <div className="student-home__no-homework">
                            <FiClock />
                            <span>
                                <strong>今天沒有老師指定的新作業</strong>
                                {hasSpeakingAccess
                                    ? "，可以完成聽力、複習或口說大挑戰。"
                                    : "，可以完成聽力與智慧複習。"}
                            </span>
                        </div>
                    )}

                    <div className="student-home__task-list">
                        {dailyTasks.map((task, index) => {
                            const Icon = task.icon;

                            return (
                                <article className={`student-home__task student-home__task--${task.tone} ${task.completed ? "is-completed" : ""}`} key={task.id}>
                                    <div className="student-home__task-order">
                                        {task.completed ? <FiCheck /> : index + 1}
                                    </div>
                                    <div className="student-home__task-icon"><Icon /></div>
                                    <div className="student-home__task-copy">
                                        <div>
                                            <h3>{task.title}</h3>
                                            <span className="student-home__task-meta">
                                                <strong>{task.metaValue}</strong>
                                                <small>{task.metaLabel}</small>
                                            </span>
                                        </div>
                                        <p>{task.description}</p>
                                    </div>
                                    <Link to={task.path}>
                                        {task.action}
                                        <FiArrowRight />
                                    </Link>
                                </article>
                            );
                        })}
                    </div>
                </section>

                {(hasAiAccess || hasSpeakingAccess) && (
                    <section className="student-home__extra-practice" aria-labelledby="extra-practice-heading">
                        <div className="student-home__extra-practice-heading">
                            <div>
                                <span>MORE PRACTICE</span>
                                <h2 id="extra-practice-heading">想多練一點？</h2>
                            </div>
                            <small>不影響今天的任務順序</small>
                        </div>
                        <div className="student-home__extra-practice-list">
                            {hasSpeakingAccess && <Link to="/student/speaking-challenges" className="student-home__extra-practice-item student-home__extra-practice-item--speaking"><FiMic /><span><strong>口說大挑戰</strong><small>聽問題、開口回答，留下自己的練習成果。</small></span><FiArrowRight /></Link>}
                            {hasAiAccess && <Link to="/student/ai-generator" className="student-home__extra-practice-item student-home__extra-practice-item--ai"><FiZap /><span><strong>AI 練習</strong><small>{homeData.ai.used > 0 ? `今天已使用 ${homeData.ai.used} 次，還有 ${homeData.ai.remaining} 次可用。` : "依今天想加強的主題建立延伸練習。"}</small></span><FiArrowRight /></Link>}
                        </div>
                    </section>
                )}

                <section className="student-home__overview">
                    <div className="student-home__overview-heading">
                        <div>
                            <span>YOUR PROGRESS</span>
                            <h2>本週學習累積</h2>
                        </div>
                        <FiTrendingUp />
                    </div>

                    <div className="student-home__stats">
                        <article>
                            <div className="student-home__stat-icon student-home__stat-icon--today"><FiZap /></div>
                            <div className="student-home__stat-copy">
                                <span>今日聽力</span>
                                <div className="student-home__stat-value">
                                    <strong>{formatNumber(homeData.listening.dailyCount)}</strong>
                                    <small>次播放</small>
                                </div>
                            </div>
                        </article>
                        <article>
                            <div className="student-home__stat-icon student-home__stat-icon--speaking"><FiMic /></div>
                            <div className="student-home__stat-copy">
                                <span>已學口說</span>
                                <div className="student-home__stat-value">
                                    <strong>{formatNumber(homeData.speaking.learnedSentences)}</strong>
                                    <small>句</small>
                                </div>
                            </div>
                        </article>
                        <article>
                            <div className="student-home__stat-icon student-home__stat-icon--month"><FiHeadphones /></div>
                            <div className="student-home__stat-copy">
                                <span>本月聽力</span>
                                <div className="student-home__stat-value">
                                    <strong>{formatNumber(homeData.listening.monthlyCount)}</strong>
                                    <small>次播放</small>
                                </div>
                            </div>
                        </article>
                    </div>
                </section>

                <Link to="/student/weekly-report" className="student-home__weekly-report">
                    <div className="student-home__weekly-report-icon"><FiBarChart2 /></div>
                    <div>
                        <span>FOR PARENTS · WEEKLY REPORT</span>
                        <strong>把這週的努力，分享給家長看</strong>
                        <p>聽力、作業、AI、複習與口說會整理成清楚摘要，可直接複製給家長。</p>
                    </div>
                    <div className="student-home__weekly-report-action">查看報告 <FiArrowRight /></div>
                </Link>

                <footer className="student-home__footer">© 2020–2026 Alan English Inc.</footer>
            </div>
        </div>
    );
};

export default User;
