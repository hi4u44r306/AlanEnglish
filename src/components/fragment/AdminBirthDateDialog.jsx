import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { correctManagedBirthDate, getManagedBirthDateHistory } from "../../services/membershipService";

export default function AdminBirthDateDialog({ account, onClose, onSaved }) {
    const { firebaseUser } = useAuth();
    const [currentDate, setCurrentDate] = useState(null);
    const [date, setDate] = useState("");
    const [reason, setReason] = useState("");
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const busy = useRef(false);
    const mounted = useRef(true);
    const dialog = useRef(null);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

    const reload = useCallback(async () => {
        setLoading(true); setLoaded(false); setError(""); setSuccess("");
        try {
            const result = await getManagedBirthDateHistory(firebaseUser, Number(account.id));
            if (!mounted.current) return;
            setCurrentDate(result.student.date_of_birth || null);
            setDate(result.student.date_of_birth || "");
            setHistory(result.history || []); setLoaded(true);
        } catch (failure) {
            if (mounted.current) setError(failure.message || "生日資料讀取失敗");
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, [account.id, firebaseUser]);

    useEffect(() => {
        mounted.current = true;
        reload();
        return () => { mounted.current = false; };
    }, [reload]);
    useEffect(() => {
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog.current?.focus();
        const keydown = event => {
            if (event.key === "Escape" && !busy.current) { event.preventDefault(); onClose(); }
            if (event.key !== "Tab") return;
            const nodes = Array.from(dialog.current?.querySelectorAll("button, input, textarea") || []).filter(node => !node.disabled);
            if (!nodes.length) { event.preventDefault(); dialog.current?.focus(); return; }
            const first = nodes[0]; const last = nodes[nodes.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
                event.preventDefault(); first.focus();
            }
        };
        document.addEventListener("keydown", keydown);
        return () => {
            document.removeEventListener("keydown", keydown);
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [onClose]);

    const save = async event => {
        event.preventDefault();
        if (busy.current || !loaded || !date || date === currentDate || (reason.trim().length < 2 || reason.trim().length > 500)) return;
        busy.current = true; setSaving(true); setError(""); setSuccess("");
        try {
            const result = await correctManagedBirthDate(firebaseUser, {
                student_id: Number(account.id), expected_date_of_birth: currentDate, date_of_birth: date, reason: reason.trim()
            });
            if (!mounted.current) return;
            setCurrentDate(result.student.date_of_birth); setDate(result.student.date_of_birth); setReason("");
            setHistory(items => [result.history_entry, ...items].slice(0, 20));
            setSuccess("生日已更正並保存紀錄；已領生日禮不會重發。");
            onSaved(result.student);
        } catch (failure) {
            if (!mounted.current) return;
            setError(failure.message || "生日更正失敗");
            if (failure.code === "BIRTH_DATE_CHANGED" || failure.status === 409) setLoaded(false);
        } finally {
            busy.current = false;
            if (mounted.current) setSaving(false);
        }
    };

    return <div className="management-delete-backdrop">
        <section ref={dialog} className="management-delete-dialog management-birth-date-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-birth-date-title" tabIndex={-1}>
            <h2 id="admin-birth-date-title">更正生日</h2>
            <p><strong>{account.name || "學生"}</strong> · 目前生日：{loading ? "讀取中…" : currentDate || "尚未設定"}</p>
            <p>更正後按新生日判定活動。每年生日禮仍限一次，已領點數不補發或追回。</p>
            {error && <p role="alert">{error}</p>}
            {success && <p role="status">{success}</p>}
            <form onSubmit={save}>
                <label><span>新的出生年月日</span><input type="date" min="1900-01-01" max={today} value={date} onChange={event => { setDate(event.target.value); setSuccess(""); }} required disabled={!loaded || saving} /></label>
                <label><span>更正原因（2～500 字）</span><textarea value={reason} onChange={event => setReason(event.target.value)} minLength={2} maxLength={500} required disabled={!loaded || saving} /></label>
                {loaded && date && date !== currentDate && <p>確認更正：{currentDate || "尚未設定"} → {date}</p>}
                <div className="management-delete-dialog__actions">
                    <button type="button" onClick={onClose} disabled={saving}>關閉</button>
                    <button type="button" onClick={reload} disabled={loading || saving}>重新讀取資料</button>
                    <button type="submit" disabled={!loaded || saving || !date || date === currentDate || (reason.trim().length < 2 || reason.trim().length > 500)}>{saving ? "儲存中…" : "確認更正並保存"}</button>
                </div>
            </form>
            <h3>最近 20 筆更正紀錄</h3>
            {history.length ? <ol className="management-birth-date-history">{history.map(item => <li key={item.id}>
                <strong>{item.previous_date_of_birth || "尚未設定"} → {item.new_date_of_birth}</strong>
                <p>{item.reason}</p>
                <small>{new Date(item.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })} · {item.admin_id ? `管理員 #${item.admin_id}` : "已刪除的管理員"}</small>
            </li>)}</ol> : <p>{loading ? "正在讀取紀錄…" : loaded ? "目前沒有更正紀錄" : "紀錄尚未載入"}</p>}
        </section>
    </div>;
}
