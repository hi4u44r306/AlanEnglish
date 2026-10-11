import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { useStudentLearningHistory } from "../../hooks/useStudentLearningResume";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { findResumeBook, learningResumePath } from "../../services/studentLearningResume";
import { getStudentMaterialCategories } from "../../utils/studentLearning";

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

    if (!active) return null;

    return <section className="student-progress" aria-label="學習進度">
        <article className="student-progress__block" aria-labelledby="progress-listening">
            <h2 id="progress-listening">聽力：上次聽到這裡</h2>
            {listening.length ? <div className="student-progress__list">
                {listening.map(({ bookmark, book }) => <Link className="student-progress__item" to={learningResumePath(book, bookmark)} key={bookmark.bookId}>
                    <strong>{book.name}</strong>
                    <span>{bookmark.trackTitle || bookmark.page || "教材音檔"} · {formatDay(bookmark.savedAt)}</span>
                </Link>)}
            </div> : <p>{catalogQuery.loading ? "正在讀取教材…" : <>這台裝置還沒有聽力紀錄。<Link to="/student/dashboard">去選一本教材</Link></>}</p>}
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
            {assignmentAccess && <Link to="/student/assignments">我的作業</Link>}
            <Link to="/student/weekly-report">每週報告</Link>
            <Link to="/student/leaderboard">排行榜</Link>
        </nav>
    </section>;
}

export default StudentProgressOverview;
