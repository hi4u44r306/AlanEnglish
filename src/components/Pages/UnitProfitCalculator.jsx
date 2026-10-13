import React, { useState } from 'react';
import { twdText, unitProfit } from './costPlain';

// Starting points only; the owner replaces them with real quotes.
const defaults = { price: '2980', months: '12', printing: '150', shipping: '65', packaging: '15', feePercent: '3', platformPerMonth: '21' };
const fields = [
    { id: 'price', label: '售價', unit: '元' },
    { id: 'months', label: '附幾個月平台', unit: '個月' },
    { id: 'printing', label: '習作本印刷', unit: '元／本' },
    { id: 'shipping', label: '運費', unit: '元' },
    { id: 'packaging', label: '包材', unit: '元' },
    { id: 'feePercent', label: '金流手續費', unit: '%' },
    { id: 'platformPerMonth', label: '每位學生每月平台用量', unit: '元' }
];
const read = key => {
    try {
        const value = key && JSON.parse(localStorage.getItem(key) || 'null');
        return value && typeof value === 'object' && !Array.isArray(value) ? { ...defaults, ...Object.fromEntries(fields.map(field => [field.id, typeof value[field.id] === 'string' ? value[field.id] : defaults[field.id]])) } : defaults;
    } catch { return defaults; }
};

export default function UnitProfitCalculator({ userId, fixedTwd }) {
    const key = userId ? `ae-unit-profit-v1:${userId}` : null;
    const [input, setInput] = useState(() => read(key));
    const [storageError, setStorageError] = useState(false);
    const update = next => {
        setInput(next);
        try { if (key) localStorage.setItem(key, JSON.stringify(next)); setStorageError(false); } catch { setStorageError(true); }
    };
    const result = unitProfit(input);
    const breakEven = result && result.profit > 0 && fixedTwd > 0 ? Math.ceil(fixedTwd / result.profit) : null;
    return <section className="platform-card api-plain-card api-unit" aria-labelledby="api-unit-title">
        <h2 id="api-unit-title">賣一套教材賺多少</h2>
        <p>填入你的實際數字試算。預設值只是估計，印刷和運費請換成廠商給你的報價。這裡只是試算，不會改變網站上的售價。</p>
        <div className="api-unit-presets"><button type="button" className="api-refresh" onClick={() => update({ ...input, price: '1980', months: '6' })}>套用半年方案 1,980</button><button type="button" className="api-refresh" onClick={() => update({ ...input, price: '2980', months: '12' })}>套用一年方案 2,980</button></div>
        <div className="api-unit-grid">{fields.map(field => <label key={field.id}><span>{field.label}（{field.unit}）</span><input aria-label={field.label} type="number" min="0" step="any" inputMode="decimal" value={input[field.id]} onChange={event => update({ ...input, [field.id]: event.target.value })} /></label>)}</div>
        {result ? <div className={`api-unit-result ${result.profit < 0 ? 'is-loss' : ''}`} role="status">
            <div><span>每套成本</span><strong>{twdText(result.cost)}</strong><small>手續費 {twdText(result.fee)}、平台用量 {twdText(result.platformTotal)}</small></div>
            <div><span>{result.profit < 0 ? '每套虧損' : '每套剩下'}</span><strong>{result.profit < 0 ? `-${twdText(-result.profit)}` : twdText(result.profit)}</strong><small>{result.margin === null ? '' : `約占售價 ${Math.round(result.margin)}%`}</small></div>
            <div><span>一個月要賣幾套才打平固定開銷</span><strong>{breakEven === null ? '—' : `${breakEven} 套`}</strong><small>{fixedTwd > 0 ? `每月固定要付 ${twdText(fixedTwd)}` : '上面還沒填任何固定月費'}</small></div>
        </div> : <p className="api-service-gap" role="alert">每一格都要填數字（沒有的費用填 0）才能試算。</p>}
        <small>還沒算進去：營業稅、廣告費、退貨與你自己的時間。數字只存在這台裝置的瀏覽器。</small>
        {storageError && <p className="api-service-gap" role="alert">瀏覽器無法保存，數字只在這次開啟有效。</p>}
    </section>;
}
