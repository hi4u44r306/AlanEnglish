import React, { useEffect, useRef, useState } from "react";
import { addPendingReport, flushPendingReports, removePendingReport } from "./pendingReport";
import { buildPayload, sendSystemReport } from "./reportClient";
import { clearSystemReport, subscribeReport } from "./reportBus";
import { canUserReload, markReloadPending } from "./reloadGuard";
import { saveResume } from "./resume";
import "./SystemReportHost.scss";

const COPY = {
    render_crash: "這一頁剛剛出了狀況。按「回報並重新整理」，系統會把問題告訴後台，然後回到同一頁。",
    chunk_load: "網站有些內容沒有載入成功。按「回報並重新整理」，系統會把問題告訴後台，然後回到同一頁。",
    service_failure: "目前連線好像不太順。你可以回報給後台，或重新整理再試一次。",
    manual: "把遇到的問題告訴後台，我們會盡快處理。"
};

const pauseAllAudio = () => {
    let wasPlaying = false;
    document.querySelectorAll("audio").forEach(audio => {
        if (!audio.paused && !audio.ended) wasPlaying = true;
        try { audio.pause(); } catch (error) { /* 忽略 */ }
    });
    return wasPlaying;
};

// 不依賴 AuthContext、Router、Theme：即使它們出錯也能顯示。
export default function SystemReportHost() {
    const [report, setReport] = useState(null);
    const [note, setNote] = useState("");
    const [sending, setSending] = useState(false);
    const [wasListening, setWasListening] = useState(false);
    const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
    const [reloadAllowed, setReloadAllowed] = useState(true);
    const firstButton = useRef(null);

    useEffect(() => subscribeReport(next => {
        setReport(next);
        if (next) {
            setNote("");
            setSending(false);
            setReloadAllowed(canUserReload());
            setWasListening(pauseAllAudio());
        }
    }), []);

    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
    }, []);

    // 上次回報沒送成功的，開啟網站幾秒後補送一次。
    useEffect(() => {
        const timer = window.setTimeout(() => flushPendingReports(payload => sendSystemReport(payload)), 4000);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => { if (report) firstButton.current?.focus(); }, [report]);

    if (!report) return null;

    const reloadNow = () => {
        markReloadPending(false, report.kind);
        saveResume();
        window.location.reload();
    };

    const submitAndReload = async () => {
        if (sending) return;
        setSending(true);
        const payload = buildPayload(report, note);
        addPendingReport(payload);
        if (await sendSystemReport(payload)) removePendingReport(payload.report_id);
        // 回報成不成功都不能擋住使用者重新整理。
        if (online && reloadAllowed) reloadNow();
        else { setSending(false); clearSystemReport(); }
    };

    const canReload = online && reloadAllowed;
    const onKeyDown = event => { if (event.key === "Escape" && report.kind !== "render_crash") clearSystemReport(); };

    return (
        <div className="ae-report-overlay" onKeyDown={onKeyDown}>
            <div className="ae-report-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ae-report-title" aria-describedby="ae-report-body">
                <h2 id="ae-report-title">遇到問題了</h2>
                <p id="ae-report-body">{COPY[report.kind] || COPY.manual}</p>
                {wasListening && <p className="ae-report-note">目前這一首已先暫停，重新整理後要重新聽才會計次。</p>}
                {!online && <p className="ae-report-warn" role="status">網路好像中斷了，等連線恢復後再重新整理。回報會先保存，下次開啟網站時自動補送。</p>}
                {online && !reloadAllowed && <p className="ae-report-warn" role="status">這個問題重新整理後還是出現。請先回首頁，或聯絡客服。</p>}
                <label className="ae-report-field">
                    <span>你剛剛在做什麼？（選填）</span>
                    <textarea value={note} onChange={event => setNote(event.target.value.slice(0, 200))} rows={3} maxLength={200} placeholder="例如：按下一題就變白畫面" />
                    <small>請不要填密碼或家長的個人資料。</small>
                </label>
                <div className="ae-report-actions">
                    {canReload ? (
                        <>
                            <button ref={firstButton} type="button" className="ae-report-primary" onClick={submitAndReload} disabled={sending}>{sending ? "送出中…" : "回報並重新整理"}</button>
                            <button type="button" className="ae-report-secondary" onClick={reloadNow} disabled={sending}>只重新整理</button>
                        </>
                    ) : (
                        <>
                            <button ref={firstButton} type="button" className="ae-report-primary" onClick={async () => { setSending(true); const payload = buildPayload(report, note); addPendingReport(payload); if (await sendSystemReport(payload)) removePendingReport(payload.report_id); setSending(false); clearSystemReport(); }} disabled={sending}>{sending ? "送出中…" : "只送出回報"}</button>
                            <a className="ae-report-secondary" href="/">回首頁</a>
                            <a className="ae-report-secondary" href="/support">聯絡客服</a>
                        </>
                    )}
                    {report.kind !== "render_crash" && <button type="button" className="ae-report-link" onClick={clearSystemReport}>稍後</button>}
                    {report.kind === "render_crash" && canReload && <a className="ae-report-link" href="/">回首頁</a>}
                </div>
            </div>
        </div>
    );
}
