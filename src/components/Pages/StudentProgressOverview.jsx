import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { useStudentLearningHistory } from "../../hooks/useStudentLearningResume";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { findResumeBook, learningResumePath } from "../../services/studentLearningResume";
import { getLearningTasks, getStudentMaterialCategories } from "../../utils/studentLearning";
import { assignmentProgressLabel } from "../../utils/assignmentListening";

const formatDay = value => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).format(new Date(value));

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

    return <section className="student-progress" aria-label="學習進度">
        {assignmentAccess && <article className="student-progress__block" aria-labelledby="progress-assignments">
            <h2 id="progress-assignments">作業</h2>
            {nextTask ? <div className="student-progress__list">
                <Link className="student-progress__item is-task" to={`/student/assignments?task=${encodeURIComponent(nextTask.taskKey)}`}>
                    <strong>{nextTask.title}</strong>
                    <span>{nextTask.state === "overdue" ? "已逾期，請向老師確認補做方式" : Number.isFinite(Date.parse(nextTask.due_at)) ? `${formatDay(nextTask.due_at)} 截止` : "老師的作業"} · {assignmentProgressLabel(nextTask)}</span>
                </Link>
                {tasks.length > 1 && <Link className="student-progress__item" to="/student/assignments"><strong>還有 {tasks.length - 1} 份作業</strong><span>查看全部作業</span></Link>}
            </div> : <p role="status">{tasksLoading ? "正在讀取作業…" : taskError ? "作業暫時無法讀取。" : <>目前沒有待完成的作業。<Link to="/student/assignments">查看作業紀錄</Link></>}</p>}
            {taskError && <p role="status">部分作業未能讀取，這裡可能不完整。<button type="button" onClick={refreshTasks}>重新讀取</button></p>}
        </article>}

        <article className="student-progress__block" aria-labelledby="progress-listening">
            <h2 id="progress-listening">聽力：上次聽到這裡</h2>
            {listening.length ? <div className="student-progress__list">
                {listening.map(({ bookmark, book }) => <Link className="student-progress__item" to={learningResumePath(book, bookmark)} key={bookmark.bookId}>
                    <strong>{book.name}</strong>
                    <span>{bookmark.trackTitle || bookmark.page || "教材音檔"} · {formatDay(bookmark.savedAt)}</span>
                </Link>)}
            </div> : <p>{catalogQuery.loading ? "正在讀取教材…" : <>這台裝置還沒有聽力紀錄。<button type="button" onClick={openMaterials}>去選一本教材</button></>}</p>}
        </article>

        {speakingAccess && <article className="student-progress__block" aria-labelledby="progress-speaking">
            <h2 id="progress-speaking">口說大挑戰</h2>
            {speaking.length ? <div className="student-progress__list">
                {speaking.map(group => <Link className="student-progress__item" to="/student/speaking-challenges" key={group.key}>
                    <strong>{group.name}</strong>
                    <span>已完成 {group.completed} / {group.total} 關</span>
                    <progress max={group.total} value={group.completed} aria-label={`${group.name} 口說進度`} />
                </Link>)}
            </div> : <p role="status">{speakingQuery.loading ? "正在讀取口說進度…" : speakingQuery.error ? "口說進度暫時無法讀取。" : "還沒有可挑戰的關卡。"}</p>}
        </article>}

        <nav className="student-progress__links" aria-label="學習紀錄">
            <Link to="/student/weekly-report">每週報告</Link>
            <Link to="/student/leaderboard">排行榜</Link>
        </nav>
    </section>;
}

export default StudentProgressOverview;
