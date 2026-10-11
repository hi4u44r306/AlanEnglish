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
                <span className="speaking-usage-card__label">今天還能練幾輪（字母與拼字）</span>
                <strong>{dailyReady ? `${dailyRemaining} 輪` : "—"}</strong>
                <div className={`speaking-round-slots ${dailyReady ? "" : "is-unknown"}`} role="img" aria-label={dailyReady ? `今天 ${policy.daily_limit} 輪，剩 ${dailyRemaining} 輪，已用 ${policy.daily_limit - dailyRemaining} 輪` : unavailable}>
                    {Array.from({ length: dailyReady ? policy.daily_limit : 10 }, (_, index) => <span key={index} aria-hidden="true" className={dailyReady && index >= policy.daily_limit - dailyRemaining ? "is-available" : ""}><FiMic /></span>)}
                </div>
                <span>{dailyReady ? `藍色還能用 · 灰色已用過 · 明天恢復` : unavailable}</span>
                <p>句子練習不扣輪數；同一輪重試也不會多扣。</p>
            </div>
        </div>
        {dailyReady && dailyRemaining === 0 && <p className="speaking-challenge-rules__notice" role="status">今天的新挑戰用完了，明天會恢復。句子練習還可以繼續，已經開始的那一輪也可以做完。</p>}
        <button type="button" className="speaking-challenge-rules__toggle" aria-expanded={expanded} aria-controls="speaking-challenge-rules-content" onClick={() => setExpanded(current => !current)}>
            <span className="speaking-challenge-rules__heading"><strong>家長小提醒</strong></span>
            <span className="speaking-challenge-rules__action">{expanded ? "收起說明" : "查看說明"}<FiChevronDown aria-hidden="true" /></span>
        </button>
        {expanded && <div id="speaking-challenge-rules-content" className="speaking-challenge-rules__content">
            <div className="speaking-challenge-rules__tips">
                <p><b>輪數怎麼算？</b>字母與拼字關卡每天最多 {dailyReady ? policy.daily_limit : 10} 輪，第一次送評才扣一輪，同一輪重試不多扣。句子練習不扣輪數。</p>
                <p><b>送評有上限嗎？</b>句子練習沒有每月秒數限制。A–Z 每個字母每天最多評分 3 次；拼字另有每月錄音額度。字母／拼讀每段最多錄 12 秒，句子／問答最多 25 秒。</p>
                <p><b>可以一直玩同一關嗎？</b>句子關卡通關後還可以再練習或再挑戰、看分數，獎勵只領一次。字母與拼字關卡有用量限制；A–Z 同一關每天正式完成一次。</p>
                <p><b>怎麼通關？</b>每題答案正確且達 70 分，完成整關挑戰才算正式通關並解鎖下一頁。練習可看答案與評分，但不算通關、不發獎勵。問答挑戰看過提示的題目，本輪只算練習。</p>
                <p><b>出錯或輪數用完？</b>技術失敗不算答錯。A–Z 已送出評分的錄音仍會算一次字母次數，避免重複送出。當天新輪數用完時，還沒通關、字母次數也還沒用完的那一輪可以繼續；也可以聽示範、自己練習。明天恢復，重新登入不會重置。</p>
            </div>
            <small>用量在進入列表時更新，恢復時間以台北時間為準。</small>
        </div>}
    </section>;
}
