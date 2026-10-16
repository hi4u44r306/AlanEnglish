// 每週報告的「專注度」：用播放器新記錄的兩種中斷（放著不動沒回應、切換頁面暫停）對照有效聆聽次數。
// 純函式、不做 I/O，方便單元測試。事件由 learning-activity 的 listening_pause 寫入 student_activity_events。

// 以「整週」為單位：只有整週都有記錄的週別才顯示專注度。起算日必須是週一（台灣時間）。
export const ATTENTION_TRACKING_SINCE = "2026-10-19";

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
    weekStartDate: string;
    since?: string;
}): AttentionSummary => {
    const since = input.since || ATTENTION_TRACKING_SINCE;
    const available = input.weekStartDate >= since;
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

// 給家長看的數字只到整十（95→100、63→60），等級也依整十後的數字判斷，和網頁上顯示的一致。
export const roundedFocusRate = (rate: number) => Math.min(100, Math.max(0, Math.round(rate / 10) * 10));
const roundedLevel = (rate: number) => (rate >= 80 ? "專注" : rate >= 60 ? "普通" : "需要提醒");

export const describeAttention = (attention: AttentionSummary): string => {
    if (!attention.available || attention.focus_rate === null) return "";
    const rate = roundedFocusRate(attention.focus_rate);
    const label = roundedLevel(rate);
    return `專注度：${label}（${rate}%；放著不動自動暫停 ${attention.idle_pauses} 次、切換頁面暫停 ${attention.hidden_pauses} 次）。`;
};

// 口說大挑戰的專注度：關卡進行中切換頁面、90 秒沒有操作、想離開「先聽本關教材」被帶回，
// 對照本週完成的口說題數。事件由 learning-activity 的 speaking_attention 寫入（activity_type=other）。
export type SpeakingAttentionSummary = {
    available: boolean;
    since: string;
    completed_questions: number;
    idle_pauses: number;
    hidden_pauses: number;
    left_prep: number;
    focus_rate: number | null;
    level: AttentionLevel | null;
};

type SpeakingDayRow = { date?: string; speaking_challenge?: number };

export const buildSpeakingAttention = (input: {
    events: EventRow[];
    dailyBreakdown: SpeakingDayRow[];
    weekStartDate: string;
    since?: string;
}): SpeakingAttentionSummary => {
    const since = input.since || ATTENTION_TRACKING_SINCE;
    const available = input.weekStartDate >= since;
    const pauses = (input.events || []).filter(event => (
        event.activity_type === "other"
        && String(event.activity_key || "").startsWith("speaking-pause-")
        && Boolean(event.occurred_at)
        && taipeiDate(String(event.occurred_at)) >= since
    ));
    const countOf = (reason: string) => pauses.filter(event => event.activity_key === `speaking-pause-${reason}`).length;
    const idle = countOf("idle");
    const hidden = countOf("hidden");
    const leftPrep = countOf("left_prep");
    const completed = (input.dailyBreakdown || [])
        .filter(day => String(day.date || "") >= since)
        .reduce((sum, day) => sum + (Number(day.speaking_challenge) > 0 ? Number(day.speaking_challenge) : 0), 0);
    const denominator = completed + idle + hidden + leftPrep;
    const rate = available && denominator > 0 ? Math.round((completed / denominator) * 100) : null;
    return {
        available,
        since,
        completed_questions: completed,
        idle_pauses: idle,
        hidden_pauses: hidden,
        left_prep: leftPrep,
        focus_rate: rate,
        level: rate === null ? null : attentionLevel(rate)
    };
};

export const describeSpeakingAttention = (attention: SpeakingAttentionSummary): string => {
    if (!attention.available || attention.focus_rate === null) return "";
    const rate = roundedFocusRate(attention.focus_rate);
    return `口說專注度：${roundedLevel(rate)}（${rate}%；中途切換頁面 ${attention.hidden_pauses} 次、放著不動 ${attention.idle_pauses} 次）。`;
};
