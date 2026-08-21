import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getAiCostDashboard, updateAiCostBudget } from "../../services/aiMaterialService";
import "./css/Platform.scss";

const currentTaiwanMonth = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Taipei" }).format(new Date());
const money = value => Number(value || 0).toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function ApiUsageAdmin() {
    const { firebaseUser } = useAuth();
    const [month, setMonth] = useState(currentTaiwanMonth());
    const [data, setData] = useState(null);
    const [budget, setBudget] = useState({ monthly_budget_usd: 10, warning_percent: 80, usd_to_twd_rate: 33 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
    return <main className="platform-page"><header className="platform-hero"><div><span className="platform-eyebrow">OPENAI COST CONTROL</span><h1>API 使用量與費用</h1><p>每次 AI 教材請求都記錄 Token 與估算成本，不儲存 API Key 或完整 Prompt。</p></div><input className="platform-month" type="month" value={month} onChange={event => setMonth(event.target.value)} /></header>{loading ? <div className="platform-loading">成本資料載入中…</div> : <><section className="platform-metric-grid"><article><span>本月估算</span><strong>US$ {money(summary.total_cost_usd)}</strong><small>約 NT$ {money(summary.total_cost_twd)}</small></article><article><span>API 請求</span><strong>{summary.total_requests || 0}</strong><small>成功率 {summary.success_rate || 0}%</small></article><article><span>Token</span><strong>{Number(summary.total_tokens || 0).toLocaleString()}</strong><small>輸入 {Number(summary.input_tokens || 0).toLocaleString()}／輸出 {Number(summary.output_tokens || 0).toLocaleString()}</small></article><article className={`budget-${data?.budget?.status}`}><span>預算使用</span><strong>{data?.budget?.used_percent || 0}%</strong><small>每月 US$ {money(data?.budget?.monthly_budget_usd)}</small></article></section><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">BUDGET</span><h2>預算警示設定</h2></div></div><form className="platform-form-grid platform-compact-form" onSubmit={saveBudget}><label><span>每月預算（USD）</span><input type="number" min="1" max="10000" step="0.01" value={budget.monthly_budget_usd} onChange={event => setBudget(current => ({ ...current, monthly_budget_usd: event.target.value }))} /></label><label><span>警示門檻（%）</span><input type="number" min="50" max="100" value={budget.warning_percent} onChange={event => setBudget(current => ({ ...current, warning_percent: Number(event.target.value) }))} /></label><label><span>美元換台幣</span><input type="number" min="20" max="50" step="0.01" value={budget.usd_to_twd_rate} onChange={event => setBudget(current => ({ ...current, usd_to_twd_rate: event.target.value }))} /></label><button className="platform-primary" disabled={saving}>{saving ? "儲存中…" : "儲存設定"}</button></form></section><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">USERS</span><h2>使用者生成量</h2></div></div><div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>使用者</th><th>角色</th><th>請求</th><th>Token</th><th>估算成本</th></tr></thead><tbody>{(data?.users || []).map(user => <tr key={user.student_id}><td>{user.name}</td><td>{user.role}</td><td>{user.requests}</td><td>{Number(user.total_tokens || 0).toLocaleString()}</td><td>US$ {money(user.cost_usd)}</td></tr>)}</tbody></table></div></section><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">RECENT</span><h2>最近請求</h2></div></div><div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>時間</th><th>使用者</th><th>模型</th><th>狀態</th><th>Token</th><th>成本</th></tr></thead><tbody>{(data?.recent || []).map(row => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</td><td>{row.name}</td><td>{row.model}</td><td>{row.request_status}</td><td>{Number(row.total_tokens || 0).toLocaleString()}</td><td>US$ {money(row.estimated_cost_usd)}</td></tr>)}</tbody></table></div></section></>}</main>;
}

export default ApiUsageAdmin;
