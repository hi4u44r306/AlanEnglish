import React from "react";
import { FiActivity, FiAward, FiTarget } from "react-icons/fi";
import WeeklyReportStudent from "./WeeklyReportStudent";
import { focusLevel, roundFocusRate } from "../../utils/focusRate";
import "./css/WeeklyReportParent.scss";

const LEVELS = {
    focused: { label: "專注", tone: "is-focused", text: "聽音檔時大多能持續專心。" },
    ok: { label: "普通", tone: "is-ok", text: "偶爾會中途離開或放著不動，可以多提醒。" },
    needs_reminder: { label: "需要提醒", tone: "is-needs", text: "常常放著不動或切換頁面，建議陪伴孩子一起練習。" }
};

const count = value => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);
const sinceLabel = since => {
    const match = String(since || "").match(/^\d{4}-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[1])}/${Number(match[2])}` : "";
};

// 專注度：把「放著不動沒回應」「切換頁面暫停」對照有效聆聽次數。資料是播放器開始記錄之後才有。
export function WeeklyAttention({ attention }) {
    if (!attention) return null;
    if (!attention.available) {
        return <article className="weekly-parent__card weekly-attention is-empty" aria-label="專注度">
            <h2><FiActivity aria-hidden="true" />專注度</h2>
            <p>專注度從 {sinceLabel(attention.since)} 起的那一週開始記錄；整週都有記錄的週別才會顯示。</p>
        </article>;
    }
    const rate = roundFocusRate(attention.focus_rate);
    const level = LEVELS[focusLevel(rate)];
    if (!level) {
        return <article className="weekly-parent__card weekly-attention is-empty" aria-label="專注度">
            <h2><FiActivity aria-hidden="true" />專注度</h2>
            <p>本週還沒有足夠的聆聽紀錄可以判斷專注度。</p>
        </article>;
    }
    return <article className={`weekly-parent__card weekly-attention ${level.tone}`} aria-label="專注度">
        <h2><FiActivity aria-hidden="true" />專注度</h2>
        <div className="weekly-attention__main">
            <strong>{level.label}</strong>
            <span aria-label={`專注率 ${rate}%`}>{rate}%</span>
        </div>
        <div className="weekly-attention__bar" role="progressbar" aria-label="專注率" aria-valuemin="0" aria-valuemax="100" aria-valuenow={rate}>
            <i style={{ width: `${rate}%` }} />
        </div>
        <p>{level.text}</p>
        <ul className="weekly-attention__facts">
            <li>放著不動、系統自動暫停：<b>{count(attention.idle_pauses)} 次</b></li>
            <li>切換頁面造成暫停：<b>{count(attention.hidden_pauses)} 次</b></li>
        </ul>
    </article>;
}

// 老師與管理員看的每週報告重點：家長一眼就能看懂「學了多少、聽了多少、會了多少、專不專心、作業有沒有完成、還可以加強什麼」。
export default function WeeklyReportParent({ report }) {
    const focus = (Array.isArray(report.next_focus) ? report.next_focus : []).filter(Boolean).slice(0, 3);
    const mastered = count(report.review?.mastered);
    return <section className="weekly-parent" aria-label="這週給家長的重點">
        <WeeklyReportStudent report={report} showAttention={false} />
        {mastered > 0 && <p className="weekly-parent__mastered"><FiAward aria-hidden="true" />智慧複習這週新學會 <strong>{mastered}</strong> 題</p>}
        <div className="weekly-parent__grid">
            <WeeklyAttention attention={report.attention} />
            <article className="weekly-parent__card weekly-parent__focus" aria-label="還可以加強">
                <h2><FiTarget aria-hidden="true" />還可以加強</h2>
                {focus.length ? <ul>{focus.map(item => <li key={item}>{item}</li>)}</ul> : <p>目前沒有特別需要加強的地方，繼續保持。</p>}
            </article>
        </div>
    </section>;
}
