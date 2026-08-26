import React, { useEffect, useMemo, useState } from "react";

const parseDate = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    return match ? { year: match[1], month: match[2], day: match[3] } : { year: "", month: "", day: "" };
};

const pad = value => String(value).padStart(2, "0");
const daysInMonth = (year, month) => new Date(Number(year), Number(month), 0).getDate();
const taiwanToday = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());

function BirthdaySelect({ value, onChange, disabled = false, required = false, maxDate = taiwanToday(), idPrefix = "birthday" }) {
    const maximum = parseDate(maxDate);
    const [parts, setParts] = useState(() => parseDate(value));
    const years = useMemo(() => Array.from({ length: 101 }, (_, index) => String(Number(maximum.year) - index)), [maximum.year]);

    useEffect(() => {
        if (value) setParts(parseDate(value));
    }, [value]);

    const updatePart = (key, nextValue) => {
        const next = { ...parts, [key]: nextValue };
        if (next.year === maximum.year && Number(next.month) > Number(maximum.month)) next.month = maximum.month;
        if (next.year && next.month && next.day) {
            const monthMaximumDay = daysInMonth(next.year, next.month);
            const allowedDay = next.year === maximum.year && next.month === maximum.month
                ? Math.min(monthMaximumDay, Number(maximum.day))
                : monthMaximumDay;
            next.day = pad(Math.min(Number(next.day), allowedDay));
        }
        setParts(next);
        onChange(next.year && next.month && next.day ? `${next.year}-${next.month}-${next.day}` : "");
    };

    const maximumMonth = parts.year === maximum.year ? Number(maximum.month) : 12;
    const maximumDay = parts.year && parts.month
        ? Math.min(
            daysInMonth(parts.year, parts.month),
            parts.year === maximum.year && parts.month === maximum.month ? Number(maximum.day) : 31
        )
        : 31;

    return (
        <div className="birthday-select" role="group" aria-label="出生年月日">
            <label htmlFor={`${idPrefix}-year`}><span>年</span><select id={`${idPrefix}-year`} aria-label="出生年" value={parts.year} onChange={event => updatePart("year", event.target.value)} disabled={disabled} required={required}><option value="">年份</option>{years.map(year => <option key={year} value={year}>{year} 年</option>)}</select></label>
            <label htmlFor={`${idPrefix}-month`}><span>月</span><select id={`${idPrefix}-month`} aria-label="出生月" value={parts.month} onChange={event => updatePart("month", event.target.value)} disabled={disabled} required={required}><option value="">月份</option>{Array.from({ length: maximumMonth }, (_, index) => pad(index + 1)).map(month => <option key={month} value={month}>{Number(month)} 月</option>)}</select></label>
            <label htmlFor={`${idPrefix}-day`}><span>日</span><select id={`${idPrefix}-day`} aria-label="出生日" value={parts.day} onChange={event => updatePart("day", event.target.value)} disabled={disabled} required={required}><option value="">日期</option>{Array.from({ length: maximumDay }, (_, index) => pad(index + 1)).map(day => <option key={day} value={day}>{Number(day)} 日</option>)}</select></label>
        </div>
    );
}

export default BirthdaySelect;
