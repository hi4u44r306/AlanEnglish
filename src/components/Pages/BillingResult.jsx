import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { syncBillingSession } from "../../services/billingService";
import { getMembershipProfile } from "../../services/membershipService";
import "./css/Platform.scss";

function BillingResult({ cancelled = false }) {
    const location = useLocation();
    const { firebaseUser, setStudentProfile } = useAuth();
    const [state, setState] = useState(cancelled ? "cancelled" : "loading");
    const [message, setMessage] = useState(cancelled ? "你已取消這次付款，原本的會員狀態不會改變。" : "正在向付款服務確認結果…");

    useEffect(() => {
        if (cancelled || !firebaseUser) return;
        let disposed = false;
        const sync = async () => {
            try {
                const sessionId = new URLSearchParams(location.search).get("session_id") || "";
                if (!sessionId.startsWith("cs_")) throw new Error("付款工作階段資料不完整");
                const result = await syncBillingSession(firebaseUser, sessionId);
                const profileResult = await getMembershipProfile(firebaseUser);
                if (disposed) return;
                setStudentProfile(profileResult.profile);
                const accessUpdated = result?.access_grant?.status === "active" || result?.membership?.is_active;
                setState(accessUpdated ? "success" : "pending");
                setMessage(accessUpdated ? "付款已確認，使用權限已更新。" : result?.message || "付款仍在處理中，請稍後重新整理會員頁。 ");
            } catch (error) {
                if (!disposed) { setState("error"); setMessage(error.message || "付款結果確認失敗"); }
            }
        };
        sync();
        return () => { disposed = true; };
    }, [cancelled, firebaseUser, location.search, setStudentProfile]);

    return <main className="platform-public"><section className="platform-public-card platform-center"><div className="platform-icon">{state === "success" ? "✅" : state === "cancelled" ? "↩️" : state === "loading" ? "⏳" : "⚠️"}</div><span className="platform-eyebrow">BILLING</span><h1>{state === "success" ? "付款完成" : state === "cancelled" ? "付款已取消" : state === "loading" ? "確認付款中" : "付款尚未完成"}</h1><p>{message}</p><Link className="platform-primary" to="/student/membership">回到會員方案</Link></section></main>;
}

export default BillingResult;
