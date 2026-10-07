import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiShield } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getAiCostDashboard, updateAiCostBudget } from "../../services/aiMaterialService";
import CostAlertPanel from "./CostAlertPanel";
import ServiceCostCard from "./ServiceCostCard";
import { getServiceCostDashboard } from "../../services/costAlertService";
import "./css/Platform.scss";
import "./css/ApiUsageAdmin.scss";

const currentTaiwanMonth = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Taipei" }).format(new Date());
const money = value => Number(value || 0).toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const alertIcon = level => level === "success" ? <FiCheckCircle /> : <FiAlertTriangle />;

function BudgetProgress({ budget }) {
    const usedPercent = Number(budget?.used_percent || 0);
    const displayPercent = Math.min(100, Math.max(0, usedPercent));
    const status = usedPercent >= 100 ? "critical" : usedPercent >= Number(budget?.warning_percent || 80) ? "warning" : "normal";

    return <section className={`api-budget api-budget-${status}`} aria-labelledby="api-budget-title">
        <div className="api-budget-copy"><span className="platform-eyebrow">MONTHLY CONTROL</span><h2 id="api-budget-title">本月預算使用 {money(usedPercent)}%</h2><p>警示門檻 {budget?.warning_percent || 80}%</p></div>
        <div className="api-budget-track" role="progressbar" aria-label="本月網站預算使用率" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.max(0, Math.min(100, Math.round(usedPercent)))}><span style={{ width: `${displayPercent}%` }} /></div>
        <div className="api-budget-scale"><span>US$0</span><span>警示 {budget?.warning_percent || 80}%</span><span>預算 US${money(budget?.monthly_budget_usd)}</span></div>
    </section>;
}

function DailyTrend({ rows = [] }) {
    const maxCost = Math.max(...rows.map(row => Number(row.cost_usd || 0)), 0.000001);
    const visibleRows = rows.slice(-31);
    return <div className="api-trend" aria-label="每日估算費用趨勢">{visibleRows.length === 0 ? <p className="api-empty">這個月份還沒有已追蹤的 API 使用紀錄。</p> : visibleRows.map(row => {
        const height = Math.max(5, (Number(row.cost_usd || 0) / maxCost) * 100);
        return <div className="api-trend-day" key={row.date} title={`${row.date} · US$ ${money(row.cost_usd)} · ${row.requests} 次`}><span className="api-trend-value">{row.requests}</span><span className="api-trend-bar" style={{ height: `${height}%` }} /><small>{row.date.slice(8)}</small></div>;
    })}</div>;
}

