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
                <span className="speaking-usage-card__label">今天還能挑戰</span>
                <strong>{dailyReady ? `${dailyRemaining} 輪` : "—"}</strong>
                <div className={`speaking-round-slots ${dailyReady ? "" : "is-unknown"}`} role="img" aria-label={dailyReady ? `今天 ${policy.daily_limit} 輪，剩 ${dailyRemaining} 輪，已用 ${policy.daily_limit - dailyRemaining} 輪` : unavailable}>
                    {Array.from({ length: dailyReady ? policy.daily_limit : 10 }, (_, index) => <span key={index} aria-hidden="true" className={dailyReady && index >= policy.daily_limit - dailyRemaining ? "is-available" : ""}><FiMic /></span>)}
                </div>
                <span>{dailyReady ? `藍色還能用 · 灰色已用過 · 明天恢復` : unavailable}</span>
                <p>1 輪可以答很多題，同一輪重試不多扣。</p>
            </div>
        </div>
        {dailyReady && dailyRemaining === 0 && <p className="speaking-challenge-rules__notice" role="status">今天的新挑戰用完了，明天再來！這一輪還沒結束的話，可以繼續。</p>}
        <button type="button" className="speaking-challenge-rules__toggle" aria-expanded={expanded} aria-controls="speaking-challenge-rules-content" onClick={() => setExpanded(current => !current)}>
            <span className="speaking-challenge-rules__heading"><strong>家長小提醒</strong></span>
            <span className="speaking-challenge-rules__action">{expanded ? "收起說明" : "查看說明"}<FiChevronDown aria-hidden="true" /></span>
        </button>
        {expanded && <div id="speaking-challenge-rules-content" className="speaking-challenge-rules__content">
            <div className="speaking-challenge-rules__tips">
                <p><b>輪數怎麼算？</b>每天最多 {dailyReady ? policy.daily_limit : 10} 輪，第一次送評才扣一輪。只錄音、回聽不扣；同一輪重試不多扣。離開後重新挑戰、或 A–Z 從頭再來，會開新的一輪。</p>
                <p><b>送評有上限嗎？</b>沒有個人每月送評秒數額度。單段字母／拼讀最多 12 秒，句子／問答最多 25 秒，說完就能停止；短錄音有助於手機穩定處理。</p>
                <p><b>怎麼通關？</b>照念題直接練；問答題可選簡單（看答案）或挑戰（自己回答）。挑戰看提示的題本輪不通過，結束後可只重試未過題。練習／簡單通關解鎖下一頁，獎勵依資格發放。</p>
                <p><b>出錯或輪數用完？</b>評分失敗不算答錯，錄音會保留，可重試評分。當天新輪數用完，仍可完成這一輪、聽示範及自行練習；明天恢復，重新登入不會重置輪數。</p>
            </div>
            <small>用量在進入列表時更新，恢復時間以台北時間為準。</small>
        </div>}
    </section>;
}
