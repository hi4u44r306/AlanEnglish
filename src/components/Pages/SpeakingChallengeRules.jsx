import React, { useState } from "react";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import SpeakingAssessmentBudget from "./SpeakingAssessmentBudget";

export default function SpeakingChallengeRules({ policy }) {
    const [expanded, setExpanded] = useState(false);
    const hasUsage = policy?.daily_remaining != null && Number.isFinite(Number(policy.daily_remaining));
    return <section className={`speaking-challenge-rules ${expanded ? "is-expanded" : ""}`} aria-labelledby="speaking-challenge-rules-title">
        <button type="button" className="speaking-challenge-rules__toggle" aria-expanded={expanded} aria-controls="speaking-challenge-rules-content" onClick={() => setExpanded(current => !current)}>
            <span className="speaking-challenge-rules__icon" aria-hidden="true">?</span>
            <span className="speaking-challenge-rules__heading"><small>HOW TO PLAY</small>
                <strong id="speaking-challenge-rules-title">遊戲規則</strong>
                <span className="speaking-challenge-rules__quota">每天最多新開始 5 輪{hasUsage ? ` · 今天剩 ${policy.daily_remaining} 輪` : ""} · 每月 90 分鐘 AI 評分</span>
            </span>
            <span className="speaking-challenge-rules__action">{expanded ? "收起規則" : "查看規則"}<FiChevronDown aria-hidden="true" /></span>
        </button>
        <SpeakingAssessmentBudget usage={policy?.assessment_usage} />
        {expanded && <div id="speaking-challenge-rules-content" className="speaking-challenge-rules__content"><ol>
            <li><b>每天 5 輪</b><span>台灣時間每天最多新開始 5 輪正式挑戰，午夜重置。第一次有效錄音送評並取得送評額度時才計輪；進入關卡、看題目或尚未送評就離開都不扣輪數。</span></li>
            <li><b>每月 90 分鐘</b><span>所有 Workbook、簡單、挑戰與照念練習共用。每次送評依整段音檔長度向上取整秒計算，包含停頓與重試；台灣時間每月 1 日 00:00 重置，未用完不累積。</span></li>
            <li><b>重試如何計算</b><span>同一輪重試或換題不多扣輪數，但每次再次送評都使用分鐘額度。只錄音、回聽或重試儲存既有評分結果不扣分鐘。送評後即計時；已送出的錄音即使辨識不清或連線逾時，也可能已使用評分服務，仍計入額度。</span></li>
            <li><b>額度用完</b><span>仍可查看已解鎖題目、錄音及回聽，暫停 AI 評分，顯示恢復日期。全站當月總額度用完也會暫停；自行練習不算正式通關或發放獎勵。</span></li>
            <li><b>每次 12 秒</b><span>每段最長 12 秒。先想好再錄，說完就停止，可減少無聲等待使用的額度。格式、音量等送評前檢查未通過不扣分鐘。系統另有短時間與每日送評次數保護。</span></li>
            <li><b>怎麼選模式</b><span>拼字、拼讀與照念完整句子只有單一練習，需要時可聽示範。問答類的簡單模式可看題目與答案說；挑戰模式看問題回答，兩種成就分開保存。</span></li>
            <li><b>提示與補考</b><span>挑戰模式看過提示的題目，本輪不計通過。一般關卡結束後只重試未通過的題目，已通過題目保留；A–Z 是連續挑戰，需依順序完成整輪，重開會從第一題開始。</span></li>
            <li><b>通關與獎勵</b><span>本關所有題目取得有效通過結果才通關。照念練習或簡單模式通關會解鎖下一頁；挑戰模式另記成就。首次正式通關才有獎勵，重玩不重複領取；XP 與符合資格的 AE Points 以結果畫面為準。</span></li>
        </ol><p><FiCheck aria-hidden="true" /> 答錯可以再練習，評分服務失敗不會當成通關。</p></div>}
    </section>;
}
