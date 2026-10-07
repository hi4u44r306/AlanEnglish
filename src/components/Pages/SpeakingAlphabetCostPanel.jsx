import React, { useState } from "react";
import { getSpeakingAlphabetCostUsage } from "../../services/speakingChallengeService";

export default function SpeakingAlphabetCostPanel({ firebaseUser }) {
    const [usage,setUsage]=useState(null), [error,setError]=useState(""), [loading,setLoading]=useState(false);
    const refresh=async()=>{
        setLoading(true);setError("");
        try { const result=await getSpeakingAlphabetCostUsage(firebaseUser);
            if (!Number.isFinite(result?.usage?.estimated_twd) || !Number.isFinite(result?.usage?.reserved_seconds)) throw new Error("費用資料不完整");
            setUsage(result.usage);
        } catch (cause) { setUsage(null);setError(cause.message || "費用暫時無法讀取"); }
        finally {setLoading(false);}
    };
    const cost=usage?.estimated_twd;
    return <section className="platform-card" aria-label="A–Z 月費提醒">
        <h2>A–Z 月費提醒</h2>
        <button type="button" className="platform-primary" style={{ minHeight: 44 }} onClick={refresh} disabled={loading}>{loading ? "讀取中…" : "更新本月費用"}</button>
        {error && <p role="alert">{error}</p>}
        {usage && <><p>{usage.activity_month} 預估 NT${cost.toFixed(2)}，送評約 {(usage.reserved_seconds/60).toFixed(1)} 分鐘。</p>
            {cost >= 1000 && <p role="status">{cost >= 1500 ? "本月估算已達 NT$1,500，請確認 Azure 帳單與使用量。" : "本月估算已達 NT$1,000，請留意費用。"}學生仍可正常送評。</p>}</>}
        <small>僅計本次切換後的 A–Z 基本評分；按 US$1／小時、US$1＝NT$32 估算，包含失敗與不確定的請求。未含稅及匯差，以 Azure 帳單為準。提醒在更新時顯示，不會自動停止扣費。</small>
    </section>;
}
