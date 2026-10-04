import React, { useState } from "react";
import { FiCheck, FiChevronDown, FiClock, FiMic } from "react-icons/fi";

const durationLabel = seconds => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes} 分鐘${remainder ? ` ${remainder} 秒` : ""}`;
};

export default function SpeakingChallengeRules({ policy, loading = false }) {
    const [expanded, setExpanded] = useState(false);
    const dailyReady = !loading && Number.isInteger(policy?.daily_remaining) && Number.isInteger(policy?.daily_limit);
    const budget = policy?.audio_budget;
    const audioReady = !loading && budget?.status === "ready" && Number.isInteger(budget?.remaining_seconds) && budget.remaining_seconds >= 0
        && Number.isInteger(budget?.limit_seconds) && budget.limit_seconds > 0;
    const remaining = audioReady ? budget.remaining_seconds : null;
    const longRecordings = audioReady ? Math.floor(remaining / 25) : null;
    const unavailable = loading ? "正在確認用量…" : "暫時無法取得，請重新整理";
    return <section className={`speaking-challenge-rules ${expanded ? "is-expanded" : ""}`} aria-labelledby="speaking-challenge-rules-title">
        <div className="speaking-challenge-rules__intro">
            <h2 id="speaking-challenge-rules-title">開口練英文，一關一關進步！</h2>
            <p>把課本裡的字母、單字和句子說出來，練習發音與回答問題。送出錄音後，看回饋再練一次。</p>
        </div>
        <div className="speaking-challenge-rules__usage" aria-label="我的口說用量" aria-live="polite">
            <div className="speaking-usage-card">
                <span className="speaking-usage-card__label"><FiCheck aria-hidden="true" />今天還能挑戰</span>
                <strong>{dailyReady ? `${Math.max(0, policy.daily_remaining)} 輪` : "—"}</strong>
                <span>{dailyReady ? `每天最多 ${policy.daily_limit} 輪 · 明天恢復` : unavailable}</span>
                <p>一輪可以練很多題，輪數不是錄音段數。</p>
            </div>
            <div className="speaking-usage-card speaking-usage-card--audio">
                <span className="speaking-usage-card__label"><FiMic aria-hidden="true" />本月還能送評</span>
                <strong>{audioReady ? durationLabel(remaining) : "—"}</strong>
                <span>{audioReady ? `每月共 ${durationLabel(budget.limit_seconds)} · 下月 1 日恢復` : unavailable}</span>
                <p>{audioReady ? remaining === 0 ? "本月送評時間用完了，還是可以聽示範、自己練習。"
                    : longRecordings > 0 ? <>以每段 25 秒算，約可再送 <b>{longRecordings} 段</b>；短錄音可以送更多段。</>
                        : `還能送 ${remaining} 秒以內的短錄音；不足以送一段 25 秒錄音。`
                    : "送評沒有固定段數，依每段錄音的秒數計算。"}</p>
            </div>
        </div>
        {dailyReady && policy.daily_remaining === 0 && <p className="speaking-challenge-rules__notice" role="status">今天的新挑戰輪數用完了，明天再來！已開始且仍有效的同一輪可繼續練習，但送評仍需要本月時間。</p>}
        <p className="speaking-challenge-rules__snapshot"><FiClock aria-hidden="true" />用量在進入列表時更新；恢復時間以台北時間為準。全站送評用量暫滿時，請聯絡老師。</p>
        <button type="button" className="speaking-challenge-rules__toggle" aria-expanded={expanded} aria-controls="speaking-challenge-rules-content" onClick={() => setExpanded(current => !current)}>
            <span className="speaking-challenge-rules__heading"><strong>怎麼玩？怎麼算用量？</strong></span>
            <span className="speaking-challenge-rules__action">{expanded ? "收起規則" : "查看規則"}<FiChevronDown aria-hidden="true" /></span>
        </button>
        {expanded && <div id="speaking-challenge-rules-content" className="speaking-challenge-rules__content">
            <ol>
                <li><b>選一本，挑一關</b><span>從 Workbook 闖關地圖點一個關卡。照念題直接練習；問答題可選簡單或挑戰。</span></li>
                <li><b>看題目，開口說</b><span>簡單模式可以看答案；挑戰模式自己回答。照念題可聽示範。字母／拼讀最多 12 秒，句子／問答最多 25 秒，說完就能停止。</span></li>
                <li><b>送出錄音，看回饋</b><span>每輪第一次正式送評才扣 1 輪。只開關卡、錄音或回聽都不扣輪數，也不扣送評時間。</span></li>
                <li><b>不會的題，再試一次</b><span>同一輪重錄、重試或換到下一題不多扣輪數；每次送評都會扣錄音秒數。3 秒錄音扣 3 秒，不會一律扣 25 秒。</span></li>
                <li><b>通關，繼續往上走</b><span>所有題目通過後完成這一關。練習／簡單通關解鎖下一頁，首次通關有 XP 與符合資格的 AE Points；挑戰成就另外記錄。</span></li>
            </ol>
            <div className="speaking-challenge-rules__tips">
                <p><b>挑戰模式看提示：</b>這題本輪不算通過；結束後只重試沒過的題，不用全部重唸。</p>
                <p><b>A–Z 字母挑戰：</b>照畫面一個字母一個字母說；如果畫面要求從第一題重新開始，會建立新的一輪。</p>
                <p><b>離開後重新開始：</b>新的挑戰輪會再扣 1 輪；同一輪與同一個關卡不是同一件事。</p>
                <p><b>網路或評分服務出錯：</b>不是答錯，錄音會保留。先回聽再按重試；再次送評仍計秒數。若短時間送太快，依畫面提示稍等一下。</p>
                <p><b>時間用完：</b>仍可聽示範、錄音回聽、自行練習；重新登入不會重置用量。</p>
            </div>
        </div>}
    </section>;
}
