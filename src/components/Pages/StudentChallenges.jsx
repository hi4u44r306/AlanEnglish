import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { FiChevronRight, FiLock, FiMic, FiType } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { WORD_BANK_VERSION, WORD_CHALLENGE_LEVELS, findWordByKey } from "../../services/wordChallengeBank";
import { loadLocalProgress } from "../../services/wordChallengeLocalProgress";
import { WORD_CHALLENGE_MODES } from "../../utils/wordChallengeAnswer";
import "./css/StudentChallenges.scss";

const WORD_TOTAL = WORD_CHALLENGE_LEVELS.reduce((total, level) => total + (level.meaningReady || 0), 0);

// 大挑戰：選單只有一顆「大挑戰」，這一頁再分口說和單字。
// 口說要有口說方案；單字每個人都能玩，所以這一頁本身不上鎖。
export default function StudentChallenges() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const membership = studentProfile?.membership;
    const features = membership?.effective_access?.features || {};
    // 老師與管理員進來是預覽；學生要有口說方案才能進口說大挑戰（後端也會再檢查）。
    const speakingAccess = role !== "student" || (membership?.is_active === true && features.pronunciation === true);
    // 與「我的進度」共用同一份口說關卡快取，不重複讀取。
    const speakingQuery = useStudentPageQuery("speaking:catalog", () => getSpeakingChallengeCatalog(firebaseUser), { enabled: role === "student" && speakingAccess });

    // 和「我的進度」的口說卡一樣只算一本：先放做到一半的，其次是還沒做完的第一本。
    const speaking = useMemo(() => {
        const groups = new Map();
        (speakingQuery.data?.challenges || []).forEach(item => {
            const book = item.book || item.books || {};
            const key = String(book.id || book.code || book.name || "other");
            const group = groups.get(key) || { name: book.name || "", total: 0, completed: 0 };
            group.total += 1;
            if (item.is_completed === true) group.completed += 1;
            groups.set(key, group);
        });
        const books = [...groups.values()];
        return books.find(group => group.completed > 0 && group.completed < group.total)
            || books.find(group => group.completed < group.total) || books[0] || null;
    }, [speakingQuery.data]);

    // 單字成績目前只存在這台裝置。
    const wordKnown = useMemo(() => {
        const { mastered } = loadLocalProgress(WORD_BANK_VERSION, WORD_CHALLENGE_MODES.meaning);
        return mastered.filter(key => findWordByKey(key)?.gloss).length;
    }, []);

    const speakingMeta = role !== "student" ? "老師預覽"
        : speaking ? `${speaking.name ? `${speaking.name} · ` : ""}已過 ${speaking.completed} / ${speaking.total} 關`
            : speakingQuery.loading ? "讀取中…"
                : speakingQuery.error ? "進度暫時無法讀取" : "還沒開始";

    return <main className="student-challenges-page">
        <h1>大挑戰</h1>
        <div className="student-challenges__cards">
            {speakingAccess
                ? <Link className="student-challenges__card is-speaking" to="/student/speaking-challenges">
                    <span className="student-challenges__tile" aria-hidden="true"><FiMic /></span>
                    <span className="student-challenges__body">
                        <strong>口說大挑戰</strong>
                        <span>看著句子開口說，說對就過關。</span>
                        <small>{speakingMeta}</small>
                    </span>
                    <FiChevronRight className="student-challenges__arrow" aria-hidden="true" />
                </Link>
                : <div className="student-challenges__card is-speaking is-locked">
                    <span className="student-challenges__tile" aria-hidden="true"><FiLock /></span>
                    <span className="student-challenges__body">
                        <strong>口說大挑戰</strong>
                        <span>需要「口說方案」。請問老師或家長。</span>
                        <Link className="student-challenges__locked-link" to="/student/membership">看會員與功能</Link>
                    </span>
                </div>}
            <Link className="student-challenges__card is-word" to="/student/word-challenge">
                <span className="student-challenges__tile" aria-hidden="true"><FiType /></span>
                <span className="student-challenges__body">
                    <strong>單字大挑戰</strong>
                    <span>看中文，把英文單字拼出來。分 6 級，每輪 10 題。</span>
                    <small>{wordKnown > 0 ? `已會 ${wordKnown} / ${WORD_TOTAL} 字` : `${WORD_TOTAL} 字 · 還沒挑戰`}</small>
                </span>
                <FiChevronRight className="student-challenges__arrow" aria-hidden="true" />
            </Link>
        </div>
    </main>;
}
