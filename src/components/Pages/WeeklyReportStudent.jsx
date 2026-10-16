import React from "react";
import { FiActivity, FiCalendar, FiCheckSquare, FiHeadphones, FiMic } from "react-icons/fi";
import { focusLevel, roundFocusRate } from "../../utils/focusRate";

const count = value => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
const todayInTaipei = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

// What a student wants from the week at a glance: how many days, how many listens, how many
// sentences spoken — three numbers and a row of days. Nothing here is computed on the page;
// every figure is the one the report endpoint returns.
// 孩子看的專注度用鼓勵的說法；數字只顯示整十。
const KID_FOCUS = { focused: "很專心，繼續保持！", ok: "還不錯，聽的時候別走開喔", needs_reminder: "要加油！聽的時候不要放著或切走" };

export default function WeeklyReportStudent({ report, showAttention = true }) {
    const focusRate = report.attention?.available ? roundFocusRate(report.attention.focus_rate) : null;
    const days = Array.isArray(report.daily_breakdown) ? report.daily_breakdown : [];
    const today = todayInTaipei();
    const activeDays = count(report.metrics?.active_days);
    const plays = count(report.listening?.plays);
    const sentences = count(report.speaking_challenge?.completed_questions);
    const assigned = count(report.assignments?.assigned);
    const completed = count(report.assignments?.completed);
    const tiles = [
        { key: "days", icon: FiCalendar, tone: "blue", verb: "學了", value: activeDays, unit: "天" },
        { key: "plays", icon: FiHeadphones, tone: "yellow", verb: "聽了", value: plays, unit: "次" },
        { key: "sentences", icon: FiMic, tone: "orange", verb: "會說", value: sentences, unit: "句" }
    ];

    return <section className="weekly-student" aria-label="這週的學習">
        <ul className="weekly-student__tiles">
            {tiles.map(tile => <li key={tile.key} className={`is-${tile.tone}`}>
                <tile.icon aria-hidden="true" />
                <span>{tile.verb}</span>
                <strong>{tile.value ?? "—"}<small>{tile.unit}</small></strong>
            </li>)}
        </ul>
        {days.length === 7 && <ol className="weekly-student__days" aria-label="這週哪幾天有學習">
            {days.map(day => {
                const future = String(day.date) > today;
                const active = Number(day.total) > 0;
                return <li key={day.date} className={active ? "is-active" : future ? "is-future" : ""} aria-label={`${day.weekday}${future ? "還沒到" : active ? "有學習" : "沒有學習"}`}>
                    <i aria-hidden="true" />
                    <span aria-hidden="true">{String(day.weekday).replace("週", "")}</span>
                </li>;
            })}
        </ol>}
        {assigned > 0 && completed != null && <p className="weekly-student__homework"><FiCheckSquare aria-hidden="true" />作業完成 <strong>{completed} / {assigned}</strong></p>}
        {assigned === 0 && <p className="weekly-student__homework is-none"><FiCheckSquare aria-hidden="true" />這週沒有作業</p>}
        {showAttention && focusRate !== null && <p className={`weekly-student__focus is-${focusLevel(focusRate)}`}><FiActivity aria-hidden="true" />專注度 <strong>{focusRate}%</strong><span>{KID_FOCUS[focusLevel(focusRate)]}</span></p>}
    </section>;
}
