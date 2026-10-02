import React, { createContext } from "react";
import { assessmentBlockedMessage, assessmentResetLabel, assessmentTimeLabel } from "../../utils/speakingAssessmentBudget";
import "./css/SpeakingAssessmentBudget.scss";

export const SpeakingAssessmentContext = createContext(null);

export default function SpeakingAssessmentBudget({ usage }) {
    if (!usage) return null;
    const blocked = assessmentBlockedMessage(usage);
    const studentQuota = Number.isFinite(usage.monthly_limit_seconds);
    return <aside className="speaking-assessment-budget" aria-label="AI 評分額度" role="status">
        {studentQuota && <><strong>本月 AI 評分剩 {assessmentTimeLabel(usage.monthly_remaining_seconds)}</strong>
            <span>每月 90 分鐘 · 台灣時間 {assessmentResetLabel(usage.reset_at)} 00:00 恢復</span>
            <progress aria-label="本月剩餘 AI 評分時間" max={usage.monthly_limit_seconds} value={usage.monthly_remaining_seconds} /></>}
        {blocked ? <p>{blocked} 自行練習不計通關。</p> : <small>{studentQuota ? "重試送評也計時；只錄音或回聽不扣額度。" : "管理員示範會使用全站 AI 評分額度，不發放學生獎勵。"}</small>}
    </aside>;
}
