import React, { useMemo } from "react";
import "./PromotionQuestionsEditor.scss";

export function validatePromotionQuestions(value) {
    let questions;
    try { questions = JSON.parse(value); } catch { return "題目 JSON 格式不正確，請展開進階編輯修正。"; }
    if (!Array.isArray(questions) || questions.length < 5 || questions.length > 50) return "測驗需要 5～50 題。";
    for (const [index, row] of questions.entries()) {
        const options = Array.isArray(row?.options) ? row.options.map(option => typeof option === "string" ? option.trim() : "") : [];
        if (typeof row?.question !== "string" || !row.question.trim()) return `第 ${index + 1} 題請填寫題目。`;
        if (options.length !== 4 || options.some(option => !option) || new Set(options).size !== 4) return `第 ${index + 1} 題需要四個不同且非空白的選項。`;
        if (typeof row.answer !== "string" || !options.includes(row.answer.trim())) return `第 ${index + 1} 題請選擇正確答案。`;
    }
    return "";
}

export default function PromotionQuestionsEditor({ value, onChange, disabled = false }) {
    const rows = useMemo(() => {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) && parsed.every(row => row && typeof row === "object" && !Array.isArray(row)
                && typeof row.question === "string" && Array.isArray(row.options) && row.options.length === 4
                && row.options.every(option => typeof option === "string") && typeof row.answer === "string") ? parsed : null;
        } catch { return null; }
    }, [value]);
    const write = next => onChange(JSON.stringify(next, null, 2));
    const update = (index, patch) => write(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
    const option = (index, slot, text) => {
        const row = rows[index], options = [...row.options];
        const answer = row.answer === options[slot] && row.answer ? text : row.answer;
        options[slot] = text;
        update(index, { options, answer });
    };
    const reorder = (index, direction) => {
        const next = [...rows], target = index + direction;
        [next[index], next[target]] = [next[target], next[index]];
        write(next);
    };
    const error = validatePromotionQuestions(value);
    return <fieldset className="promotion-questions-editor" disabled={disabled}>
        <legend>測驗題目{rows ? `（${rows.length} 題）` : ""}</legend>
        <p>填寫題目、四個選項並指定正確答案。需要 5～50 題，儲存後才會更新測驗。</p>
        {error && <p className="promotion-questions-editor__error" role="status">{error}</p>}
        {rows?.map((row, index) => <details key={index} className="promotion-question" open={index === 0 || !row.question.trim()}>
            <summary>第 {index + 1} 題：{row.question.trim() || "尚未填寫題目"}</summary>
            <label><span>第 {index + 1} 題題目</span><textarea maxLength={1000} value={row.question} onChange={event => update(index, { question: event.target.value })} /></label>
            <div className="platform-form-grid">{row.options.map((text, slot) => <label key={slot}>
                <span>第 {index + 1} 題選項 {"ABCD"[slot]}</span><input maxLength={500} value={text} onChange={event => option(index, slot, event.target.value)} />
            </label>)}</div>
            <label><span>第 {index + 1} 題正確答案</span><select value={row.options.findIndex(text => text && text === row.answer)} onChange={event => update(index, { answer: row.options[Number(event.target.value)] || "" })}>
                <option value={-1}>請選擇答案</option>{row.options.map((text, slot) => <option key={slot} value={slot} disabled={!text.trim()}>{"ABCD"[slot]}：{text || "尚未填寫"}</option>)}
            </select></label>
            <label><span>第 {index + 1} 題解說（選填）</span><textarea maxLength={1000} value={row.explanation || ""} onChange={event => update(index, { explanation: event.target.value })} /></label>
            <div className="promotion-question__actions">
                <button className="platform-secondary" type="button" disabled={index === 0} onClick={() => reorder(index, -1)}>第 {index + 1} 題上移</button>
                <button className="platform-secondary" type="button" disabled={index === rows.length - 1} onClick={() => reorder(index, 1)}>第 {index + 1} 題下移</button>
                <button className="platform-link-button danger" type="button" disabled={rows.length <= 5} onClick={() => write(rows.filter((_, i) => i !== index))}>刪除第 {index + 1} 題</button>
            </div>
        </details>)}
        {rows && <button className="platform-secondary" type="button" disabled={rows.length >= 50} onClick={() => write([...rows, { question: "", options: ["", "", "", ""], answer: "", explanation: "" }])}>新增測驗題目</button>}
        <details className="promotion-questions-editor__advanced" open={rows === null}>
            <summary>進階：編輯題目 JSON</summary>
            <label><span>題目 JSON</span><textarea className="platform-code-editor" value={value} onChange={event => onChange(event.target.value)} spellCheck={false} /></label>
        </details>
    </fieldset>;
}
