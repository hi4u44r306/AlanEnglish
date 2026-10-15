import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { listSupportTickets, updateSupportTicket } from "../../services/supportService";
import "./css/Platform.scss";

const LABELS = { open: "待處理", in_progress: "處理中", resolved: "已解決", closed: "已關閉" };

function AdminSupport() {
    const { firebaseUser } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [working, setWorking] = useState(null);
    // 「客服案件」是使用者自己填的；「系統回報」是網站崩潰或載入失敗時自動送來的，分開看才不會被大量系統回報淹沒。
    const [tab, setTab] = useState("customer");

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        setError("");
        try {
            const result = await listSupportTickets(firebaseUser, tab);
            setTickets(result.tickets || []);
            setDrafts(Object.fromEntries((result.tickets || []).map(item => [item.id, { status: item.status, admin_note: item.admin_note || "" }])));
        } catch (loadError) {
            setError(loadError?.message || "客服案件載入失敗");
        } finally {
            setLoading(false);
        }
    }, [firebaseUser, tab]);

    useEffect(() => { load(); }, [load]);

    const save = async id => {
        setWorking(id);
        try {
            await updateSupportTicket(firebaseUser, { id, ...drafts[id] });
            await load();
        } catch (saveError) {
            setError(saveError?.message || "客服案件更新失敗");
        } finally {
            setWorking(null);
        }
    };

    if (loading) return <div className="platform-loading">客服案件載入中…</div>;
    return <main className="platform-page"><header className="platform-hero"><div><span className="platform-eyebrow">SUPPORT ADMIN</span><h1>客服案件</h1><p>查看使用者回報並記錄處理狀態。回覆可使用案件中的 Email。</p></div><button className="platform-secondary" type="button" onClick={load}>重新整理</button></header><div className="platform-support-tabs" role="group" aria-label="案件類型"><button className="platform-secondary" type="button" aria-pressed={tab === "customer"} onClick={() => setTab("customer")}>客服案件</button><button className="platform-secondary" type="button" aria-pressed={tab === "system"} onClick={() => setTab("system")}>系統回報</button></div>{error && <section className="platform-alert" role="alert"><strong>發生問題</strong><p>{error}</p></section>}<section className="platform-card"><div className="platform-list compact">{tickets.length === 0 ? <div className="platform-empty"><strong>{tab === "system" ? "目前沒有系統回報" : "目前沒有客服案件"}</strong></div> : tickets.map(item => { const draft = drafts[item.id] || {}; return <article key={item.id} className="platform-support-ticket"><div><span>#{item.id} · {new Date(item.created_at).toLocaleString("zh-TW")} · {item.category}{item.priority === "urgent" && <strong className="platform-support-urgent"> · 緊急</strong>}</span><h3>{item.subject}</h3><p><strong>{item.requester_name}</strong> · <a href={`mailto:${item.requester_email}`}>{item.requester_email}</a></p><p>{item.message}</p></div><div className="platform-support-actions"><label><span>狀態</span><select value={draft.status || item.status} onChange={event => setDrafts(current => ({ ...current, [item.id]: { ...draft, status: event.target.value } }))}>{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>內部處理備註</span><textarea value={draft.admin_note || ""} onChange={event => setDrafts(current => ({ ...current, [item.id]: { ...draft, admin_note: event.target.value } }))} rows="3" /></label><button className="platform-primary" type="button" onClick={() => save(item.id)} disabled={working === item.id}>{working === item.id ? "儲存中…" : "儲存"}</button></div></article>; })}</div></section></main>;
}

export default AdminSupport;
