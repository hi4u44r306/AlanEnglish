import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCheckSquare, FiChevronRight, FiHeadphones, FiMail, FiMic, FiPlay } from "react-icons/fi";
import { PiTrophyFill } from "react-icons/pi";
import { useAuth } from "../../auth/AuthContext";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { useStudentLearningHistory } from "../../hooks/useStudentLearningResume";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { getWeeklyReport } from "../../services/weeklyReportService";
import { roundFocusRate } from "../../utils/focusRate";
import { findResumeBook, learningResumePath, mergeLearningHistory } from "../../services/studentLearningResume";
import { getDashboardStats, getRecentListening } from "../../services/listeningService";
import { getLearningTasks, getStudentMaterialCategories } from "../../utils/studentLearning";
import { assignmentDisplayTitle, assignmentProgressLabel } from "../../utils/assignmentListening";
import forestScene from "../assets/speaking-map/unified-forest-a-v1.webp";

const formatDay = value => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).format(new Date(value));
const taskPath = task => `/student/assignments?task=${encodeURIComponent(task.taskKey)}`;
const SECTION_ORDER = { preparation: 0, textbook: 1, topic: 2 };
// 關卡在地圖上的名字：有頁碼就寫頁碼（P.11、P.18～20），沒有就用關卡標題。
const levelLabel = item => {
    const pages = (item.source_pages || []).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
    if (!pages.length) return String(item.title || "").trim().replace(/^\d{1,2}\s+/, "");
    return pages.length > 1 ? `P.${pages[0]}～${pages[pages.length - 1]}` : `P.${pages[0]}`;
};
const Tile = ({ tone, children }) => <span className={`student-progress__tile student-progress__tile--${tone}`} aria-hidden="true">{children}</span>;

// 一張進度卡：標題、一個大數字、一條進度條（有才顯示）、兩小行說明。整張都可以點。
function ProgressCard({ to, onClick, tone, icon, title, big, max = 0, value = 0, barLabel, left, right, alert = false }) {
    const body = <>
        <span className="student-progress__card-head"><Tile tone={tone}>{icon}</Tile><strong>{title}</strong><FiChevronRight aria-hidden="true" /></span>
        <span className="student-progress__card-big">{big}</span>
        {max > 0 && <progress max={max} value={value} aria-label={barLabel} />}
        {(left || right) && <span className="student-progress__card-sub"><span>{left}</span><span className={alert ? "is-alert" : ""}>{right}</span></span>}
    </>;
    return to ? <Link className="student-progress__card" to={to}>{body}</Link> : <button type="button" className="student-progress__card" onClick={onClick}>{body}</button>;
}

