import React, { useState } from "react";

const WIDTH = 640;
const HEIGHT = 260;
const LEFT = 48;
const RIGHT = 22;
const TOP = 26;
const BOTTOM = 24;

const WeeklyLineChart = ({ days, valueKey, title, description, unit, tone = "blue" }) => {
    const [selectedDate, setSelectedDate] = useState("");
    const values = days.map(day => day[valueKey]);
    const max = Math.max(1, ...values.filter(value => value !== null));
    const step = Math.max(1, Math.ceil(max / 4));
    const ceiling = step * 4;
    const x = index => LEFT + index * ((WIDTH - LEFT - RIGHT) / Math.max(1, days.length - 1));
    const y = value => HEIGHT - BOTTOM - (value / ceiling) * (HEIGHT - TOP - BOTTOM);
    let connected = false;
    const path = values.map((value, index) => {
        if (value === null) { connected = false; return ""; }
        const command = connected ? "L" : "M";
        connected = true;
        return `${command}${x(index)},${y(value)}`;
    }).join(" ");
    const selected = days.find(day => day.date === selectedDate)
        || [...days].reverse().find(day => !day.future) || days[0];
    const describeValue = day => day.future ? "尚未到來" : day[valueKey] === null ? "資料未提供" : `${day[valueKey]} ${unit}`;

    return <section className={`weekly-report-panel weekly-line-chart is-${tone}`} aria-label={title}>
        <div className="weekly-report-heading">
            <div><h2>{title}</h2><p>{description}</p></div>
            <span className="weekly-line-chart__unit">單位：{unit}</span>
        </div>
        {days.length ? <>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title}折線圖`}>
                <title>{title}</title>
                <desc>{days.map(day => `${day.weekday} ${day.date}：${describeValue(day)}`).join("；")}</desc>
                {[0, 1, 2, 3, 4].map(index => <g key={index}>
                    <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(index * step)} y2={y(index * step)} className="weekly-line-chart__grid" />
                    <text x={LEFT - 12} y={y(index * step) + 6} textAnchor="end">{index * step}</text>
                </g>)}
                <path d={path} className="weekly-line-chart__line" />
                {values.map((value, index) => value !== null && <circle
                    key={days[index].date} cx={x(index)} cy={y(value)} r={selected?.date === days[index].date ? 7 : 5}
                    className="weekly-line-chart__point"
                ><title>{`${days[index].weekday}：${value} ${unit}`}</title></circle>)}
            </svg>
            <div className="weekly-line-chart__days" aria-label={`${title}每日數據`}>
                {days.map(day => <button key={day.date} type="button"
                    aria-label={`${day.weekday} ${day.date}，${describeValue(day)}`}
                    aria-pressed={selected?.date === day.date} onClick={() => setSelectedDate(day.date)}
                    className={day.future ? "is-future" : ""}>
                    <strong>{day.weekday}</strong><small>{`${Number(day.date.slice(5, 7))}/${Number(day.date.slice(8))}`}</small>
                    <span>{day.future ? "待更新" : day[valueKey] === null ? "—" : day[valueKey]}</span>
                </button>)}
            </div>
            <p className="weekly-line-chart__selection" role="status">
                {selected && `${selected.weekday}（${selected.date}）：${describeValue(selected)}`}
            </p>
        </> : <p className="weekly-line-chart__selection">圖表資料尚未提供，請重新整理報告。</p>}
    </section>;
};

export default WeeklyLineChart;
