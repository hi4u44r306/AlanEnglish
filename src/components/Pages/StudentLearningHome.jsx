import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiCompass, FiHeadphones, FiRefreshCw, FiSearch, FiStar, FiTrendingUp } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentAssignments, getStudentAssignmentsV2 } from "../../services/assignmentService";
import { getStudentAvatarDisplayUrl } from "../../constants/defaultStudentAvatars";
import StudentAvatarImage from "../fragment/StudentAvatarImage";
import { assignmentStateLabel, getLearningTasks, getStudentMaterialCategories } from "../../utils/studentLearning";
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
    const speakingAccess = active && membership?.effective_access?.features?.pronunciation === true;
    const owner = `${firebaseUser?.uid || ""}:${active}:${assignmentAccess}`;
    const [snapshot, setSnapshot] = useState(null);
    const [revision, setRevision] = useState(0);
    const [categoryId, setCategoryId] = useState("all");
    const [search, setSearch] = useState("");
    const [taskFilter, setTaskFilter] = useState("pending");

    useEffect(() => {
        if (!firebaseUser || !active) return undefined;
        let cancelled = false;
        setSnapshot(null);
        const requests = [getAccessibleCatalog(firebaseUser), getGamificationSummary(firebaseUser)];
        if (assignmentAccess) requests.push(getStudentAssignments(firebaseUser), getStudentAssignmentsV2(firebaseUser));
        Promise.allSettled(requests).then(results => {
            if (cancelled) return;
            const value = index => results[index]?.status === "fulfilled" ? results[index].value : null;
            setSnapshot({
                owner,
                categories: value(0)?.categories || [],
                summary: value(1),
                tasks: getLearningTasks(value(2)?.assignments, value(3)?.assignments),
                catalogError: results[0].status === "rejected",
                summaryError: results[1].status === "rejected",
                taskError: assignmentAccess && results.slice(2).some(result => result.status === "rejected")
            });
        });
        return () => { cancelled = true; };
    }, [firebaseUser, active, assignmentAccess, owner, revision]);

    useEffect(() => {
        const refresh = () => setRevision(value => value + 1);
        window.addEventListener("ae:track-progress-updated", refresh);
        window.addEventListener("ae:gamification-updated", refresh);
        return () => {
            window.removeEventListener("ae:track-progress-updated", refresh);
            window.removeEventListener("ae:gamification-updated", refresh);
        };
    }, []);

    const data = snapshot?.owner === owner ? snapshot : null;
    const loading = active && !data;
    const categories = useMemo(() => getStudentMaterialCategories(data?.categories), [data]);
    const books = categories.flatMap(category => category.books.map(book => ({ ...book, categoryId: String(category.id), categoryName: category.name })));
    const selectedCategory = categories.some(category => String(category.id) === categoryId) ? categoryId : "all";
    const visibleBooks = books.filter(book => (selectedCategory === "all" || book.categoryId === selectedCategory)
        && `${book.name} ${book.code}`.toLowerCase().includes(search.trim().toLowerCase()));
    const tasks = data?.tasks || [];
    const nextTask = tasks.find(task => task.state === "pending");
    const filteredTasks = tasks.filter(task => task.state === taskFilter);
    const balance = data?.summary?.balance;
    const progress = Math.min(100, Math.max(0, Number(balance?.progress_percent) || 0));
    const name = studentProfile?.nickname || studentProfile?.name || "小小探險家";
    const avatar = getStudentAvatarDisplayUrl(data?.summary?.profile?.avatar_url || studentProfile?.avatar_url, 96);
    const heroTitle = nextTask ? nextTask.title : "今天，從一本教材開始";
    const heroPath = nextTask ? taskPath(nextTask) : books[0] ? bookPath(books[0]) : null;
    const refresh = () => setRevision(value => value + 1);

    if (!active) return <main className="learning-home"><h1>今日學習</h1><p>先確認目前可使用的教材與功能。</p><Link className="learning-home__secondary" to="/student/membership">查看會員與功能</Link></main>;

    return <main className="learning-home">
        <div className="learning-home__shell">
            <header className="learning-home__greeting">
                <div><span>歡迎回來，{name}</span><h1>今天，一起探索英文！</h1></div>
                <button className="learning-home__refresh" type="button" onClick={refresh} disabled={loading} aria-label="重新整理學習進度"><FiRefreshCw aria-hidden="true" /><span>{loading ? "讀取中" : "更新進度"}</span></button>
            </header>

            <div className="learning-home__overview">
                <section className="learning-home__mission" aria-labelledby="today-goal">
                    <img className="learning-home__scene" src={forestScene} alt="" fetchpriority="high" />
                    <div className="learning-home__mission-copy">
                        <span className="learning-home__tag"><FiCompass aria-hidden="true" />{nextTask ? "老師的任務" : "我的學習旅程"}</span>
                        <h2 id="today-goal">{loading ? "正在準備你的學習…" : heroTitle}</h2>
                        <p>{nextTask ? "從這份任務開始，一步一步完成老師的練習。" : "先聽一聽，再試著說出來。每次練習都向前一點。"}</p>
                        {!loading && heroPath && <Link className="learning-home__primary" to={heroPath}>{nextTask ? "打開這份任務" : `打開 ${books[0].name}`}<FiArrowRight aria-hidden="true" /></Link>}
                        {!loading && !heroPath && <a className="learning-home__primary" href="#learning-books">{data?.catalogError ? "查看教材讀取狀態" : "查看我的教材"}<FiArrowRight aria-hidden="true" /></a>}
                        {nextTask?.due_at && <small>{formatDeadline(nextTask.due_at)} 截止；詳細時間請看作業</small>}
                        {data?.taskError && <small role="status">部分作業未能讀取，請更新進度再確認。</small>}
                    </div>
                </section>

                <aside className="learning-home__growth" aria-label="我的成長">
                    <div className="learning-home__identity"><span className="learning-home__avatar">{avatar ? <StudentAvatarImage src={avatar} alt="我的角色" /> : <FiStar aria-hidden="true" />}</span><div><span>我的成長</span><strong>{balance ? `Lv.${balance.level}` : "學習中的每一步"}</strong></div></div>
                    {balance ? <><div className="learning-home__xp"><strong>{Number(balance.total_xp || 0).toLocaleString("zh-TW")} XP</strong><span>累積經驗</span></div><progress max="100" value={progress} aria-label="目前等級成長進度" /><p>{balance.next_level_xp != null ? `距離下一級還差 ${Math.max(0, balance.next_level_xp - Number(balance.total_xp || 0))} XP` : "繼續累積你的學習經驗"}</p></>
                        : <p role="status">{data?.summaryError ? "成長資料暫時無法讀取，你仍可以開始學習。" : "正在讀取成長資料…"}</p>}
                    <div className="learning-home__growth-links"><Link to="/student/settings">我的角色</Link><Link to="/student/leaderboard"><FiTrendingUp aria-hidden="true" />排行榜</Link></div>
                </aside>
            </div>

            <nav className="learning-home__paths" aria-label="選擇學習方式">
                <a href="#learning-books"><span className="learning-home__path-icon"><FiHeadphones /></span><span><strong>聽教材</strong><small>選一本，練習聽懂英文</small></span><FiArrowRight aria-hidden="true" /></a>
                {speakingAccess && <Link to="/student/speaking-challenges"><span className="learning-home__path-icon is-yellow"><FiCompass /></span><span><strong>口說冒險</strong><small>前往教材世界，查看關卡</small></span><FiArrowRight aria-hidden="true" /></Link>}
                <Link to="/student/weekly-report"><span className="learning-home__path-icon is-green"><FiTrendingUp /></span><span><strong>看看我的進步</strong><small>回顧這週學過的內容</small></span><FiArrowRight aria-hidden="true" /></Link>
            </nav>

            {assignmentAccess && <section className="learning-home__tasks" aria-labelledby="home-tasks-heading">
                <div className="learning-home__section-heading"><div><h2 id="home-tasks-heading">老師的任務</h2><p>依自己的步調，完成每個練習。</p></div><Link to="/student/assignments">全部作業<FiArrowRight aria-hidden="true" /></Link></div>
                <div className="learning-home__filters" role="group" aria-label="篩選作業狀態">{Object.entries(assignmentStateLabel).map(([key, label]) => <button type="button" key={key} aria-pressed={taskFilter === key} onClick={() => setTaskFilter(key)}>{label}{data && !data.taskError ? ` ${tasks.filter(task => task.state === key).length}` : ""}</button>)}</div>
                {loading ? <p role="status">正在整理作業…</p> : <>
                    {data?.taskError && <div className="learning-home__notice" role="status">部分作業未能讀取，這裡可能不是完整清單。<button type="button" onClick={refresh}>重新讀取</button></div>}
                    {filteredTasks.slice(0, 3).map(task => <Link className="learning-home__task" to={taskPath(task)} key={task.taskKey}><span className={`learning-home__task-icon is-${task.state}`}><FiCheckCircle /></span><span><strong>{task.title}</strong><small>{assignmentStateLabel[task.state]}{formatDeadline(task.due_at) ? ` · ${formatDeadline(task.due_at)} 截止` : ""}</small></span><FiArrowRight aria-hidden="true" /></Link>)}
                    {!filteredTasks.length && !data?.taskError && <p className="learning-home__empty">{taskFilter === "completed" ? "完成的任務會出現在這裡。" : taskFilter === "overdue" ? "目前沒有逾期任務。" : "目前沒有進行中的任務，可以從下面的教材開始。"}</p>}
                </>}
            </section>}

            <section className="learning-home__books" id="learning-books" aria-labelledby="home-books-heading">
                <div className="learning-home__section-heading"><div><h2 id="home-books-heading">我的教材小書架</h2><p>選擇教材，打開今天的聽力練習。</p></div><label className="learning-home__search"><FiSearch aria-hidden="true" /><input type="search" aria-label="搜尋我的教材" placeholder="找教材" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
                {loading ? <p role="status">正在讀取可使用的教材…</p> : data?.catalogError ? <div className="learning-home__notice" role="status">教材暫時無法讀取，請再試一次。<button type="button" onClick={refresh}>重新讀取教材</button></div> : <>
                    {categories.length > 1 && <div className="learning-home__filters" role="group" aria-label="教材分類"><button type="button" aria-pressed={selectedCategory === "all"} onClick={() => setCategoryId("all")}>全部教材</button>{categories.map(category => <button type="button" key={category.id} aria-pressed={selectedCategory === String(category.id)} onClick={() => setCategoryId(String(category.id))}>{category.name}</button>)}</div>}
                    <p className="learning-home__book-count" role="status">{visibleBooks.length} 本教材</p>
                    <div className="learning-home__book-grid">{visibleBooks.map((book, index) => <Link className={`learning-home__book tone-${index % 3}`} to={bookPath(book)} key={`${book.categoryId}-${book.id || book.code}`}><span className="learning-home__book-art" aria-hidden="true"><FiBookOpen /><span>聽力練習</span></span><span className="learning-home__book-copy"><small>{book.categoryName}</small><strong>{book.name}</strong><span>打開教材 <FiArrowRight aria-hidden="true" /></span></span></Link>)}</div>
                    {!visibleBooks.length && <div className="learning-home__empty">{books.length ? <><p>沒有找到這本教材，換個名字試試看。</p><button type="button" onClick={() => { setSearch(""); setCategoryId("all"); }}>顯示全部教材</button></> : <><p>目前沒有可顯示的教材。</p><Link to="/student/membership">查看教材與功能權限</Link></>}</div>}
                </>}
            </section>
            <p className="learning-home__closing">每一次練習，都是成長的一小步。</p>
        </div>
    </main>;
}

export default StudentLearningHome;
