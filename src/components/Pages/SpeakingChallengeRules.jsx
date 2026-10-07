import React, { useState } from "react";
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiChevronDown, FiMic } from "react-icons/fi";

export default function SpeakingChallengeRules({ policy, loading = false }) {
    const [expanded, setExpanded] = useState(false);
    const dailyReady = !loading && Number.isInteger(policy?.daily_remaining) && policy.daily_remaining >= 0
        && Number.isInteger(policy?.daily_limit) && policy.daily_limit > 0 && policy.daily_limit <= 20;
    const dailyRemaining = dailyReady ? Math.min(policy.daily_remaining, policy.daily_limit) : null;
    const unavailable = loading ? "正在確認用量…" : "暫時無法取得，請重新整理";
    return <section className={`speaking-challenge-rules ${expanded ? "is-expanded" : ""}`} aria-labelledby="speaking-challenge-rules-title">
        <div className="speaking-challenge-rules__intro">
            <h2 id="speaking-challenge-rules-title">3 步驟，開口練英文</h2>
            <p>練習把課本的字母、單字和句子說出來。</p>
        </div>
        <ol className="speaking-play-flow" aria-label="口說挑戰三步驟">
            <li><span className="speaking-play-flow__icon"><FiBookOpen aria-hidden="true" /></span><b>1 選關卡</b><span>挑一頁來練習</span><FiArrowRight className="speaking-play-flow__arrow" aria-hidden="true" /></li>
            <li><span className="speaking-play-flow__icon"><FiMic aria-hidden="true" /></span><b>2 錄音回答</b><span>按麥克風開口說</span><FiArrowRight className="speaking-play-flow__arrow" aria-hidden="true" /></li>
            <li><span className="speaking-play-flow__icon"><FiCheckCircle aria-hidden="true" /></span><b>3 看回饋</b><span>送出錄音看結果</span></li>
        </ol>
        <div className="speaking-challenge-rules__usage" aria-label="我的口說用量" aria-live="polite">
            <div className="speaking-usage-card">
                <span className="speaking-usage-card__label">Azure 字母與拼字今日剩餘輪數</span>
                <strong>{dailyReady ? `${dailyRemaining} 輪` : "—"}</strong>
                <div className={`speaking-round-slots ${dailyReady ? "" : "is-unknown"}`} role="img" aria-label={dailyReady ? `今天 ${policy.daily_limit} 輪，剩 ${dailyRemaining} 輪，已用 ${policy.daily_limit - dailyRemaining} 輪` : unavailable}>
                    {Array.from({ length: dailyReady ? policy.daily_limit : 10 }, (_, index) => <span key={index} aria-hidden="true" className={dailyReady && index >= policy.daily_limit - dailyRemaining ? "is-available" : ""}><FiMic /></span>)}
                </div>
                <span>{dailyReady ? `藍色還能用 · 灰色已用過 · 明天恢復` : unavailable}</span>
                <p>本機句子可持續評分；Azure 同一輪重試不多扣輪數。</p>
            </div>
        </div>
        {dailyReady && dailyRemaining === 0 && <p className="speaking-challenge-rules__notice" role="status">Azure 今日新輪數已用完；本機句子仍可評分，Azure 尚未結束的輪次依剩餘額度繼續。</p>}
        <button type="button" className="speaking-challenge-rules__toggle" aria-expanded={expanded} aria-controls="speaking-challenge-rules-content" onClick={() => setExpanded(current => !current)}>
            <span className="speaking-challenge-rules__heading"><strong>家長小提醒</strong></span>
            <span className="speaking-challenge-rules__action">{expanded ? "收起說明" : "查看說明"}<FiChevronDown aria-hidden="true" /></span>
        </button>
        {expanded && <div id="speaking-challenge-rules-content" className="speaking-challenge-rules__content">
            <div className="speaking-challenge-rules__tips">
                <p><b>輪數怎麼算？</b>Azure 字母與拼字每天最多 {dailyReady ? policy.daily_limit : 10} 輪，第一次送評才扣一輪，同輪重試不多扣。一般本機句子不扣 Azure 輪數。</p>
                <p><b>送評有上限嗎？</b>本機句子不受 Azure 每月秒數額度限制。A–Z 每個字母每天最多評分 3 次；拼字保留個人與全站每月音訊額度。單段字母／拼讀最多 12 秒，句子／問答最多 25 秒。</p>
                <p><b>可以一直玩同一關嗎？</b>本機題通關後仍可練習或再次挑戰並看分數，獎勵只領一次。Azure 題依付費用量限制；A–Z 同關每日正式完成一次。</p>
                <p><b>怎麼通關？</b>每題答案正確且達 70 分，完成整關挑戰才算正式通關並解鎖下一頁。練習可看答案與評分，但不算通關、不發獎勵。問答挑戰看過提示的題目，本輪只算練習。</p>
                <p><b>出錯或輪數用完？</b>技術失敗不算答錯。A–Z 已送交評分的請求仍占字母次數，以免重送增加費用。當天新輪數用完，未通關且字母次數未用完的這一輪仍可繼續；也可聽示範、自行練習，明天恢復，重新登入不會重置。</p>
            </div>
            <small>用量在進入列表時更新，恢復時間以台北時間為準。</small>
        </div>}
    </section>;
}
