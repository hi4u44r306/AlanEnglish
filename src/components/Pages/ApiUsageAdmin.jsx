import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiChevronDown, FiExternalLink, FiRefreshCw, FiShield } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getAiCostDashboard, updateAiCostBudget } from "../../services/aiMaterialService";
import "./css/Platform.scss";
import "./css/ApiUsageAdmin.scss";

const currentTaiwanMonth = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Taipei" }).format(new Date());
const money = value => Number(value || 0).toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const compact = value => new Intl.NumberFormat("zh-TW", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));

const usageLabel = provider => {
    if (provider.usage_unit === "tokens") return `${compact(provider.usage_value)} Token`;
    if (provider.usage_unit === "characters") return `${Number(provider.usage_value || 0).toLocaleString("zh-TW")} 字元`;
    return "尚未自動計量";
};

const alertIcon = level => level === "success" ? <FiCheckCircle /> : <FiAlertTriangle />;

function BudgetProgress({ budget, projectedPercent }) {
    const usedPercent = Number(budget?.used_percent || 0);
    const displayPercent = Math.min(100, Math.max(0, usedPercent));
    const status = usedPercent >= 100 ? "critical" : usedPercent >= Number(budget?.warning_percent || 80) ? "warning" : "normal";

    return <section className={`api-budget api-budget-${status}`} aria-labelledby="api-budget-title">
        <div className="api-budget-copy"><span className="platform-eyebrow">MONTHLY CONTROL</span><h2 id="api-budget-title">本月預算使用 {money(usedPercent)}%</h2><p>警示門檻 {budget?.warning_percent || 80}% · 月底預估 {money(projectedPercent)}%</p></div>
        <div className="api-budget-track" role="progressbar" aria-label="本月 API 預算使用率" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, Math.round(usedPercent))}><span style={{ width: `${displayPercent}%` }} /></div>
        <div className="api-budget-scale"><span>US$0</span><span>警示 {budget?.warning_percent || 80}%</span><span>預算 US${money(budget?.monthly_budget_usd)}</span></div>
    </section>;
}

