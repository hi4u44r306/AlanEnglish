import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    FiArrowRight,
    FiBarChart2,
    FiBookOpen,
    FiCheck,
    FiClock,
    FiHeadphones,
    FiMessageCircle,
    FiRefreshCw,
    FiStar,
    FiTarget,
    FiTrendingUp,
    FiZap
} from "react-icons/fi";
import Logout from "./Logout";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getAiMaterialUsage } from "../../services/aiMaterialService";
import { getStudentAssignments } from "../../services/assignmentService";
import { getReviewDashboard } from "../../services/reviewService";
import { getConversationProgress } from "../../services/learningActivityService";
import { getDashboardStats } from "../../services/listeningService";
import "./css/User.scss";

const DAILY_LISTENING_GOAL = 3;
const DEFAULT_AI_LIMIT = 5;
const DEFAULT_CONVERSATION_STEPS = 9;

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
    conversation: {
        completedSteps: 0,
        totalSteps: DEFAULT_CONVERSATION_STEPS,
        completed: false
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

const getInitial = name => {
    if (!name) return "A";
    return name.trim().charAt(0).toUpperCase();
};

const getPlanName = plan => {
    if (plan === "listeningonly") return "純聽力方案";
    if (plan === "allcover") return "全方位方案";
    return "一般方案";
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

const normalizeConversation = result => {
    const progress = result?.progress || {};
    const totalSteps = Number(progress.total_steps) || DEFAULT_CONVERSATION_STEPS;
    const completedSteps = progress.completed
        ? totalSteps
        : Math.min(totalSteps, Number(progress.completed_steps) || 0);

    return {
        completedSteps,
        totalSteps,
        completed: Boolean(progress.completed)
    };
};

const User = () => {
    const { firebaseUser, studentProfile: user, authLoading } = useAuth();
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

        const requests = await Promise.allSettled([
            getDashboardStats(firebaseUser),
            getStudentAssignments(firebaseUser),
            getReviewDashboard(firebaseUser),
            getAiMaterialUsage(firebaseUser),
            getConversationProgress(firebaseUser),
            getAccessibleCatalog(firebaseUser)
        ]);

        const [listeningResult, assignmentResult, reviewResult, aiResult, conversationResult, bookResult] = requests;
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

            if (conversationResult.status === "fulfilled") {
                next.conversation = normalizeConversation(conversationResult.value);
            }

            if (bookResult.status === "fulfilled") {
                const firstUnlockedBook = (bookResult.value?.categories || [])
                    .flatMap(category => category.books || [])
                    .find(book => !book.locked);
                next.firstBookPath = firstUnlockedBook?.code
                    ? `/student/books/${firstUnlockedBook.code}`
                    : "/student/level";
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

    const dailyTasks = useMemo(() => {
        const tasks = [];

        if (homeData.assignments.total > 0) {
            tasks.push({
                id: "assignment",
                title: "完成今日作業",
                description: homeData.assignments.pending > 0
                    ? `還有 ${homeData.assignments.pending} 項老師指定的任務`
                    : `今天的 ${homeData.assignments.total} 項作業都完成了`,
                meta: `${homeData.assignments.completed} / ${homeData.assignments.total}`,
                completed: homeData.assignments.pending === 0,
                icon: FiBookOpen,
                path: "/student/assignments",
                action: homeData.assignments.pending > 0 ? "開始作業" : "再次複習",
                tone: "blue"
            });
        }

        if (homeData.review.total > 0) {
            tasks.push({
                id: "review",
                title: "智慧錯題複習",
                description: homeData.review.due > 0
                    ? `今天有 ${homeData.review.due} 題需要重新想一次`
                    : `今天已完成，累計掌握 ${homeData.review.mastered} 題`,
                meta: homeData.review.due > 0
                    ? `${homeData.review.due} 題待複習`
                    : "今日完成",
                completed: homeData.review.due === 0,
                icon: FiRefreshCw,
                path: "/student/review",
                action: homeData.review.due > 0 ? "開始複習" : "查看進度",
                tone: "review"
            });
        }

        tasks.push({
            id: "listening",
            title: "聽力暖身",
            description: homeData.listening.dailyCount >= DAILY_LISTENING_GOAL
                ? "今天的聽力目標已經達成"
                : `再聽 ${Math.max(0, DAILY_LISTENING_GOAL - homeData.listening.dailyCount)} 次，完成今日暖身`,
            meta: `${Math.min(homeData.listening.dailyCount, DAILY_LISTENING_GOAL)} / ${DAILY_LISTENING_GOAL}`,
            completed: homeData.listening.dailyCount >= DAILY_LISTENING_GOAL,
            icon: FiHeadphones,
            path: homeData.firstBookPath || "/student/assignments",
            action: homeData.listening.dailyCount >= DAILY_LISTENING_GOAL ? "繼續聆聽" : "開始聆聽",
            tone: "orange"
        });

        tasks.push({
            id: "ai",
            title: "AI 專屬練習",
            description: homeData.ai.used > 0
                ? `今天已建立 ${homeData.ai.used} 份練習，既有教材可免費複習`
                : "依照你的程度，建立一份今天想加強的教材",
            meta: `${homeData.ai.remaining} 次可用`,
            completed: homeData.ai.used > 0,
            icon: FiStar,
            path: "/student/ai-generator",
            action: homeData.ai.used > 0 ? "前往教材庫" : "開始練習",
            tone: "purple"
        });

        if (!homeData.conversation.completed) {
            tasks.push({
                id: "conversation",
                title: "情境口說任務",
                description: homeData.conversation.completedSteps > 0
                    ? "從上次進度繼續，練習遇到外國人的英文反應"
                    : "用名字、年級、家庭與問路完成真實對話",
                meta: `${homeData.conversation.completedSteps} / ${homeData.conversation.totalSteps}`,
                completed: false,
                icon: FiMessageCircle,
                path: "/student/conversation",
                action: homeData.conversation.completedSteps > 0 ? "繼續任務" : "開始口說",
                tone: "green"
            });
        }

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
            path: "/student/ai-generator",
            label: "自由複習"
        };
    }, [dailyTasks]);

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
                        <h1>{user.name || "同學"}，今天先完成這些！</h1>
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
                        </div>
                        <div className="student-home__completion-chip">
                            <FiCheck /> {completedTaskCount} / {dailyTasks.length} 完成
                        </div>
                    </div>

                    {homeData.assignments.total === 0 && (
                        <div className="student-home__no-homework">
                            <FiClock />
                            <span><strong>今天沒有老師指定的新作業</strong>，可以完成聽力、AI 與口說自主練習。</span>
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
                                            <span>{task.meta}</span>
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

                <section className="student-home__overview">
                    <div className="student-home__overview-heading">
                        <div>
                            <span>YOUR PROGRESS</span>
                            <h2>你的學習累積</h2>
                        </div>
                        <FiTrendingUp />
                    </div>

                    <div className="student-home__stats">
                        <article>
                            <div className="student-home__stat-icon student-home__stat-icon--today"><FiZap /></div>
                            <span>今日聽力</span>
                            <strong>{formatNumber(homeData.listening.dailyCount)}</strong>
                            <small>次播放</small>
                        </article>
                        <article>
                            <div className="student-home__stat-icon student-home__stat-icon--month"><FiHeadphones /></div>
                            <span>本月聽力</span>
                            <strong>{formatNumber(homeData.listening.monthlyCount)}</strong>
                            <small>次播放</small>
                        </article>
                        <article>
                            <div className="student-home__stat-icon student-home__stat-icon--total"><FiTrendingUp /></div>
                            <span>累計聽力</span>
                            <strong>{formatNumber(homeData.listening.totalCount)}</strong>
                            <small>次播放</small>
                        </article>
                        <article>
                            <div className="student-home__stat-icon student-home__stat-icon--speaking"><FiMessageCircle /></div>
                            <span>口說任務</span>
                            <strong>{homeData.conversation.completedSteps}</strong>
                            <small>/ {homeData.conversation.totalSteps} 關</small>
                        </article>
                    </div>
                </section>

                <Link to="/student/weekly-report" className="student-home__weekly-report">
                    <div className="student-home__weekly-report-icon"><FiBarChart2 /></div>
                    <div>
                        <span>WEEKLY GROWTH REPORT</span>
                        <strong>看看這週累積了多少英文實力</strong>
                        <p>聽力、作業、AI、複習與口說，一次整理成家長也看得懂的成果。</p>
                    </div>
                    <div className="student-home__weekly-report-action">查看週報 <FiArrowRight /></div>
                </Link>

                <section className="student-home__account">
                    <div className="student-home__identity">
                        <div className="student-home__avatar">{getInitial(user.name)}</div>
                        <div>
                            <span>MY ACCOUNT</span>
                            <strong>{user.name || "Alan English 學生"}</strong>
                            <small>{user.email || "—"}</small>
                        </div>
                    </div>
                    <div className="student-home__account-tags">
                        {user.class && <span>{user.class} 班</span>}
                        <span>{getPlanName(user.plan)}</span>
                    </div>
                    <div className="student-home__logout"><Logout /></div>
                </section>

                <footer className="student-home__footer">© 2020–2026 Alan English Inc.</footer>
            </div>
        </div>
    );
};

export default User;
