import assert from "node:assert/strict";
import test from "node:test";
import { ATTENTION_TRACKING_SINCE, attentionLevel, buildAttention, describeAttention, roundedFocusRate } from "../supabase/functions/weekly-report/attention.ts";

const day = (date, listening) => ({ date, listening });
const event = (key, iso, type = "listening") => ({ activity_type: type, activity_key: key, occurred_at: iso });
// 以台灣時間的週一到週日為一週：10/19（一）～10/25（日）
const week = [day("2026-10-19", 5), day("2026-10-20", 5), day("2026-10-21", 5), day("2026-10-22", 5), day("2026-10-23", 4), day("2026-10-24", 3), day("2026-10-25", 3)];

test("tracking starts on a Monday so every report week is either fully tracked or not shown", () => {
    assert.equal(new Date(`${ATTENTION_TRACKING_SINCE}T00:00:00Z`).getUTCDay(), 1);
});

test("a week that starts before the tracking date is not available, even if it ends after it", () => {
    const partial = buildAttention({ events: [], dailyBreakdown: week, weekStartDate: "2026-10-12", since: "2026-10-19" });
    assert.equal(partial.available, false);
    assert.equal(partial.focus_rate, null);
    assert.equal(describeAttention(partial), "");
});

test("a fully tracked week counts every listen and pause in it", () => {
    const events = [event("pause-idle", "2026-10-20T02:00:00Z"), event("pause-hidden", "2026-10-21T02:00:00Z")];
    const result = buildAttention({ events, dailyBreakdown: week, weekStartDate: "2026-10-19", since: "2026-10-19" });
    assert.equal(result.available, true);
    assert.equal(result.tracked_listens, 30);
    assert.equal(result.idle_pauses, 1);
    assert.equal(result.hidden_pauses, 1);
    assert.equal(result.focus_rate, Math.round((30 / 32) * 100));
    assert.equal(result.level, "focused");
});

test("many idle and page-switch pauses lower the rate and ask for a reminder", () => {
    const events = [
        ...Array.from({ length: 6 }, (_, i) => event("pause-idle", `2026-10-21T0${i}:00:00Z`)),
        ...Array.from({ length: 6 }, (_, i) => event("pause-hidden", `2026-10-22T0${i}:00:00Z`))
    ];
    const result = buildAttention({ events, dailyBreakdown: [day("2026-10-21", 3), day("2026-10-22", 3)], weekStartDate: "2026-10-19", since: "2026-10-19" });
    assert.equal(result.focus_rate, 33);
    assert.equal(result.level, "needs_reminder");
    assert.match(describeAttention(result), /需要提醒.*放著不動自動暫停 6 次.*切換頁面暫停 6 次/);
});

test("ignores other event types and keys, and uses Taipei dates", () => {
    // 2026-10-19T17:00Z 是台灣時間 10/20 01:00，仍在這一週內
    const events = [event("pause-idle", "2026-10-19T17:00:00Z"), event("web-login", "2026-10-20T01:00:00Z", "login"), event("something", "2026-10-20T01:00:00Z")];
    const result = buildAttention({ events, dailyBreakdown: [day("2026-10-20", 2)], weekStartDate: "2026-10-19", since: "2026-10-19" });
    assert.equal(result.idle_pauses, 1);
    assert.equal(result.hidden_pauses, 0);
});

test("no listening and no pauses means no rate, not 100 percent", () => {
    const result = buildAttention({ events: [], dailyBreakdown: [day("2026-10-20", 0)], weekStartDate: "2026-10-19", since: "2026-10-19" });
    assert.equal(result.focus_rate, null);
    assert.equal(result.level, null);
});

test("levels have clear thresholds", () => {
    assert.equal(attentionLevel(80), "focused");
    assert.equal(attentionLevel(79), "ok");
    assert.equal(attentionLevel(55), "ok");
    assert.equal(attentionLevel(54), "needs_reminder");
});

test("家長摘要的專注度只顯示整十，等級依整十後的數字", () => {
    assert.deepEqual([95, 94, 63, 55, 28].map(roundedFocusRate), [100, 90, 60, 60, 30]);
    const base = { available: true, since: ATTENTION_TRACKING_SINCE, tracked_listens: 10, idle_pauses: 1, hidden_pauses: 0, level: "ok" };
    assert.match(describeAttention({ ...base, focus_rate: 77 }), /^專注度：專注（80%；/);
    assert.match(describeAttention({ ...base, focus_rate: 55 }), /^專注度：普通（60%；/);
    assert.match(describeAttention({ ...base, focus_rate: 33 }), /^專注度：需要提醒（30%；/);
});
