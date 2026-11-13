import React, { useState } from "react";
import { STREAK_BADGES, getStreakBadgeState } from "../../utils/learningStreakBadges";
import "./css/LearningStreakCard.scss";

const WEEKDAY = ["一", "二", "三", "四", "五", "六", "日"];
const STATUS_LABEL = { done: "已練習", shield: "免死金牌", missed: "沒練習", today: "今天還沒練習", future: "還沒到" };

// 學生的「連續學習」卡：目前連續幾天、本週狀況、下一枚徽章，以及全部徽章。
function LearningStreakCard({ streak }) {
    const [showAll, setShowAll] = useState(false);
    if (!streak || typeof streak !== "object") return null;
    const { current, longest, top, next, remaining } = getStreakBadgeState(streak);
    const week = Array.isArray(streak.week) ? streak.week.slice(0, 7) : [];

    return <section className="learning-streak" aria-label="連續學習">
        <div className="learning-streak__main">
            <div className="learning-streak__badge">
                {top ? <img src={top.image} alt={`${top.name}徽章，${top.days} 天`} width="96" height="96" /> : <span className="learning-streak__empty" aria-hidden="true">0</span>}
            </div>
            <div className="learning-streak__text">
                <strong className="learning-streak__count">連續 {current} 天</strong>
                <span>{streak.today_done ? "今天已經練習了，明天再來！" : current > 0 ? "今天練習一下，連續就不會中斷。" : "今天開始，連續練習 3 天拿第一枚徽章！"}</span>
                {next ? <span className="learning-streak__next">再 {remaining} 天拿到「{next.name}」徽章</span> : <span className="learning-streak__next">你已經拿到全部徽章了！</span>}
                {longest > current && <small>歷史最長：連續 {longest} 天</small>}
            </div>
        </div>
        {week.length === 7 && <ol className="learning-streak__week" aria-label="本週練習狀況">
            {week.map((day, index) => <li key={day.date} className={`is-${day.status}`}>
                <span>{WEEKDAY[index]}</span>
                <b aria-label={STATUS_LABEL[day.status] || ""}>{day.status === "done" ? "✓" : day.status === "shield" ? "盾" : ""}</b>
            </li>)}
        </ol>}
        <p className="learning-streak__rule">每週有 1 次免死金牌：忘記練習 1 天，連續不會中斷。</p>
        <button type="button" className="learning-streak__toggle" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>
            {showAll ? "收起全部徽章" : "看全部徽章"}
        </button>
        {showAll && <ul className="learning-streak__all">
            {STREAK_BADGES.map(badge => {
                const owned = longest >= badge.days;
                return <li key={badge.days} className={owned ? "is-owned" : "is-locked"}>
                    <img src={badge.image} alt="" width="72" height="72" loading="lazy" />
                    <b>{badge.name}</b>
                    <small>{owned ? `${badge.days} 天 已拿到` : `${badge.days} 天`}</small>
                </li>;
            })}
        </ul>}
    </section>;
}

export default LearningStreakCard;