function ApiUsageAdmin() {
    const { firebaseUser } = useAuth();
    const [month, setMonth] = useState(currentTaiwanMonth());
    const [data, setData] = useState(null);
    const [budget, setBudget] = useState({ monthly_budget_usd: 10, warning_percent: 80, usd_to_twd_rate: 33 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState("all");
    const [loadError, setLoadError] = useState("");
    const version = useRef(0);

    const load = useCallback(async (silent = false) => {
        const requestVersion = ++version.current;
        if (!firebaseUser) return;
        if (!silent) setLoading(true);
        try {
            const [local, unified] = await Promise.all([getAiCostDashboard(firebaseUser, month), getServiceCostDashboard(firebaseUser, month)]);
            if (requestVersion !== version.current) return;
            const result = { ...local, ...unified, summary: { ...local.summary, ...unified.summary }, alerts: (local.alerts || []).filter(alert => !["budget_over", "budget_warning", "forecast_over"].includes(alert.code)) };
            if (unified.budget.used_percent >= unified.budget.warning_percent) result.alerts.push({ level: unified.budget.used_percent >= 100 ? "critical" : "warning", code: "unified_budget", title: "網站總成本已達警戒線", message: `已知費用已使用 ${money(unified.budget.used_percent)}% 月預算。` });
            for (const provider of unified.providers) for (const metric of provider.metrics || []) {
                if (provider.enabled && metric.limit !== null && metric.used > 0 && metric.used >= metric.limit * unified.budget.warning_percent / 100) result.alerts.push({ level: metric.used >= metric.limit ? 'critical' : 'warning', code: `${provider.id}-${metric.name}`, title: `${provider.name} 用量接近額度`, message: `${metric.name}：${metric.used} / ${metric.limit} ${metric.unit}。` });
            }
            setData(result); setLoadError("");
            if (!silent) setBudget({ monthly_budget_usd: result.budget.monthly_budget_usd, warning_percent: result.budget.warning_percent, usd_to_twd_rate: result.budget.usd_to_twd_rate });
        } catch (error) { if (requestVersion === version.current) setLoadError(error.message || "網站成本資料讀取失敗"); }
        finally { if (requestVersion === version.current) setLoading(false); }
    }, [firebaseUser, month]);

    useEffect(() => { setData(null); load(); const timer = setInterval(() => load(true), 60000); return () => { clearInterval(timer); version.current += 1; }; }, [load]);

    const [alertRefresh, setAlertRefresh] = useState(0);
    const saveBudget = async event => {
        event.preventDefault();
        setSaving(true);
        try { await updateAiCostBudget(firebaseUser, budget); toast.success("網站總預算已更新"); setAlertRefresh(value => value + 1); await load(); }
        catch (error) { toast.error(error.message || "預算儲存失敗"); }
        finally { setSaving(false); }
    };

    const summary = data?.summary || {};
    const providers = useMemo(() => {
        const rows = data?.providers || [];
        return filter === "all" ? rows : rows.filter(provider => provider.coverage === filter);
    }, [data, filter]);
    const criticalAlerts = (data?.alerts || []).filter(alert => alert.level !== "success").length;

    return <main className="platform-page api-usage-page"><header className="platform-hero api-hero"><div><span className="platform-eyebrow">COST CONTROL CENTER</span><h1>網站成本與服務用量</h1><p>統整資料庫、登入、AI、語音、寄信、主機與交易費用。後端持續監測；頁面每分鐘刷新，供應商帳務依更新速度核對。</p></div><div className="api-hero-actions"><label><span className="sr-only">查詢月份</span><input className="platform-month" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label><button type="button" className="api-refresh" onClick={() => load()} disabled={loading}><FiRefreshCw className={loading ? "is-spinning" : ""} />重新整理</button></div></header>{loadError && <p className="api-service-gap" role="alert">{loadError}{data ? "；目前顯示上次成功資料。" : "；尚無可用成本資料。"}</p>}{loading ? <div className="platform-loading">成本資料載入中…</div> : data && <>
        {data.monitoring_paused && <p className="api-service-gap" role="alert">背景服務帳務更新已暫停，目前顯示保留資料。</p>}
        <section className="api-overview" aria-label="本月成本摘要"><article className="api-overview-primary"><span>本月已知成本合計</span><strong>US$ {money(summary.total_cost_usd)}</strong><small>約 NT$ {money(summary.total_cost_twd)}</small></article><article className={summary.incomplete_services > 0 ? "has-alert" : "is-healthy"}><span>帳務資料缺口</span><strong>{summary.incomplete_services}</strong><small>{summary.incomplete_services > 0 ? "項服務尚有未取得或過期費用" : "已設定服務均有資料"}</small></article><article><span>追蹤請求</span><strong>{Number(summary.total_requests || 0).toLocaleString("zh-TW")}</strong><small>成功率 {summary.success_rate || 0}%</small></article><article className={criticalAlerts > 0 ? "has-alert" : "is-healthy"}><span>需要注意</span><strong>{criticalAlerts}</strong><small>{criticalAlerts > 0 ? "項成本或使用異常" : "目前沒有明顯異常"}</small></article></section>
        <p className="api-chart-note">此合計是已知費用；缺少資料不代表免費。固定月費、估算及供應商資料可能有不同結帳週期，服務卡片列出範圍與更新時間。</p>
        <BudgetProgress budget={data?.budget} />
        <CostAlertPanel key={alertRefresh} firebaseUser={firebaseUser} />
        <section className="api-alert-section" aria-labelledby="api-alert-title"><div className="platform-section-title"><div><span className="platform-eyebrow">ALERTS</span><h2 id="api-alert-title">系統提醒</h2></div><FiShield /></div><div className="api-alert-list">{(data?.alerts || []).map(alert => <article className={`api-alert api-alert-${alert.level}`} key={alert.code}>{alertIcon(alert.level)}<div><strong>{alert.title}</strong><p>{alert.message}</p></div></article>)}</div></section>
        <div className="api-dashboard-grid"><section className="platform-card api-trend-card"><div className="platform-section-title"><div><span className="platform-eyebrow">DAILY TREND</span><h2>AI／TTS 每日用量</h2></div><FiActivity /></div><DailyTrend rows={data?.daily || []} /><p className="api-chart-note">此圖只顯示網站已記錄的 AI／TTS 每日估算，未包含供應商帳單、月費與交易手續費。</p></section><section className="platform-card api-settings-card"><div className="platform-section-title"><div><span className="platform-eyebrow">BUDGET</span><h2>預算警示設定</h2></div></div><form className="api-budget-form" onSubmit={saveBudget}><label><span>每月總預算（USD）</span><input type="number" min="1" max="10000" step="0.01" value={budget.monthly_budget_usd} onChange={event => setBudget(current => ({ ...current, monthly_budget_usd: event.target.value }))} /></label><label><span>警示門檻（%）</span><input type="number" min="50" max="100" value={budget.warning_percent} onChange={event => setBudget(current => ({ ...current, warning_percent: Number(event.target.value) }))} /></label><label><span>美元換台幣</span><input type="number" min="20" max="50" step="0.01" value={budget.usd_to_twd_rate} onChange={event => setBudget(current => ({ ...current, usd_to_twd_rate: event.target.value }))} /></label><button className="platform-primary" disabled={saving}>{saving ? "儲存中…" : "儲存設定"}</button></form></section></div>
        <section className="platform-card api-provider-section"><div className="platform-section-title api-provider-section-title"><div><span className="platform-eyebrow">SERVICES</span><h2>可能產生費用的服務</h2><p>服務帳務與用量集中於此；未接通、更新失敗、過期或尚有超額費用缺口都會列出。</p></div><div className="platform-segment" aria-label="服務篩選">{[{ id: "all", label: "全部" }, { id: "tracked", label: "費用已取得" }, { id: "external", label: "需補資料" }].map(option => <button type="button" className={filter === option.id ? "active" : ""} onClick={() => setFilter(option.id)} key={option.id}>{option.label}</button>)}</div></div><div className="api-provider-grid">{providers.map(provider => <ServiceCostCard key={`${month}-${provider.id}`} provider={provider} firebaseUser={firebaseUser} month={month} onSaved={load} />)}</div></section>
        <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">RECENT OPENAI MATERIALS</span><h2>最近 AI 教材請求</h2></div></div><div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>時間</th><th>使用者</th><th>模型</th><th>狀態</th><th>Token</th><th>成本</th></tr></thead><tbody>{(data?.recent || []).map(row => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</td><td>{row.name}</td><td>{row.model}</td><td>{row.request_status}</td><td>{Number(row.total_tokens || 0).toLocaleString()}</td><td>US$ {money(row.estimated_cost_usd)}</td></tr>)}</tbody></table></div></section>
    </>}</main>;
}

export default ApiUsageAdmin;
