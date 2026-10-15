// 每週報告的「專注度」：用播放器新記錄的兩種中斷（放著不動沒回應、切換頁面暫停）對照有效聆聽次數。
// 純函式、不做 I/O，方便單元測試。事件由 learning-activity 的 listening_pause 寫入 student_activity_events。

export const ATTENTION_TRACKING_SINCE = "2026-10-16";

export type AttentionLevel = "focused" | "ok" | "needs_reminder";

export type AttentionSummary = {
    available: boolean;
    since: string;
    tracked_listens: number;
    idle_pauses: number;
    hidden_pauses: number;
    focus_rate: number | null;
    level: AttentionLevel | null;
};

type EventRow = { activity_type?: string; activity_key?: string; occurred_at?: string };
type DayRow = { date?: string; listening?: number };

const taipeiDate = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

export const attentionLevel = (rate: number): AttentionLevel => (rate >= 80 ? "focused" : rate >= 55 ? "ok" : "needs_reminder");

export const buildAttention = (input: {
    events: EventRow[];
    dailyBreakdown: DayRow[];
    weekEndDate: string;
    since?: string;
}): AttentionSummary => {
    const since = input.since || ATTENTION_TRACKING_SINCE;
    const available = input.weekEndDate >= since;
    const pauses = (input.events || []).filter(event => (
        event.activity_type === "listening"
        && (event.activity_key === "pause-idle" || event.activity_key === "pause-hidden")
        && Boolean(event.occurred_at)
        && taipeiDate(String(event.occurred_at)) >= since
    ));
    const idle = pauses.filter(event => event.activity_key === "pause-idle").length;
    const hidden = pauses.filter(event => event.activity_key === "pause-hidden").length;
    // 只算「開始記錄之後」的有效聆聽，避免沒有記錄的日子讓專注度虛高。
    const tracked = (input.dailyBreakdown || [])
        .filter(day => String(day.date || "") >= since)
        .reduce((sum, day) => sum + (Number(day.listening) > 0 ? Number(day.listening) : 0), 0);
    const denominator = tracked + idle + hidden;
    const rate = available && denominator > 0 ? Math.round((tracked / denominator) * 100) : null;
    return {
        available,
        since,
        tracked_listens: tracked,
        idle_pauses: idle,
        hidden_pauses: hidden,
        focus_rate: rate,
        level: rate === null ? null : attentionLevel(rate)
    };
};

export const describeAttention = (attention: AttentionSummary): string => {
    if (!attention.available || attention.focus_rate === null) return "";
    const label = attention.level === "focused" ? "專注" : attention.level === "ok" ? "普通" : "需要提醒";
    return `專注度：${label}（${attention.focus_rate}%；放著不動自動暫停 ${attention.idle_pauses} 次、切換頁面暫停 ${attention.hidden_pauses} 次）。`;
};
