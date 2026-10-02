import { getWeeklyChartDays } from "./weeklyReportChart";

const makeReport = () => ({
    week: { start_date: "2026-09-28" },
    generated_at: "2026-09-30T08:00:00Z",
    daily_breakdown: [
        { date: "2026-09-30", listening: 4, speaking_challenge: 3 },
        { date: "2026-09-28", listening: 2, speaking_challenge: 2 },
        { date: "2026-09-29", listening: 0, speaking_challenge: 0 }
    ]
});

test("依日期排列聽力次數，口說只累計本週首次完成題數", () => {
    const days = getWeeklyChartDays(makeReport());
    expect(days.map(day => day.listening)).toEqual([2, 0, 4, null, null, null, null]);
    expect(days.map(day => day.speakingCumulative)).toEqual([2, 2, 5, null, null, null, null]);
    expect(days[3]).toMatchObject({ date: "2026-10-01", future: true });
});

test("台灣午夜後列入新一天，未來日期不畫成零或延長累計線", () => {
    const report = makeReport();
    report.generated_at = "2026-09-29T16:00:00Z";
    const days = getWeeklyChartDays(report);
    expect(days[2].future).toBe(false);
    expect(days[2].speakingCumulative).toBe(5);
    expect(days[3].listening).toBeNull();
});

test("過去日期缺資料不能當零，也不能推算不完整的累計", () => {
    const report = makeReport();
    report.daily_breakdown = report.daily_breakdown.filter(day => day.date !== "2026-09-29");
    const days = getWeeklyChartDays(report);
    expect(days[1]).toMatchObject({ listening: null, speakingCumulative: null, future: false });
    expect(days[2].listening).toBe(4);
    expect(days[2].speakingCumulative).toBeNull();
    expect(getWeeklyChartDays({})).toEqual([]);
});