// The page answers one question first: "what do I do next?" — the assignment, then the track
// the student stopped at, then a short list of everything else.
function StudentProgressOverview() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const membership = studentProfile?.membership;
    const active = role === "student" && membership?.is_active === true;
    const features = membership?.effective_access?.features || {};
    const assignmentAccess = active && features.assignments === true;
    const speakingAccess = active && features.pronunciation === true;
    const history = useStudentLearningHistory();
    const catalogQuery = useStudentPageQuery("catalog", () => getAccessibleCatalog(firebaseUser), { enabled: active });
    const recentListeningQuery = useStudentPageQuery("listening:recent", () => getRecentListening(firebaseUser), { enabled: active });
    const assignmentsQuery = useStudentPageQuery("assignments:v1", () => getStudentAssignments(firebaseUser), { enabled: assignmentAccess });
    const assignmentsV2Query = useStudentPageQuery("assignments:v2", () => getStudentAssignmentsV2(firebaseUser), { enabled: assignmentAccess });
    const speakingQuery = useStudentPageQuery("speaking:catalog", () => getSpeakingChallengeCatalog(firebaseUser), { enabled: speakingAccess });
    const statsQuery = useStudentPageQuery("listening:stats", () => getDashboardStats(firebaseUser), { enabled: active });
    const weeklyQuery = useStudentPageQuery(`weekly:${Math.floor((Date.now() + 8 * 3600000 + 3 * 86400000) / (7 * 86400000))}:self`, () => getWeeklyReport(firebaseUser, { weekOffset: 0 }), { enabled: active, persist: true });
    // 與每週報告頁共用同一份快取（同一週、自己）。
    const weeklyAttention = weeklyQuery.data?.report?.attention;
    const focusRate = weeklyAttention?.available ? roundFocusRate(weeklyAttention.focus_rate) : null;

    // Saved bookmarks only become links for books the catalog still authorizes.
    const listening = useMemo(() => {
        const books = getStudentMaterialCategories(catalogQuery.data?.categories).flatMap(category => category.books);
        // 本機書籤加上伺服器記得的「最近完整聽過」，登出或換裝置後也找得到。
        const merged = mergeLearningHistory(history, recentListeningQuery.data?.recent);
        return merged.map(bookmark => ({ bookmark, book: findResumeBook(bookmark, books) })).filter(item => item.book);
    }, [history, catalogQuery.data, recentListeningQuery.data]);

    const speaking = useMemo(() => {
        const groups = new Map();
        (speakingQuery.data?.challenges || []).forEach(item => {
            const book = item.book || item.books || {};
            const key = String(book.id || book.code || book.name || "other");
            const group = groups.get(key) || { key, name: book.name || "其他教材", total: 0, completed: 0, items: [] };
            group.total += 1;
            if (item.is_completed === true) group.completed += 1;
            group.items.push(item);
            groups.set(key, group);
        });
        // 「下一關」和地圖一樣的順序：入門準備 → 教材 → 主題，同一段依關卡順序。
        return [...groups.values()].map(group => ({
            ...group,
            next: [...group.items].sort((a, b) => (SECTION_ORDER[a.catalog_section] ?? 1) - (SECTION_ORDER[b.catalog_section] ?? 1)
                || Number(a.sequence_order || 0) - Number(b.sequence_order || 0) || Number(a.id) - Number(b.id)).find(item => item.is_completed !== true) || null
        }));
    }, [speakingQuery.data]);

    const allTasks = getLearningTasks(assignmentsQuery.data?.assignments, assignmentsV2Query.data?.assignments);
    const tasks = allTasks.filter(task => task.state !== "completed");
    const doneTasks = allTasks.length - tasks.length;
    const nextTask = tasks[0];
    const tasksLoading = assignmentsQuery.loading || assignmentsV2Query.loading;
    const taskError = assignmentsQuery.error || assignmentsV2Query.error;
    const refreshTasks = () => { assignmentsQuery.refresh(); assignmentsV2Query.refresh(); };
    const openMaterials = () => window.dispatchEvent(new CustomEvent("ae:open-student-menu", { detail: "materials" }));

    if (!active) return null;

    const resume = listening[0];
    const where = item => item.bookmark.page || item.bookmark.trackTitle || "教材音檔";
    // 口說卡只放一本：先放做到一半的，其次是還沒做完的第一本。
    const speakingBook = speaking.find(group => group.completed > 0 && group.completed < group.total)
        || speaking.find(group => group.completed < group.total) || speaking[0];
    const totalListens = Number.isFinite(Number(statsQuery.data?.total_count)) ? Number(statsQuery.data.total_count) : null;
    const nextDue = nextTask && Number.isFinite(Date.parse(nextTask.due_at)) ? `${formatDay(nextTask.due_at)} 到期` : "";
    const overdueTasks = tasks.filter(task => task.state === "overdue").length;

    return <section className="student-progress" aria-label="學習進度">
        {nextTask ? <Link className={`student-progress__next${nextTask.state === "overdue" ? " is-overdue" : ""}`} to={taskPath(nextTask)}>
            <img className="student-progress__scene" src={forestScene} alt="" />
            <span className="student-progress__next-label">{nextTask.state === "overdue" ? "作業遲交" : "接下來：作業"}</span>
            <strong>{assignmentDisplayTitle(nextTask.title)}</strong>
            <span className="student-progress__next-meta">{nextTask.state === "overdue" ? "請向老師確認補做方式" : Number.isFinite(Date.parse(nextTask.due_at)) ? `${formatDay(nextTask.due_at)} 截止` : "老師的作業"} · {assignmentProgressLabel(nextTask)}</span>
            <span className="student-progress__next-action"><b>打開作業</b><FiArrowRight aria-hidden="true" /></span>
        </Link> : resume ? null : <button type="button" className="student-progress__next" onClick={openMaterials}>
            <img className="student-progress__scene" src={forestScene} alt="" />
            <span className="student-progress__next-label">接下來</span>
            <strong>選一本教材開始</strong>
            <span className="student-progress__next-meta">{catalogQuery.loading ? "正在讀取教材…" : "點這裡打開教材"}</span>
            <span className="student-progress__next-action"><b>打開教材</b><FiArrowRight aria-hidden="true" /></span>
        </button>}
        {resume && <Link className="student-progress__listen" to={learningResumePath(resume.book, resume.bookmark)} aria-label={`接著聽 ${resume.book.name} ${where(resume)}`}>
            <span className="student-progress__listen-label">接著聽</span>
            <strong>{where(resume)}</strong>
            <span className="student-progress__listen-book">{resume.book.name}</span>
            <span className="student-progress__listen-play" aria-hidden="true"><FiPlay /></span>
        </Link>}
        {taskError && <p className="student-progress__notice" role="status">部分作業未能讀取，這裡可能不完整。<button type="button" onClick={refreshTasks}>重新讀取</button></p>}

        <div className="student-progress__cards">
            {assignmentAccess && <ProgressCard to="/student/assignments" tone="blue" icon={<FiCheckSquare />} title="作業"
                big={tasksLoading && !allTasks.length ? "讀取中" : taskError && !allTasks.length ? "無法讀取" : tasks.length ? `進行中 ${tasks.length} 份` : allTasks.length ? "都完成了" : "目前沒有作業"}
                max={allTasks.length} value={doneTasks} barLabel="作業完成進度"
                left={allTasks.length ? `已完成 ${doneTasks} / ${allTasks.length}` : ""}
                right={overdueTasks ? `${overdueTasks} 份遲交` : nextDue} alert={overdueTasks > 0} />}
            {speakingAccess && <ProgressCard to={speakingBook ? `/student/speaking-challenges/book/${encodeURIComponent(`book-${speakingBook.key}`)}` : "/student/speaking-challenges"} tone="orange" icon={<FiMic />} title="口說大挑戰"
                big={speakingBook ? `${speakingBook.completed} / ${speakingBook.total} 關` : speakingQuery.loading ? "讀取中" : speakingQuery.error ? "無法讀取" : "還沒開始"}
                max={speakingBook?.total || 0} value={speakingBook?.completed || 0} barLabel={`${speakingBook?.name || ""} 口說進度`}
                left={speakingBook?.name} right={speakingBook ? (speakingBook.next ? `下一關：${levelLabel(speakingBook.next)}` : "全部完成") : ""} />}
            <ProgressCard {...(resume ? { to: learningResumePath(resume.book, resume.bookmark) } : { onClick: openMaterials })} tone="green" icon={<FiHeadphones />} title="聽力"
                big={totalListens !== null ? `累計聽了 ${totalListens.toLocaleString("zh-TW")} 次` : statsQuery.loading ? "讀取中" : statsQuery.error ? "無法讀取" : "—"}
                left="聽滿 80% 才算一次" />
        </div>
        <div className="student-progress__links">
            <Link to="/student/weekly-report"><FiMail aria-hidden="true" />每週報告{focusRate !== null && <small>本週專注度 {focusRate}%</small>}</Link>
            <Link to="/student/leaderboard"><PiTrophyFill aria-hidden="true" />排行榜</Link>
        </div>
    </section>;
}

export default StudentProgressOverview;
