import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { auditLegacyData, backupLegacyData, cleanupLegacyData, listLegacyBackups } from "../../services/legacyCleanupService";
import "./css/Platform.scss";

const CONFIRM_PHRASE = "DELETE FIREBASE LEARNING LOGS";

function LegacyCleanupAdmin() {
    const { firebaseUser } = useAuth();
    const [audit, setAudit] = useState(null);
    const [backups, setBackups] = useState([]);
    const [selected, setSelected] = useState([]);
    const [confirmation, setConfirmation] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState("");
    const loadBackups = useCallback(async () => { if (!firebaseUser) return; try { const result = await listLegacyBackups(firebaseUser); setBackups(result.backups || []); } catch (error) { toast.error(error.message); } }, [firebaseUser]);
    const runAudit = useCallback(async () => { if (!firebaseUser) return; setWorking("audit"); try { const result = await auditLegacyData(firebaseUser); setAudit(result); setSelected([]); toast.success("Firebase 學習資料盤點完成"); } catch (error) { toast.error(error.message || "盤點失敗"); } finally { setWorking(""); setLoading(false); } }, [firebaseUser]);
    useEffect(() => { loadBackups(); runAudit(); }, [loadBackups, runAudit]);
    const selectedRows = useMemo(() => (audit?.students || []).filter(row => selected.includes(row.firebase_uid)), [audit, selected]);
    const toggle = uid => setSelected(current => current.includes(uid) ? current.filter(item => item !== uid) : [...current, uid]);
    const backup = async () => { if (!selected.length) return toast.error("請先選擇帳號"); setWorking("backup"); try { await backupLegacyData(firebaseUser, selected); toast.success("備份完成"); await loadBackups(); } catch (error) { toast.error(error.message); } finally { setWorking(""); } };
    const cleanup = async () => { if (!selected.length) return toast.error("請先選擇帳號"); if (selectedRows.some(row => !row.safe_to_cleanup)) return toast.error("選取項目中有尚未確認 Supabase 進度的帳號，不能清除"); if (confirmation !== CONFIRM_PHRASE) return toast.error("確認文字不正確"); if (!window.confirm(`將備份後清除 ${selected.length} 個帳號的 MusicLogfile 與 BookLogfile。確定繼續嗎？`)) return; setWorking("cleanup"); try { const result = await cleanupLegacyData(firebaseUser, selected, confirmation, false); if (!result.success) throw new Error("部分帳號清除失敗，請查看備份紀錄"); toast.success("舊 Firebase 學習紀錄已備份並清除"); setConfirmation(""); await Promise.all([runAudit(), loadBackups()]); } catch (error) { toast.error(error.message); } finally { setWorking(""); } };
    if (loading) return <div className="platform-loading">Firebase 資料盤點中…</div>;
    return <main className="platform-page"><header className="platform-hero"><div><span className="platform-eyebrow">SAFE MIGRATION</span><h1>舊 Firebase 學習資料清理</h1><p>只有 Supabase 已有學習進度的帳號才可清除；每次清除前都會建立私人備份。</p></div><button className="platform-secondary" onClick={runAudit} disabled={working === "audit"}>重新盤點</button></header><section className="platform-metric-grid"><article><span>Firebase 帳號</span><strong>{audit?.totals?.students || 0}</strong></article><article><span>MusicLogfile</span><strong>{audit?.totals?.music_logs || 0}</strong></article><article><span>BookLogfile</span><strong>{audit?.totals?.book_logs || 0}</strong></article><article className={audit?.totals?.blocked_students ? "budget-over" : "budget-normal"}><span>尚不可清除</span><strong>{audit?.totals?.blocked_students || 0}</strong></article></section><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">AUDIT</span><h2>選擇要處理的帳號</h2></div><span>已選 {selected.length}</span></div><div className="platform-table-wrap"><table className="platform-table"><thead><tr><th></th><th>學生</th><th>舊音樂紀錄</th><th>舊教材紀錄</th><th>Supabase 進度</th><th>安全狀態</th></tr></thead><tbody>{(audit?.students || []).map(row => <tr key={row.firebase_uid}><td><input type="checkbox" checked={selected.includes(row.firebase_uid)} onChange={() => toggle(row.firebase_uid)} /></td><td>{row.name || "未對應"}<small>{row.email || row.firebase_uid}</small></td><td>{row.music_log_count}</td><td>{row.book_log_count}</td><td>{row.supabase_progress_count}</td><td><span className={`platform-safe ${row.safe_to_cleanup ? "yes" : "no"}`}>{row.safe_to_cleanup ? "可備份清除" : "禁止清除"}</span></td></tr>)}</tbody></table></div><div className="platform-cleanup-actions"><button className="platform-secondary" onClick={backup} disabled={!selected.length || working}>只建立備份</button><input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={CONFIRM_PHRASE} /><button className="platform-danger" onClick={cleanup} disabled={!selected.length || confirmation !== CONFIRM_PHRASE || working === "cleanup"}>備份並清除</button></div></section><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">BACKUPS</span><h2>備份與執行紀錄</h2></div></div><div className="platform-list compact">{backups.length === 0 ? <div className="platform-empty">目前沒有備份紀錄。</div> : backups.map(item => <article key={item.id}><div><strong>{item.action} · {item.status}</strong><p>{item.firebase_uid || "整體盤點"}｜{new Date(item.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</p></div>{item.download_url && <a className="platform-secondary" href={item.download_url} target="_blank" rel="noreferrer">下載備份</a>}</article>)}</div></section></main>;
}

export default LegacyCleanupAdmin;
