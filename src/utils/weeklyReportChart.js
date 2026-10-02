const DAY_MS = 86400000;
const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];

const countValue = value => (
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
);

export const getWeeklyChartDays = (report, now = new Date()) => {
    const start = Date.parse(`${report?.week?.start_date}T00:00:00Z`);
    if (!Number.isFinite(start) || !Array.isArray(report?.daily_breakdown)) return [];
    const generated = report.generated_at ? new Date(report.generated_at) : now;
    const asOf = Number.isFinite(generated.getTime()) ? generated : now;
    const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(asOf);
    const rows = new Map(report.daily_breakdown.map(day => [day.date, day]));
    let cumulative = 0;

    return WEEKDAYS.map((weekday, index) => {
        const date = new Date(start + index * DAY_MS).toISOString().slice(0, 10);
        const day = rows.get(date);
        const future = date > today;
        const listening = future ? null : countValue(day?.listening);
        const newQuestions = future ? null : countValue(day?.speaking_challenge);
        // A missing day cannot be treated as zero or included in a known cumulative total.
        if (!future) cumulative = cumulative !== null && newQuestions !== null ? cumulative + newQuestions : null;
        return {
            date, weekday, future, listening, newQuestions,
            speakingCumulative: future ? null : cumulative
        };
    });
};
