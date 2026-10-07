import React, { useState } from 'react';
import { saveServiceCost } from '../../services/costAlertService';
const money = n => Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 4 });
const time = value => value ? new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '尚未取得';
const errors = { missing_configuration: '尚未接通帳務權限', invalid_configuration: '帳務設定需修正', test_mode_only: '目前只有測試模式，未計入真實費用', unsupported_currency: '幣別尚未支援，金額未計入', historical_usage_unavailable: '供應商未提供歷史用量', incomplete_pagination: '資料不完整，保留上次資料', incomplete_query: '查詢尚未完成，保留上次資料' };
export default function ServiceCostCard({ provider, firebaseUser, month, onSaved }) {
    const [editing, setEditing] = useState(false);
    const [fixed, setFixed] = useState(provider.fixed_monthly_usd ?? '');
    const [total, setTotal] = useState(provider.source === 'manual' ? provider.reported_cost_usd ?? '' : '');
    const [enabled, setEnabled] = useState(provider.enabled);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const known = provider.reported_cost_usd !== null || provider.local_cost_usd !== null || provider.fixed_monthly_usd !== null;
    const basis = !provider.enabled ? '不列入總計' : provider.error_code ? errors[provider.error_code] || '資料更新失敗，保留上次資料' : provider.stale ? '資料已過期，等待更新' : provider.source === 'manual' ? '本月自行登錄總額' : provider.reported_cost_usd !== null ? '已取得供應商費用（可能延遲）' : provider.local_cost_usd !== null ? '網站估算／仍有帳務缺口' : '帳單金額尚未取得';
    const save = async event => {
        event.preventDefault(); setBusy(true); setError('');
        try {
            await saveServiceCost(firebaseUser, { provider_id: provider.id, month, fixed_monthly_usd: fixed === '' ? null : Number(fixed), month_total_usd: total === '' ? null : Number(total), enabled });
            setEditing(false); await onSaved();
        } catch (e) { setError(e.message || '設定儲存失敗'); } finally { setBusy(false); }
    };
    return <article className={`api-service-card ${provider.incomplete || provider.error_code || provider.stale ? 'has-gap' : ''}`}>
        <div className="api-service-heading"><div><h3>{provider.name}</h3><small>{provider.category}</small></div><strong>{provider.enabled && known ? `US$ ${money(provider.known_cost_usd)}` : '—'}</strong></div>
        <p className="api-service-basis">{basis}</p><p>{provider.note}</p>
        {provider.incomplete && provider.enabled && <p className="api-service-gap">總計只包含目前已知費用，尚有未取得金額。</p>}
        <dl><div><dt>帳務／用量更新</dt><dd>{time(provider.collected_at)}</dd></div>{provider.attempted_at && <div><dt>最近嘗試</dt><dd>{time(provider.attempted_at)}</dd></div>}{provider.fixed_monthly_usd !== null && <div><dt>固定月費／攤提</dt><dd>US$ {money(provider.fixed_monthly_usd)}</dd></div>}</dl>
        {(provider.metrics || []).map((metric, index) => {
            const used = Number(metric.used); const limit = metric.limit; const percent = limit > 0 ? used * 100 / limit : null;
            return <div className={`api-service-metric ${limit !== null && (limit === 0 ? used > 0 : percent >= 80) ? 'has-gap' : ''}`} key={`${metric.name}-${index}`}><span>{metric.name}</span><strong>{metric.unit === 'bytes' ? `${money(used / 1024 / 1024)} MB` : `${money(used)} ${metric.unit}`}{limit !== null && ` / ${money(limit)}`}</strong>{limit !== null && <small>{limit === 0 ? '無可用額度' : `${money(percent)}% · 剩餘 ${money(Math.max(0, limit - used))}`}</small>}{metric.resets_at && <small>重設：{time(metric.resets_at)}</small>}</div>;
        })}
        <button type="button" className="api-refresh" onClick={() => { if (!editing) { setFixed(provider.fixed_monthly_usd ?? ''); setTotal(provider.source === 'manual' ? provider.reported_cost_usd ?? '' : ''); setEnabled(provider.enabled); } setEditing(v => !v); }} aria-expanded={editing}>設定方案費用</button>
        {editing && <form className="api-service-form" onSubmit={save}>
            <label><span>固定月費／年費月攤提（USD，從本月起；未知留空）</span><input type="number" min="0" max="1000000" step="0.0001" value={fixed} onChange={e => setFixed(e.target.value)} /></label>
            <label><span>{month} 完整總額（USD，留空恢復自動）</span><input type="number" min="0" max="1000000" step="0.0001" value={total} onChange={e => setTotal(e.target.value)} /></label>
            <p>完整總額已包含月費，系統不會再重複相加。固定費不代表已取得超額費用。請勿在此輸入任何金鑰。</p>
            <label className="api-service-checkbox"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /><span>列入網站成本監測</span></label>
            {error && <p role="alert">{error}</p>}<button className="platform-primary" disabled={busy}>{busy ? '儲存中…' : '儲存此服務'}</button>
        </form>}
    </article>;
}
