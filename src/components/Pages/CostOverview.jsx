import React, { useState } from 'react';
import { billingAmount, costOverview, hasFreePlanReview, reviewIsCurrent, serviceCostDisplay, taiwanDate } from './costPresentation';

const money = value => value === null ? '尚未取得' : `US$ ${Number(value).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const time = value => value ? new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '尚未取得';
const readReviews = key => {
    try {
        const value = key && JSON.parse(localStorage.getItem(key) || '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return Object.fromEntries(Object.entries(value).filter(([, review]) => review && typeof review.note === 'string'
            && typeof review.checkedAt === 'string' && typeof review.validThrough === 'string'
            && ['free_plan', 'usage'].includes(review.kind)));
    }
    catch { return {}; }
};

function ReviewEditor({ provider, review, month, onSave, onRemove }) {
    const [kind, setKind] = useState(review?.kind || 'usage');
    const [validThrough, setValidThrough] = useState(review?.validThrough || '');
    const [note, setNote] = useState(review?.note || '');
    const [error, setError] = useState('');
    const today = taiwanDate();
    return <details className="api-review-editor"><summary>核對紀錄</summary>
        {review && <p>核對時間：{time(review.checkedAt)}<br />適用至：{review.validThrough}<br />{reviewIsCurrent(review, month) ? '最近七天內的人工核對' : '已過期或不適用本月，請重新核對'}<br />{review.note}</p>}
        <form onSubmit={event => {
            event.preventDefault();
            if (!validThrough.startsWith(`${month}-`) || validThrough < today || !note.trim()) { setError('請填寫本月的有效日期與核對來源。'); return; }
            if (kind === 'free_plan' && (billingAmount(provider.fixed_monthly_usd) !== 0 || billingAmount(provider.reported_cost_usd) > 0)) { setError('須先核對固定月費為 0，且目前沒有正數帳務費用，才能標記免費方案。'); return; }
            onSave({ kind, validThrough, note: note.trim(), checkedAt: new Date().toISOString() }); setError('');
        }}>
            <label>核對類型<select aria-label={`${provider.name} 核對類型`} value={kind} onChange={event => setKind(event.target.value)}><option value="usage">本期用量／費用快照</option><option value="free_plan">已確認免費方案</option></select></label>
            <label>適用至<input aria-label={`${provider.name} 核對適用至`} type="date" min={today} value={validThrough} required onChange={event => setValidThrough(event.target.value)} /></label>
            <label>來源、帳期與核對結果<textarea aria-label={`${provider.name} 核對結果`} maxLength={600} value={note} required placeholder="例如：供應商帳務頁、帳期、用量與費用。請勿輸入金鑰或個資。" onChange={event => setNote(event.target.value)} /></label>
            <small>最多有效七天；到適用日期或方案變更時需再核對。只作查閱，不寫入帳單或提醒金額。</small>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="api-refresh">保存 {provider.name} 核對</button>
            {review && <button type="button" className="api-refresh" onClick={onRemove}>移除 {provider.name} 核對</button>}
        </form>
    </details>;
}

export default function CostOverview({ providers, scale, month, userId, rate }) {
    const key = userId ? `ae-cost-review-v1:${userId}:${month}` : null;
    const [reviews, setReviews] = useState(() => readReviews(key));
    const [storageError, setStorageError] = useState(false);
    const overview = costOverview(providers, reviews, month);
    const saveReview = (id, review) => {
        const next = { ...reviews };
        if (review) next[id] = review; else delete next[id];
        setReviews(next);
        try { if (!key) throw new Error('No user'); localStorage.setItem(key, JSON.stringify(next)); setStorageError(false); }
        catch { setStorageError(true); }
    };
    return <div className="api-cost-overview">
        <h2 id="api-cost-overview-title">每項服務，現在花多少？</h2>
        <p>先看帳務金額，再看月底預估。免費方案仍有額度限制；費用 0 元不代表方案永遠免費。</p>
        <p><strong>目前啟用學生：{scale.count === null ? '尚未取得' : `${scale.count} 人`}</strong>；人數隨頁面每分鐘更新。老師、管理員與停用帳號不計入。</p>
        <div className="api-overview" aria-label="費用與核對摘要">
            <article><span>已確認免費</span><strong>{overview.freeCount} 項方案</strong><small>最近七天人工核對，適用期間內</small></article>
            <article className="api-overview-primary"><span>目前已花費（已取得部分）</span><strong>{money(overview.billedTotal)}</strong><small>{overview.billingCount} 項已取得帳務；不含網站估算、另填固定費與未取得金額</small></article>
            <article><span>預估月底費用</span><strong>{money(scale.total)}</strong><small>{scale.total !== null && `約 NT$ ${Number(scale.total * Number(rate)).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}。`}{scale.gaps ? `仍有 ${scale.gaps} 項估算不完整` : '依目前啟用學生數與預算假設'}</small></article>
            <article className={overview.gaps ? 'has-alert' : ''}><span>尚待核對</span><strong>{overview.gaps} 項服務</strong><small>含未取得、更新失敗或過期帳務；免費方案也可能有資料缺口</small></article>
        </div>
        <p className="api-chart-note">人工紀錄只存在此管理員、此瀏覽器與此月份；不會自動同步供應商方案。供應商帳務依卡片來源範圍，可能延遲、含折抵，或採不同帳期。</p>
        {storageError && <p className="api-service-gap" role="alert">核對紀錄無法保存，目前只在本次頁面有效。</p>}
        <div className="api-cost-ledger" role="table" aria-label="逐項成本總覽">
            <div className="api-cost-ledger-head" role="row"><span role="columnheader">服務／狀態</span><span role="columnheader">目前費用</span><span role="columnheader">月底預估</span><span role="columnheader">資料時間與核對</span></div>
            {scale.rows.map(row => {
                const display = serviceCostDisplay(row);
                const review = reviews[row.id];
                const free = hasFreePlanReview(row, review, month);
                const needsReview = row.enabled && (row.incomplete || row.stale || row.error_code || display.kind !== 'billing');
                return <div className={`api-cost-ledger-row ${row.enabled ? '' : 'is-excluded'}`} role="row" key={row.id}>
                    <div role="cell"><strong>{row.name}</strong><small>{row.category}</small><span className={`api-cost-status ${free ? 'is-free' : ''}`}>{!row.enabled ? '不列入總計' : free ? '已確認免費方案' : needsReview ? '尚待核對' : '帳務已取得'}</span>{free && needsReview && <small>完整帳務仍有缺口</small>}</div>
                    <div role="cell"><span className="api-ledger-mobile-label">目前費用</span><strong>{money(display.amount)}</strong><small>{display.label}</small>{billingAmount(row.fixed_monthly_usd) !== null && <small>固定月費 {money(Number(row.fixed_monthly_usd))}</small>}{row.stale || row.error_code ? <small>更新異常，保留上次資料</small> : null}</div>
                    <div role="cell"><span className="api-ledger-mobile-label">月底預估</span><strong>{row.enabled ? money(row.amount) : '不列入合計'}</strong><small>{row.partial ? '部分估算，仍待補資料' : '依目前規模預算假設'}</small></div>
                    <div role="cell">{row.period_start && row.period_end && <small>資料範圍（台灣時間）：{time(row.period_start)} ～ {time(row.period_end)}</small>}<small>{row.source === 'manual' ? '人工帳務更新' : '自動資料更新'}：{time(row.collected_at)}</small>{review && <><small>人工核對：{time(review.checkedAt)}{reviewIsCurrent(review, month) ? '' : '（已過期）'}</small><small>適用至 {review.validThrough}：{review.note}</small></>}<ReviewEditor key={`${row.id}-${review?.checkedAt || 'empty'}`} provider={row} review={review} month={month} onSave={value => saveReview(row.id, value)} onRemove={() => saveReview(row.id, null)} /></div>
                </div>;
            })}
        </div>
    </div>;
}
