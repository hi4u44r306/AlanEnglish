import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCompass } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { loadStudentCommerceDisplay, STUDENT_COMMERCE_DISPLAY_KEY } from "../../services/studentCommerceDisplay";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";
import useStudentLearningResume from "../../hooks/useStudentLearningResume";
import { findResumeBook, learningResumePath } from "../../services/studentLearningResume";
import { getCurrentClassMaterials, getLearningTasks, getStudentMaterialCategories } from "../../utils/studentLearning";
import { assignmentProgressLabel } from "../../utils/assignmentListening";
import forestScene from "../assets/speaking-map/unified-forest-a-v1.webp";
import "./css/StudentLearningHome.scss";

const bookPath = book => book.path || `/student/books/${encodeURIComponent(book.code)}`;
const taskPath = task => `/student/assignments?task=${encodeURIComponent(task.taskKey)}`;
const formatDeadline = value => Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).format(new Date(value))
    : "";

function StudentLearningHome() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const membership = studentProfile?.membership;
    const active = role === "student" && membership?.is_active === true;
    const assignmentAccess = active && membership?.effective_access?.features?.assignments === true;
    const academyStudent = active && studentProfile?.learner_type === "academy_student";
    const learningResume = useStudentLearningResume();
    const classQuery = useStudentPageQuery(STUDENT_COMMERCE_DISPLAY_KEY, () => loadStudentCommerceDisplay(firebaseUser), { enabled: academyStudent });
    const catalogQuery = useStudentPageQuery("catalog", () => getAccessibleCatalog(firebaseUser), { enabled: active });
    const assignmentsQuery = useStudentPageQuery("assignments:v1", () => getStudentAssignments(firebaseUser), { enabled: assignmentAccess });
    const assignmentsV2Query = useStudentPageQuery("assignments:v2", () => getStudentAssignmentsV2(firebaseUser), { enabled: assignmentAccess });
    const [categoryId, setCategoryId] = useState("all");

    const catalogError = catalogQuery.error && !catalogQuery.data;
    const taskError = assignmentAccess && (assignmentsQuery.error || assignmentsV2Query.error);
    const loading = catalogQuery.loading;
    const categories = useMemo(() => getStudentMaterialCategories(catalogQuery.data?.categories), [catalogQuery.data]);
    const currentClassBooks = getCurrentClassMaterials(classQuery.data, catalogQuery.data?.categories);
    const books = categories.flatMap(category => category.books.map(book => ({ ...book, categoryId: String(category.id), categoryName: category.name })));
    const selectedCategory = categories.some(category => String(category.id) === categoryId) ? categoryId : "all";
    const visibleBooks = books.filter(book => selectedCategory === "all" || book.categoryId === selectedCategory);
    const tasks = getLearningTasks(assignmentsQuery.data?.assignments, assignmentsV2Query.data?.assignments);
    const pendingTasks = tasks.filter(task => task.state === "pending");
    const overdueTasks = tasks.filter(task => task.state === "overdue");
    // The mission card is the only place assignments appear here; the full list lives on the assignments page.
    const nextTask = pendingTasks[0] || overdueTasks[0];
    const otherTaskCount = pendingTasks.length + overdueTasks.length - 1;
    const resumeBook = findResumeBook(learningResume, academyStudent ? currentClassBooks : books);
    const heroBook = resumeBook || (academyStudent ? currentClassBooks.find(book => book.canOpen) : books[0]);
    const heroTitle = nextTask ? nextTask.title : resumeBook ? `繼續學習 ${resumeBook.name}` : heroBook && academyStudent ? `一起學習 ${heroBook.name}` : "今天，從一本教材開始";
    const heroPath = nextTask ? taskPath(nextTask) : resumeBook ? learningResumePath(resumeBook, learningResume) : heroBook ? bookPath(heroBook) : null;
    const classNotice = !academyStudent ? null : classQuery.error
        ? classQuery.data ? "目前顯示上次班級教材，暫時無法更新，請稍後再試。" : "班級教材暫時無法讀取，請稍後再試。"
        : nextTask ? null : classQuery.loading ? "正在讀取目前班級教材…"
        : !currentClassBooks.length ? classQuery.data?.current_enrollment?.status === "active"
            ? "班級目前尚未設定學習教材，請老師確認。" : "目前沒有有效在校班級；已取得的教材仍可從下方書架開啟。"
        : !heroBook && !loading ? "目前班級教材無法開啟，請老師確認。" : null;
    const refresh = () => [catalogQuery, assignmentsQuery, assignmentsV2Query, classQuery].forEach(query => query.refresh());

    if (!active) return <main className="learning-home"><h1>教材</h1><p>先確認目前可使用的教材與功能。</p><Link className="learning-home__secondary" to="/student/membership">查看會員與功能</Link></main>;

    return <main className="learning-home">
        <div className="learning-home__shell">
            <h1 className="learning-home__title">教材</h1>
            {[catalogQuery, assignmentsQuery, assignmentsV2Query].some(query => query.error && query.data) && <p role="status">目前顯示上次資料，最新進度暫時無法同步，請稍後再試。</p>}

            <section className="learning-home__mission" aria-labelledby="today-goal">
                <img className="learning-home__scene" src={forestScene} alt="" fetchpriority="high" />
                <div className="learning-home__mission-copy">
                    <span className="learning-home__tag"><FiCompass aria-hidden="true" />{nextTask ? "老師的任務" : "我的學習旅程"}</span>
                    <h2 id="today-goal">{loading ? "正在準備你的學習…" : heroTitle}</h2>
                    {nextTask && <p>{nextTask.state === "overdue" ? "已逾期，請向老師確認補做方式" : formatDeadline(nextTask.due_at) ? `${formatDeadline(nextTask.due_at)} 截止` : "老師的作業"} · {assignmentProgressLabel(nextTask)}</p>}
                    {!loading && heroPath && <Link className="learning-home__primary" to={heroPath}>{nextTask ? nextTask.state === "overdue" ? "查看作業與補做方式" : "打開這份任務" : resumeBook ? `繼續 ${heroBook.name}${learningResume.page ? ` · ${learningResume.page}` : ""}` : `打開 ${heroBook.name}`}<FiArrowRight aria-hidden="true" /></Link>}
                    {!nextTask && resumeBook && <small>上次音檔：{learningResume.trackTitle || learningResume.page || "教材音檔"}；點開後按播放開始。</small>}
                    {!loading && !heroPath && <a className="learning-home__primary" href="#learning-books">{catalogError ? "查看教材讀取狀態" : "查看我的教材"}<FiArrowRight aria-hidden="true" /></a>}
                    {classNotice && <small role="status">{classNotice}</small>}
                    {nextTask && otherTaskCount > 0 && <small>另外還有 {otherTaskCount} 份作業。<Link to="/student/assignments">查看全部作業</Link></small>}
                    {taskError && <small role="status">部分作業未能讀取。<button type="button" onClick={refresh}>重新讀取</button></small>}
                </div>
            </section>

            <section className="learning-home__books" id="learning-books" aria-labelledby="home-books-heading">
                <h2 id="home-books-heading">我的教材小書架</h2>
                {loading ? <p role="status">正在讀取可使用的教材…</p> : catalogError ? <div className="learning-home__notice" role="status">教材暫時無法讀取，請再試一次。<button type="button" onClick={refresh}>重新讀取教材</button></div> : <>
                    {categories.length > 1 && <div className="learning-home__filters" role="group" aria-label="教材分類"><button type="button" aria-pressed={selectedCategory === "all"} onClick={() => setCategoryId("all")}>全部教材</button>{categories.map(category => <button type="button" key={category.id} aria-pressed={selectedCategory === String(category.id)} onClick={() => setCategoryId(String(category.id))}>{category.name}</button>)}</div>}
                    <div className="learning-home__book-grid">{visibleBooks.map(book => <Link className="learning-home__book" to={bookPath(book)} key={`${book.categoryId}-${book.id || book.code}`}>{book.name}</Link>)}</div>
                    {!books.length && <div className="learning-home__empty"><p>目前沒有可顯示的教材。</p><Link to="/student/membership">查看教材與功能權限</Link></div>}
                </>}
            </section>
        </div>
    </main>;
}

export default StudentLearningHome;
