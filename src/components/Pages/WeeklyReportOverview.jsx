import React from "react";
import { FiHeadphones, FiMic, FiTarget } from "react-icons/fi";

const displayCount = (value, unit) => typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value} ${unit}` : "尚無資料";

export default function WeeklyReportOverview({ report }) {
    const challenge = report.speaking_challenge;
    const focus = Array.isArray(report.next_focus) ? report.next_focus.filter(item => typeof item === "string" && item.trim()) : [];

    return <section className="weekly-overview" aria-labelledby="weekly-overview-heading">
        <header>
            <h2 id="weekly-overview-heading">本週學習摘要</h2>
            <p>先看學習紀錄，再一起選擇下次的練習方向。</p>
        </header>
        <div className="weekly-overview__body">
            <div>
                <dl className="weekly-overview__facts">
                    <div>
                        <dt><FiHeadphones aria-hidden="true" />有效聆聽</dt>
                        <dd><strong>{displayCount(report.listening?.plays, "次")}</strong><p>系統保存的有效聆聽，不是開啟音檔的次數。</p></dd>
                    </div>
                    <div>
                        <dt><FiMic aria-hidden="true" />口說新完成</dt>
                        <dd><strong>{displayCount(challenge?.completed_questions, "題")}</strong><p>本週新完成的題目，重練同題不重複增加。</p></dd>
                    </div>
                </dl>
                <ul className="weekly-overview__milestones" aria-label="口說通關紀錄">
                    <li>本週通過 <strong>{displayCount(challenge?.completed_challenges, "關")}</strong></li>
                    <li>截至本週累計 <strong>{displayCount(challenge?.all_time_completed_challenges, "關")}</strong></li>
                </ul>
            </div>
            <aside className="weekly-overview__focus" aria-labelledby="weekly-focus-heading">
                <h3 id="weekly-focus-heading"><FiTarget aria-hidden="true" />下次練習方向</h3>
                {focus.length ? <ul>{focus.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                    : <p>目前沒有練習建議，先查看下方的學習紀錄。</p>}
                <small>次數與通關表示練習紀錄，不等同考試成績。</small>
            </aside>
        </div>
    </section>;
}
