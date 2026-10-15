import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowDown, FiArrowUp, FiX } from "react-icons/fi";
import "./css/ClassChangeDialog.scss";

// 班級由低到高。升班、降班依這個順序判斷（只有 E1、E3、E5、E7 四個班，不會有其他班）。
export const CLASS_ORDER = ["E1", "E3", "E5", "E7"];

const taipeiToday = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

export const getClassChangeDirection = (fromCode, toCode) => {
    const from = CLASS_ORDER.indexOf(fromCode);
    const to = CLASS_ORDER.indexOf(toCode);
    if (from < 0 || to < 0 || from === to) return null;
    return to > from ? "promote" : "demote";
};

const DIRECTION_LABEL = { promote: "升班", demote: "降班" };

// 管理員調整單一學生的班級。送出時後端會再次確認管理員身分、日期與班級，這裡的檢查只是方便填寫。
function ClassChangeDialog({ student, enrolledAt = "", onClose, onSubmit }) {
    const currentClass = String(student?.class || "").toUpperCase();
    const today = useMemo(taipeiToday, []);
    const [targetClass, setTargetClass] = useState("");
    const [effectiveOn, setEffectiveOn] = useState(today);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const dialogRef = useRef(null);
    const reasonLength = reason.trim().length;
    const direction = getClassChangeDirection(currentClass, targetClass);
    const minDate = enrolledAt || "";

    const dateProblem = !effectiveOn ? "請選擇生效日期"
        : effectiveOn > today ? "目前只能選今天或過去的日期"
            : minDate && effectiveOn < minDate ? `不能早於進入目前班級的日期（${minDate}）` : "";
    const canSubmit = Boolean(direction) && !dateProblem && reasonLength >= 2 && reasonLength <= 300 && !busy;

    useEffect(() => {
        dialogRef.current?.focus();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previousOverflow; };
    }, []);

    const close = () => { if (!busy) onClose?.(); };

    const submit = async event => {
        event.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError("");
        try {
            await onSubmit({ classCode: targetClass, effectiveOn, reason: reason.trim() });
        } catch (submitError) {
            setError(submitError?.message || "調整班級失敗，請稍後再試");
            setBusy(false);
        }
    };

    const name = student?.chinese_name || student?.name || "這位學生";

    return (
        <div className="class-change-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
            <form
                ref={dialogRef}
                className="class-change-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="class-change-title"
                tabIndex={-1}
                onSubmit={submit}
                onKeyDown={event => { if (event.key === "Escape") close(); }}
            >
                <header>
                    <h2 id="class-change-title">調整班級：{name}</h2>
                    <button type="button" className="class-change-close" aria-label="關閉" onClick={close}><FiX aria-hidden="true" /></button>
                </header>

                <p className="class-change-current">目前班級 <strong>{currentClass || "—"}</strong></p>

                <fieldset>
                    <legend>調整到哪一班</legend>
                    <div className="class-change-options">
                        {CLASS_ORDER.filter(code => code !== currentClass).map(code => {
                            const optionDirection = getClassChangeDirection(currentClass, code);
                            return (
                                <label key={code} className={targetClass === code ? "is-selected" : ""}>
                                    <input type="radio" name="class-change-target" value={code} checked={targetClass === code}
                                        onChange={() => setTargetClass(code)} disabled={busy} />
                                    <strong>{code}</strong>
                                    <span className={`class-change-tag is-${optionDirection}`}>
                                        {optionDirection === "promote" ? <FiArrowUp aria-hidden="true" /> : <FiArrowDown aria-hidden="true" />}
                                        {DIRECTION_LABEL[optionDirection]}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <label className="class-change-field">
                    <span>生效日期</span>
                    <input type="date" value={effectiveOn} min={minDate || undefined} max={today}
                        onChange={event => setEffectiveOn(event.target.value)} disabled={busy} />
                    {dateProblem && <small role="alert">{dateProblem}</small>}
                </label>

                <label className="class-change-field">
                    <span>調整原因（必填，會留下紀錄）</span>
                    <input value={reason} maxLength={300} placeholder="例如：升班後程度跟不上，先回原班"
                        onChange={event => setReason(event.target.value)} disabled={busy} />
                </label>

                <ul className="class-change-notes">
                    <li>從生效日起，學生只會看到新班級的作業；舊班級已發出的作業與學習紀錄都會保留。</li>
                    <li>學生在舊班級的那段時間會以舊班級保存，不會被改成一直都在新班級；資料不會被刪除。</li>
                    <li>調錯了可以再調整一次，每次都會留下紀錄。</li>
                </ul>

                {error && <p className="class-change-error" role="alert">{error}</p>}

                <footer>
                    <button type="button" className="class-change-secondary" onClick={close} disabled={busy}>取消</button>
                    <button type="submit" className="class-change-primary" disabled={!canSubmit}>
                        {busy ? "處理中…" : direction ? `確認${DIRECTION_LABEL[direction]}到 ${targetClass}` : "請先選擇班級"}
                    </button>
                </footer>
            </form>
        </div>
    );
}

export default ClassChangeDialog;
