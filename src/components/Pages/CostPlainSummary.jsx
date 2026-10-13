import React, { useState } from 'react';
import { saveServiceCost } from '../../services/costAlertService';
import { plainSummary, toTwd, toUsd, twdText } from './costPlain';

function FeeForm({ bill, rate, month, firebaseUser, onSaved, onClose }) {
    const { provider } = bill;
    const [fixed, setFixed] = useState(bill.fixedTwd === null ? '' : String(Math.round(bill.fixedTwd)));
    const [total, setTotal] = useState(provider.source === 'manual' && provider.reported_cost_usd != null ? String(Math.round(toTwd(provider.reported_cost_usd, rate))) : '');
    const [enabled, setEnabled] = useState(provider.enabled);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const save = async event => {
        event.preventDefault(); setBusy(true); setError('');
        try {
            await saveServiceCost(firebaseUser, { provider_id: bill.id, month, enabled,
                fixed_monthly_usd: fixed === '' ? null : toUsd(fixed, rate), month_total_usd: total === '' ? null : toUsd(total, rate) });
            onClose(); await onSaved();
        } catch (failure) { setError(failure.message || '儲存失敗，請再試一次'); } finally { setBusy(false); }
    };
    return <form className="api-plain-form" onSubmit={save}>
        <label><span>每個月固定要付多少（台幣）</span><input aria-label={`${bill.label} 每月固定費`} type="number" min="0" max="30000000" step="1" inputMode="numeric" placeholder="不用付錢請填 0，不知道請留空" value={fixed} onChange={event => setFixed(event.target.value)} /></label>
        <label><span>{month} 這個月的帳單總額（台幣，有收到帳單才填）</span><input aria-label={`${bill.label} 本月帳單總額`} type="number" min="0" max="30000000" step="1" inputMode="numeric" placeholder="留空就用系統自己查到的金額" value={total} onChange={event => setTotal(event.target.value)} /></label>
        <label className="api-plain-check"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><span>這項要算進每月成本（沒在用的服務可以取消）</span></label>
        <small>帳單總額已經包含月費，不會重複加。系統以美元保存，依目前匯率 {rate} 換算。請不要在這裡輸入密碼或金鑰。</small>
        {error && <p role="alert">{error}</p>}
        <div className="api-plain-form-actions"><button className="platform-primary" disabled={busy}>{busy ? '儲存中…' : '儲存'}</button><button type="button" className="api-refresh" onClick={onClose}>取消</button></div>
    </form>;
}

function BillRow({ bill, editing, onEdit, ...formProps }) {
    return <li className={`api-plain-row api-plain-${bill.group}`}>
        <div className="api-plain-row-main">
            <div className="api-plain-name"><strong>{bill.label}</strong><small>{bill.vendor}</small></div>
            <div className="api-plain-amount"><strong>{bill.group === 'excluded' ? '不計入' : twdText(bill.amountTwd)}</strong>{!['unknown', 'excluded'].includes(bill.group) && <small>{bill.source}</small>}</div>
            <button type="button" className="api-refresh" aria-expanded={editing} aria-label={`${bill.group === 'unknown' ? '填寫' : '修改'} ${bill.label}`} onClick={() => onEdit(editing ? null : bill.id)}>{bill.group === 'unknown' ? '填寫' : '修改'}</button>
        </div>
        {bill.caution && <p className="api-plain-caution">{bill.caution}</p>}
        {editing && <FeeForm bill={bill} onClose={() => onEdit(null)} {...formProps} />}
    </li>;
}

export default function CostPlainSummary({ providers, summary, budget, month, firebaseUser, onSaved }) {
    const [editing, setEditing] = useState(null);
    const rate = Number(budget.usd_to_twd_rate);
    const plain = plainSummary(providers, rate);
    const rowProps = { rate, month, firebaseUser, onSaved, onEdit: setEditing };
    const rows = bills => bills.map(bill => <BillRow key={`${month}-${bill.id}`} bill={bill} editing={editing === bill.id} {...rowProps} />);
    const usedPercent = Number(budget.used_percent || 0);
    const warning = Number(budget.warning_percent || 80);
    const status = usedPercent >= 100 ? 'critical' : usedPercent >= warning ? 'warning' : 'normal';
    return <>
        <section className={`api-plain-hero api-budget-${status}`} aria-labelledby="api-plain-total-title">
            <div className="api-plain-total">
                <h2 id="api-plain-total-title">{month} 到目前為止的費用</h2>
                <strong>{twdText(Number(summary.total_cost_twd || 0))}</strong>
                <p>{plain.unknown.length ? `還有 ${plain.unknown.length} 項不知道金額，沒有算進來。填完才是完整的數字。` : '所有項目都有金額了。帳單可能晚幾天才更新。'}</p>
            </div>
            <dl className="api-plain-facts">
                <div><dt>每個月固定要付</dt><dd>{twdText(plain.fixedTwd)}</dd></div>
                <div><dt>你設定的每月預算</dt><dd>{twdText(toTwd(budget.monthly_budget_usd, rate))}</dd></div>
                <div><dt>已用掉預算</dt><dd>{Math.round(usedPercent)}%</dd></div>
            </dl>
            <div className="api-budget-track" role="progressbar" aria-label="本月網站預算使用率" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.max(0, Math.min(100, Math.round(usedPercent)))}><span style={{ width: `${Math.min(100, Math.max(0, usedPercent))}%` }} /></div>
            <p className="api-plain-budget-note">{status === 'critical' ? '已經超過你設定的預算。' : status === 'warning' ? `已經超過 ${warning}% 的提醒線。` : `用到 ${warning}% 時會提醒你。`}</p>
        </section>
        {plain.unknown.length > 0 && <section className="platform-card api-plain-card api-plain-todo" aria-labelledby="api-plain-unknown-title">
            <h2 id="api-plain-unknown-title">請補上這 {plain.unknown.length} 項的金額</h2>
            <p>系統查不到這些服務的帳單。請看信用卡帳單或服務的後台，填上每個月付多少；確定不用付錢就填 0，沒在用就取消計入。</p>
            <ul className="api-plain-list">{rows(plain.unknown)}</ul>
        </section>}
        <section className="platform-card api-plain-card" aria-labelledby="api-plain-paying-title">
            <h2 id="api-plain-paying-title">錢花在哪裡</h2>
            {plain.paying.length ? <ul className="api-plain-list">{rows(plain.paying)}</ul> : <p>這個月目前沒有任何一項產生費用。</p>}
            {plain.zero.length > 0 && <details className="api-plain-more"><summary>目前 0 元的項目（{plain.zero.length} 項）</summary><p>0 元通常是還在免費額度內，用量變多之後可能開始收費。</p><ul className="api-plain-list">{rows(plain.zero)}</ul></details>}
            {plain.excluded.length > 0 && <details className="api-plain-more"><summary>沒有計入的項目（{plain.excluded.length} 項）</summary><ul className="api-plain-list">{rows(plain.excluded)}</ul></details>}
        </section>
    </>;
}
