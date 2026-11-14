import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { confirmWeeklyUnsubscribe, previewWeeklyUnsubscribe } from "../../services/guardianWeeklyUnsubscribeService";
import "./css/Platform.scss";

// 家長在週報信裡按「取消每週學習週報」會開到這一頁。
// 開啟頁面只「檢查」連結、不會取消；家長按下按鈕才真的取消（避免信件掃描器或瀏覽器預取誤觸）。
// 簽章讀進來後立刻從網址移除，不留在瀏覽紀錄裡。
function WeeklyReportUnsubscribe() {
    const location = useLocation();
    const linkRef = useRef(null);
    if (linkRef.current === null) {
        const params = new URLSearchParams(location.search);
        linkRef.current = { s: params.get("s") || "", e: params.get("e") || "", t: params.get("t") || "" };
    }
    const [status, setStatus] = useState("loading");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && window.history?.replaceState) {
            window.history.replaceState(window.history.state, "", location.pathname);
        }
        const { s, e, t } = linkRef.current;
        if (!s || !e || !t) { setStatus("invalid"); return undefined; }
        let active = true;
        previewWeeklyUnsubscribe({ s: Number(s), e: Number(e), t })
            .then(result => { if (active) setStatus(result?.status || "error"); })
            .catch(() => { if (active) setStatus("error"); });
        return () => { active = false; };
    }, [location.pathname]);

    const confirm = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const { s, e, t } = linkRef.current;
            const result = await confirmWeeklyUnsubscribe({ s: Number(s), e: Number(e), t });
            setStatus(result?.status === "opted_out" || result?.status === "already" ? "done" : result?.status || "error");
        } catch {
            setStatus("error");
        } finally {
            setSubmitting(false);
        }
    };

    const copy = {
        loading: ["正在確認連結…", ""],
        invalid: ["這個連結無法使用", "連結可能不完整，或家長信箱已經更換。如要停止收信，請聯絡授課老師。"],
        expired: ["這個連結已經過期", "請使用最近一封週報信裡的連結，或聯絡授課老師。"],
        error: ["目前無法處理", "服務暫時無法使用，請稍後再按一次連結，或聯絡授課老師。"],
        already: ["已經取消了", "您不會再收到每週學習週報。之後想重新收到，請聯絡授課老師。"],
        done: ["已取消每週學習週報", "您不會再收到每週學習週報。其他重要通知（例如帳號與付款）不受影響。之後想重新收到，請聯絡授課老師。"]
    };

    if (status === "ready") {
        return (
            <main className="platform-public">
                <section className="platform-public-card">
                    <span className="platform-eyebrow">WEEKLY REPORT</span>
                    <h1>取消每週學習週報？</h1>
                    <p>按下按鈕後，Alan English 就不會再寄每週學習週報給您。帳號、付款等重要通知不受影響。</p>
                    <div className="platform-verification-actions">
                        <button type="button" className="platform-primary" onClick={confirm} disabled={submitting}>{submitting ? "處理中…" : "確定取消每週週報"}</button>
                        <Link className="platform-secondary" to="/">先不要，回首頁</Link>
                    </div>
                </section>
            </main>
        );
    }

    const [title, detail] = copy[status] || copy.error;
    return (
        <main className="platform-public">
            <section className="platform-public-card platform-center">
                {status === "loading" ? <div className="platform-loading">{title}</div> : (
                    <>
                        <h1>{title}</h1>
                        <p role={status === "done" || status === "already" ? "status" : "alert"}>{detail}</p>
                        <div className="platform-verification-actions"><Link className="platform-secondary" to="/">回首頁</Link></div>
                    </>
                )}
            </section>
        </main>
    );
}

export default WeeklyReportUnsubscribe;
