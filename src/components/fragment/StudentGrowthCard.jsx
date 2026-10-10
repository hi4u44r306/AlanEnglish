import React from "react";
import { FiAward, FiGift } from "react-icons/fi";
import "../assets/scss/StudentGrowthCard.scss";

const number = value => Number(value).toLocaleString("zh-TW");
const available = value => value != null && Number.isFinite(Number(value));

function StudentGrowthCard({ balance, loading = false, error = false, pointsAccess = false, onRetry, children }) {
    const hasXp = available(balance?.total_xp);
    const hasLevel = available(balance?.level);
    const hasPoints = available(balance?.points_balance);
    const progress = available(balance?.progress_percent)
        ? Math.min(100, Math.max(0, Number(balance.progress_percent))) : null;
    const remaining = hasXp && available(balance?.next_level_xp)
        ? Math.max(0, Number(balance.next_level_xp) - Number(balance.total_xp)) : null;

    return <section className="student-growth" aria-label="我的成長" aria-busy={loading}>
        <div className="student-growth__experience">
            <div className="student-growth__level"><FiAward aria-hidden="true" /><strong>{hasLevel ? `Lv.${number(balance.level)}` : "成長中"}</strong></div>
            <div className="student-growth__copy">
                <h2>我的成長</h2>
                {hasXp ? <><p className="student-growth__total"><strong>{number(balance.total_xp)} XP</strong><span>升級用的經驗</span></p>
                    {progress != null && <progress value={progress} max="100" aria-label="目前等級成長進度" />}
                    <p>{hasLevel && remaining != null && remaining > 0 ? <>再累積 <b>{number(remaining)} XP</b>，前往 Lv.{number(Number(balance.level) + 1)}</> : "繼續練習，累積每一步的學習經驗。"}</p>
                </> : <p role="status">{loading ? "正在讀取成長資料…" : "成長資料暫時無法讀取，你仍可以開始學習。"}</p>}
            </div>
        </div>
        <div className="student-growth__wallet">
            <span><FiGift aria-hidden="true" />{pointsAccess ? "可用 AE Points" : "保留的 AE Points"}</span>
            <strong>{hasPoints ? `${number(balance.points_balance)} P` : loading ? "讀取中" : "尚未讀取"}</strong>
            <p>{pointsAccess ? "P 是兌換獎品的點數；XP 是升級經驗，兌換不會扣 XP。" : "目前無兌換資格，既有點數與 XP 保留。"}</p>
        </div>
        {error && <div className="student-growth__notice" role="status">{hasXp ? "暫時無法更新，這裡顯示上次讀取的進度。" : "請重新讀取成長資料。"}{onRetry && <button type="button" onClick={onRetry} disabled={loading}>重新讀取成長</button>}</div>}
        {children && <nav className="student-growth__links" aria-label="繼續我的學習">{children}</nav>}
    </section>;
}

export default StudentGrowthCard;