function ProviderCard({ provider, expanded, onToggle, exchangeRate }) {
    const tracked = provider.coverage === "tracked";
    const settledRequests = Number(provider.successful_requests || 0) + Number(provider.failed_requests || 0);
    const pendingRequests = Math.max(0, Number(provider.requests || 0) - settledRequests);
    const successRate = settledRequests > 0 ? Math.round((Number(provider.successful_requests || 0) / settledRequests) * 100) : 100;
    return <article className={`api-provider-card ${tracked ? "is-tracked" : "is-external"}`}>
        <button type="button" className="api-provider-head" onClick={onToggle} aria-expanded={expanded}>
            <span className={`api-provider-dot ${tracked ? "tracked" : "external"}`} aria-hidden="true" />
            <span className="api-provider-title"><strong>{provider.name}</strong><small>{provider.category}</small></span>
            <span className={`api-coverage ${tracked ? "tracked" : "external"}`}>{tracked ? "自動追蹤" : "外部核對"}</span>
            <FiChevronDown className={expanded ? "is-open" : ""} />
        </button>
        <div className="api-provider-summary"><div><span>本月用量</span><strong>{usageLabel(provider)}</strong></div><div><span>{tracked ? "估算費用" : "平台內費用"}</span><strong>{tracked ? `US$ ${money(provider.estimated_cost_usd)}` : "未取得"}</strong></div><div><span>{tracked ? "成功率" : "追蹤方式"}</span><strong>{tracked ? `${successRate}%` : "供應商帳單"}</strong></div></div>
        {expanded && <div className="api-provider-detail"><p>{provider.note}</p>{tracked && <div className="api-provider-facts"><span>請求 {Number(provider.requests || 0).toLocaleString("zh-TW")}</span><span>失敗 {Number(provider.failed_requests || 0).toLocaleString("zh-TW")}</span>{pendingRequests > 0 && <span>處理中 {pendingRequests.toLocaleString("zh-TW")}</span>}<span>約 NT$ {money(Number(provider.estimated_cost_usd || 0) * Number(exchangeRate || 33))}</span></div>}{provider.dashboard_url && <a href={provider.dashboard_url} target="_blank" rel="noreferrer">開啟供應商控制台 <FiExternalLink /></a>}</div>}
    </article>;
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
    const [expandedProvider, setExpandedProvider] = useState("openai_materials");

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try {
            const result = await getAiCostDashboard(firebaseUser, month);
            setData(result);
            setBudget({ monthly_budget_usd: result.budget.monthly_budget_usd, warning_percent: result.budget.warning_percent, usd_to_twd_rate: result.budget.usd_to_twd_rate });
        } catch (error) { toast.error(error.message || "API 成本資料讀取失敗"); }
        finally { setLoading(false); }
    }, [firebaseUser, month]);

    useEffect(() => { load(); }, [load]);

    const saveBudget = async event => {
        event.preventDefault();
        setSaving(true);
        try { await updateAiCostBudget(firebaseUser, budget); toast.success("API 預算已更新"); await load(); }
        catch (error) { toast.error(error.message || "預算儲存失敗"); }
        finally { setSaving(false); }
    };

    const summary = data?.summary || {};
    const providers = useMemo(() => {
        const rows = data?.providers || [];
        return filter === "all" ? rows : rows.filter(provider => provider.coverage === filter);
    }, [data, filter]);
    const criticalAlerts = (data?.alerts || []).filter(alert => alert.level !== "success").length;

    return <main className="platform-page api-usage-page"><header className="platform-hero api-hero"><div><span className="platform-eyebrow">COST CONTROL CENTER</span><h1>API 使用量與費用</h1><p>集中查看可自動追蹤的用量、月底預估與異常；外部帳單會清楚標示，不把未知費用當成零元。</p></div><div className="api-hero-actions"><label><span className="sr-only">查詢月份</span><input className="platform-month" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label><button type="button" className="api-refresh" onClick={load} disabled={loading}><FiRefreshCw className={loading ? "is-spinning" : ""} />重新整理</button></div></header>{loading ? <div className="platform-loading">成本資料載入中…</div> : <>
        <section className="api-overview" aria-label="本月成本摘要"><article className="api-overview-primary"><span>本月已追蹤估算</span><strong>US$ {money(summary.total_cost_usd)}</strong><small>約 NT$ {money(summary.total_cost_twd)}</small></article><article><span>月底預估</span><strong>US$ {money(summary.projected_cost_usd ?? summary.total_cost_usd)}</strong><small>約 NT$ {money(summary.projected_cost_twd ?? summary.total_cost_twd)}</small></article><article><span>追蹤請求</span><strong>{Number(summary.total_requests || 0).toLocaleString("zh-TW")}</strong><small>成功率 {summary.success_rate || 0}%</small></article><article className={criticalAlerts > 0 ? "has-alert" : "is-healthy"}><span>需要注意</span><strong>{criticalAlerts}</strong><small>{criticalAlerts > 0 ? "項成本或使用異常" : "目前沒有明顯異常"}</small></article></section>
        <BudgetProgress budget={data?.budget} projectedPercent={summary.projected_percent || data?.budget?.used_percent || 0} />
        <section className="api-alert-section" aria-labelledby="api-alert-title"><div className="platform-section-title"><div><span className="platform-eyebrow">ALERTS</span><h2 id="api-alert-title">系統提醒</h2></div><FiShield /></div><div className="api-alert-list">{(data?.alerts || []).map(alert => <article className={`api-alert api-alert-${alert.level}`} key={alert.code}>{alertIcon(alert.level)}<div><strong>{alert.title}</strong><p>{alert.message}</p></div></article>)}</div></section>
        <div className="api-dashboard-grid"><section className="platform-card api-trend-card"><div className="platform-section-title"><div><span className="platform-eyebrow">DAILY TREND</span><h2>每日用量</h2></div><FiActivity /></div><DailyTrend rows={data?.daily || []} /><p className="api-chart-note">柱狀高度代表每日估算費用，柱上數字為請求次數。</p></section><section className="platform-card api-settings-card"><div className="platform-section-title"><div><span className="platform-eyebrow">BUDGET</span><h2>預算警示設定</h2></div></div><form className="api-budget-form" onSubmit={saveBudget}><label><span>每月總預算（USD）</span><input type="number" min="1" max="10000" step="0.01" value={budget.monthly_budget_usd} onChange={event => setBudget(current => ({ ...current, monthly_budget_usd: event.target.value }))} /></label><label><span>警示門檻（%）</span><input type="number" min="50" max="100" value={budget.warning_percent} onChange={event => setBudget(current => ({ ...current, warning_percent: Number(event.target.value) }))} /></label><label><span>美元換台幣</span><input type="number" min="20" max="50" step="0.01" value={budget.usd_to_twd_rate} onChange={event => setBudget(current => ({ ...current, usd_to_twd_rate: event.target.value }))} /></label><button className="platform-primary" disabled={saving}>{saving ? "儲存中…" : "儲存設定"}</button></form></section></div>
        <section className="platform-card api-provider-section"><div className="platform-section-title api-provider-section-title"><div><span className="platform-eyebrow">SERVICES</span><h2>可能產生費用的服務</h2><p>「自動追蹤」為平台可估算資料；「外部核對」必須以供應商帳單為準。</p></div><div className="platform-segment" aria-label="服務篩選">{[{ id: "all", label: "全部" }, { id: "tracked", label: "自動追蹤" }, { id: "external", label: "外部核對" }].map(option => <button type="button" className={filter === option.id ? "active" : ""} onClick={() => setFilter(option.id)} key={option.id}>{option.label}</button>)}</div></div><div className="api-provider-grid">{providers.map(provider => <ProviderCard key={provider.id} provider={provider} expanded={expandedProvider === provider.id} onToggle={() => setExpandedProvider(current => current === provider.id ? null : provider.id)} exchangeRate={data?.budget?.usd_to_twd_rate} />)}</div></section>
        <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">RECENT OPENAI MATERIALS</span><h2>最近 AI 教材請求</h2></div></div><div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>時間</th><th>使用者</th><th>模型</th><th>狀態</th><th>Token</th><th>成本</th></tr></thead><tbody>{(data?.recent || []).map(row => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</td><td>{row.name}</td><td>{row.model}</td><td>{row.request_status}</td><td>{Number(row.total_tokens || 0).toLocaleString()}</td><td>US$ {money(row.estimated_cost_usd)}</td></tr>)}</tbody></table></div></section>
    </>}</main>;
}

export default ApiUsageAdmin;
