import React, { useMemo, useState } from 'react';
import { calculateScaleCosts } from './costScale';
import CostOverview from './CostOverview';
import { serviceCostDisplay } from './costPresentation';

const money = value => value === null ? '待補資料' : Number(value).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const readAssumptions = key => {
    if (!key) return {};
    try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
};

export default function CostScalePanel({ providers = [], population, month, rate, userId }) {
    const key = userId ? `ae-cost-scale-v1:${userId}:${month}` : null;
    const [overrides, setOverrides] = useState(() => readAssumptions(key));
    const [storageError, setStorageError] = useState(false);
    const scale = useMemo(() => calculateScaleCosts(providers, population, month, overrides), [providers, population, month, overrides]);
    const persist = next => {
        setOverrides(next);
        try { if (key) localStorage.setItem(key, JSON.stringify(next)); setStorageError(false); }
        catch { setStorageError(true); }
    };
    const update = (row, field, value) => persist({ ...overrides, [row.id]: { shared: row.shared ?? '', perStudent: row.perStudent ?? '', [field]: value } });
    const reset = id => { const next = { ...overrides }; delete next[id]; persist(next); };
    return <section className="platform-card api-scale" aria-labelledby="api-cost-overview-title">
        <CostOverview providers={providers} scale={scale} month={month} userId={userId} rate={rate} />
        <details className="api-scale-assumptions"><summary>調整每人用量與月底預算假設</summary>
        <div className="platform-section-title"><div><span className="platform-eyebrow">CURRENT STUDENT SCALE</span><h2 id="api-scale-title">依目前人數估算每月成本</h2><p>啟用中的學生帳號：<strong>{scale.count === null ? '人數尚未取得' : `${scale.count} 人`}</strong>。人數每分鐘隨頁面更新；老師、管理員與停用帳號不算學生。</p></div></div>
        <p className="api-chart-note">以目前人數估算 {month} 的 {scale.days} 天；查詢舊月份仍使用目前人數。月費＝固定／共用費＋人均用量費×人數。登入 MAU、CPU、流量、儲存與付款不只由人數決定，請依方案填入預算假設。</p>
        <div className="api-scale-total"><span>{scale.gaps ? '可估算項目合計（尚未完整）' : '目前規模預估月費合計'}</span><strong>{scale.total === null ? '待補資料' : `US$ ${money(scale.total)}`}</strong><span>{scale.total !== null && `約 NT$ ${money(scale.total * Number(rate))}`}</span><small>{scale.gaps} 項仍需核對費率／補入用量；預估與上方本月已知費用分開，不重複相加。</small></div>
        {population?.counted_at && <p className="api-chart-note">人數統計：{new Date(population.counted_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>}
        {scale.count === null && <p className="api-service-gap" role="alert">人數查詢失敗，無法計算人均用量費；不當成 0 人。</p>}
        <div className="api-scale-list">{scale.rows.map(row => <article className={`api-scale-row ${row.enabled ? '' : 'is-excluded'}`} key={row.id}>
            <div className="api-scale-heading"><h3>{row.name}</h3><strong>{!row.enabled ? '不列入合計' : row.amount === null ? '待補資料' : `${row.partial ? '暫估 ' : ''}US$ ${money(row.amount)}／月`}</strong></div>
            <p>{row.category}{row.enabled && row.amount !== null && ` · 約 NT$ ${money(row.amount * Number(rate))}`}</p>
            <div className="api-scale-inputs">
                <label><span>固定／共用月費（USD）</span><input aria-label={`${row.name} 固定／共用月費`} type="number" min="0" max="1000000" step="any" placeholder="未知留空" value={row.shared ?? ''} disabled={!row.enabled} onChange={event => update(row, 'shared', event.target.value)} /></label>
                <label><span>每人每月用量費（USD）</span><input aria-label={`${row.name} 每人每月用量費`} type="number" min="0" max="1000000" step="any" placeholder="未知留空" value={row.perStudent ?? ''} disabled={!row.enabled} onChange={event => update(row, 'perStudent', event.target.value)} /></label>
            </div>
            <p>{row.basis}</p><small>{serviceCostDisplay(row).label}：{serviceCostDisplay(row).amount === null ? '尚未取得' : `US$ ${money(serviceCostDisplay(row).amount)}`}；此金額不另加到預估。</small>
            {overrides[row.id] && <button type="button" className="api-refresh" onClick={() => reset(row.id)}>恢復 {row.name} 自動估算</button>}
        </article>)}</div>
        <p className="api-chart-note">填入的估算只保存在此管理員、此瀏覽器、此月份；清除瀏覽器資料或換裝置需重填。完整帳單仍在下方「設定方案費用」保存。估算不更改提醒警戒線，也不視為已發生費用。</p>
        {storageError && <p className="api-service-gap" role="alert">瀏覽器無法保存估算，目前數字只在本次頁面有效。</p>}
        </details>
    </section>;
}
