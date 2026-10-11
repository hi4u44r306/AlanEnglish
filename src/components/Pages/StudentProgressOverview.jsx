import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCheckSquare, FiChevronRight, FiMail, FiMic, FiPlay } from "react-icons/fi";
import { PiTrophyFill } from "react-icons/pi";
import { useAuth } from "../../auth/AuthContext";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { useStudentLearningHistory } from "../../hooks/useStudentLearningResume";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { findResumeBook, learningResumePath } from "../../services/studentLearningResume";
import { getLearningTasks, getStudentMaterialCategories } from "../../utils/studentLearning";
import { assignmentProgressLabel } from "../../utils/assignmentListening";
import forestScene from "../assets/speaking-map/unified-forest-a-v1.webp";

const formatDay = value => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).format(new Date(value));
const taskPath = task => `/student/assignments?task=${encodeURIComponent(task.taskKey)}`;
const MAX_ROWS = 3;
const Tile = ({ tone, children }) => <span className={`student-progress__tile student-progress__tile--${tone}`} aria-hidden="true">{children}</span>;

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
    const assignmentsQuery = useStudentPageQuery("assignments:v1", () => getStudentAssignments(firebaseUser), { enabled: assignmentAccess });
    const assignmentsV2Query = useStudentPageQuery("assignments:v2", () => getStudentAssignmentsV2(firebaseUser), { enabled: assignmentAccess });
    const speakingQuery = useStudentPageQuery("speaking:catalog", () => getSpeakingChallengeCatalog(firebaseUser), { enabled: speakingAccess });

    // Saved bookmarks only become links for books the catalog still authorizes.
    const listening = useMemo(() => {
        const books = getStudentMaterialCategories(catalogQuery.data?.categories).flatMap(category => category.books);
        return history.map(bookmark => ({ bookmark, book: findResumeBook(bookmark, books) })).filter(item => item.book);
    }, [history, catalogQuery.data]);

    const speaking = useMemo(() => {
        const groups = new Map();
        (speakingQuery.data?.challenges || []).forEach(item => {
            const book = item.book || item.books || {};
            const key = String(book.id || book.code || book.name || "other");
            const group = groups.get(key) || { key, name: book.name || "其他教材", total: 0, completed: 0 };
            group.total += 1;
            if (item.is_completed === true) group.completed += 1;
            groups.set(key, group);
        });
        return [...groups.values()];
    }, [speakingQuery.data]);

    const tasks = getLearningTasks(assignmentsQuery.data?.assignments, assignmentsV2Query.data?.assignments).filter(task => task.state !== "completed");
    const nextTask = tasks[0];
    const tasksLoading = assignmentsQuery.loading || assignmentsV2Query.loading;
    const taskError = assignmentsQuery.error || assignmentsV2Query.error;
    const refreshTasks = () => { assignmentsQuery.refresh(); assignmentsV2Query.refresh(); };
    const openMaterials = () => window.dispatchEvent(new CustomEvent("ae:open-student-menu", { detail: "materials" }));

    if (!active) return null;

    const resume = listening[0];
    const where = item => item.bookmark.page || item.bookmark.trackTitle || "教材音檔";
    // Books in progress come first; untouched books would only add noise.
    const speakingStarted = speaking.filter(group => group.completed > 0 && group.completed < group.total);
    // The top card already is the first assignment, so a row is only worth showing for the rest.
    const otherTasks = Math.max(0, tasks.length - 1);

    return <section className="student-progress" aria-label="學習進度">
        {nextTask ? <Link className={`student-progress__next${nextTask.state === "overdue" ? " is-overdue" : ""}`} to={taskPath(nextTask)}>
            <img className="student-progress__scene" src={forestScene} alt="" />
            <span className="student-progress__next-label">{nextTask.state === "overdue" ? "作業已逾期" : "接下來：作業"}</span>
            <strong>{nextTask.title}</strong>
            <span className="student-progress__next-meta">{nextTask.state === "overdue" ? "請向老師確認補做方式" : Number.isFinite(Date.parse(nextTask.due_at)) ? `${formatDay(nextTask.due_at)} 截止` : "老師的作業"} · {assignmentProgressLabel(nextTask)}</span>
            <span className="student-progress__next-action">打開作業<FiArrowRight aria-hidden="true" /></span>
        </Link> : resume ? null : <button type="button" className="student-progress__next" onClick={openMaterials}>
            <img className="student-progress__scene" src={forestScene} alt="" />
            <span className="student-progress__next-label">接下來</span>
            <strong>選一本教材開始</strong>
            <span className="student-progress__next-meta">{catalogQuery.loading ? "正在讀取教材…" : "點這裡打開教材"}</span>
            <span className="student-progress__next-action">打開教材<FiArrowRight aria-hidden="true" /></span>
        </button>}
        {resume && <Link className="student-progress__listen" to={learningResumePath(resume.book, resume.bookmark)} aria-label={`接著聽 ${resume.book.name} ${where(resume)}`}>
            <span className="student-progress__listen-label">接著聽</span>
            <strong>{where(resume)}</strong>
            <span className="student-progress__listen-book">{resume.book.name}</span>
            <span className="student-progress__listen-play" aria-hidden="true"><FiPlay /></span>
        </Link>}
        {taskError && <p className="student-progress__notice" role="status">部分作業未能讀取，這裡可能不完整。<button type="button" onClick={refreshTasks}>重新讀取</button></p>}

        <div className="student-settings-list student-progress__list">
            {assignmentAccess && tasks.length !== 1 && <Link className="student-settings-row" to="/student/assignments">
                <Tile tone="blue"><FiCheckSquare /></Tile><div><strong>作業</strong></div>
                <span className="student-progress__value">{tasksLoading && !tasks.length ? "讀取中" : taskError && !tasks.length ? "無法讀取" : otherTasks ? `還有 ${otherTasks} 份` : "都完成了"}</span>
                <FiChevronRight aria-hidden="true" />
            </Link>}
            {speakingAccess && (speakingStarted.length ? speakingStarted.slice(0, MAX_ROWS).map(group => <Link className="student-settings-row" to="/student/speaking-challenges" key={group.key}>
                <Tile tone="orange"><FiMic /></Tile>
                <div><strong>{group.name}</strong><progress max={group.total} value={group.completed} aria-label={`${group.name} 口說進度`} /></div>
                <span className="student-progress__value">{group.completed} / {group.total} 關</span>
                <FiChevronRight aria-hidden="true" />
            </Link>) : <Link className="student-settings-row" to="/student/speaking-challenges">
                <Tile tone="orange"><FiMic /></Tile><div><strong>口說大挑戰</strong></div>
                <span className="student-progress__value">{speakingQuery.loading ? "讀取中" : speakingQuery.error ? "無法讀取" : speaking.some(group => group.completed > 0) ? "全部完成" : "還沒開始"}</span>
                <FiChevronRight aria-hidden="true" />
            </Link>)}
            <Link className="student-settings-row" to="/student/weekly-report"><Tile tone="green"><FiMail /></Tile><div><strong>每週報告</strong></div><FiChevronRight aria-hidden="true" /></Link>
            <Link className="student-settings-row" to="/student/leaderboard"><Tile tone="yellow"><PiTrophyFill /></Tile><div><strong>排行榜</strong></div><FiChevronRight aria-hidden="true" /></Link>
        </div>
    </section>;
}

export default StudentProgressOverview;
