import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { acknowledgeCostAlert, getCostAlerts, subscribeCostAlerts } from "../../services/costAlertService";

export default function CostAlertPanel({ firebaseUser }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(null);
    const [refresh, setRefresh] = useState(0);
    const requestVersion = useRef(0);
    const mutating = useRef(false);
    const reload = useCallback(() => setRefresh(value => value + 1), []);
    useEffect(() => {
        if (!firebaseUser) return undefined;
        let active = true;
        const load = async () => {
            if (mutating.current) return;
            const version = ++requestVersion.current;
            try {
                const result = await getCostAlerts(firebaseUser);
                if (active && version === requestVersion.current) { setData(result); setError(""); }
            } catch (failure) {
                if (active && version === requestVersion.current) setError(failure.message || "成本提醒讀取失敗");
            }
        };
        load();
        const timer = setInterval(load, 60000);
        return () => { active = false; clearInterval(timer); };
    }, [firebaseUser, refresh]);

    const mutate = async (key, action) => {
        if (mutating.current) return;
        mutating.current = true;
        ++requestVersion.current;
        setBusy(key);
        try { setData(await action()); setError(""); }
        catch (failure) { toast.error(failure.message || "成本提醒更新失敗"); }
        finally { mutating.current = false; setBusy(null); }
    };
    const notification = data?.notification;
    const pending = (data?.alerts || []).filter(alert => !alert.acknowledged_at);
    const configuredElsewhere = notification?.configured && !notification.is_recipient;
    return <section className="platform-card api-notifications" aria-labelledby="api-notifications-title">
        <div className="platform-section-title"><div><span className="platform-eyebrow">EMAIL ALERTS</span><h2 id="api-notifications-title">成本超標自動提醒</h2></div></div>
        <p>成本達到您設定的警戒線後，系統每 5 分鐘寄送 Email。沒有登入或關閉網站仍會提醒；登入、查看成本頁面都不會自動停止。</p>
        <p>按「我已經看到」才會停止該月份提醒，該月費用再增加也不會重新通知；下個月達到警戒線再提醒。外部帳單仍需另行核對。</p>
        {error ? <div className="api-notification-error" role="alert"><p>{error}；目前無法確認通知狀態。</p><button type="button" className="api-refresh" onClick={reload}>重試讀取提醒</button></div> : !data ? <p role="status">通知狀態載入中…</p> : <>
            {notification?.paused && <p role="alert">成本通知排程目前已暫停，請聯絡系統管理員。</p>}
            {notification?.delivery_configured === false && <p role="alert">寄信服務尚未設定完成，目前不會寄出 Email。</p>}
            {configuredElsewhere ? <p>成本提醒已由另一位管理員接收，請由該帳號登入確認。</p> : notification?.is_recipient ? <p className="api-notification-ready" role="status">已啟用：寄到您的管理員帳號 Email，每 5 分鐘提醒一次。</p> : <div><p>尚未指定收件人。按下方按鈕，使用您的管理員帳號 Email 接收提醒。</p><button type="button" className="platform-primary" disabled={busy !== null} onClick={() => mutate("subscribe", () => subscribeCostAlerts(firebaseUser))}>{busy === "subscribe" ? "設定中…" : "使用我的 Email 接收提醒"}</button></div>}
            <div className="api-notification-list">{pending.map(alert => <article className={`api-alert api-alert-${alert.level}`} key={alert.id}>
                <div><strong>{alert.month.slice(0, 7)} {alert.level === "critical" ? "已達月預算" : "已達警戒線"}</strong><p>已追蹤估算 US${Number(alert.cost_usd).toFixed(4)}／月預算 US${Number(alert.monthly_budget_usd).toFixed(2)}；警戒線 {alert.warning_percent}%。</p>
                    {alert.last_error && <p role="alert">上次寄送失敗，排程會在下個 5 分鐘時段重試，請確認帳號 Email 及寄信服務。</p>}
                    {alert.last_sent_at && <p>最近已提交寄送：{new Date(alert.last_sent_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</p>}
                </div>
                <button type="button" className="platform-primary" disabled={busy !== null} onClick={() => mutate(alert.id, () => acknowledgeCostAlert(firebaseUser, alert))}>{busy === alert.id ? "確認中…" : "我已經看到"}</button>
            </article>)}</div>
            {notification?.is_recipient && pending.length === 0 && <p role="status">目前沒有待確認提醒；已確認的提醒不會因重新整理而再次寄送。</p>}
            {pending.length > 0 && <small>已交給寄信服務處理中的 Email 可能仍會抵達；確認後不再排程下一則。</small>}
        </>}
    </section>;
}
