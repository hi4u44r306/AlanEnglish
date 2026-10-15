import assert from "node:assert/strict";
import test from "node:test";
import { attentionLevel, buildAttention, describeAttention } from "../supabase/functions/weekly-report/attention.ts";

const day = (date, listening) => ({ date, listening });
const event = (key, iso, type = "listening") => ({ activity_type: type, activity_key: key, occurred_at: iso });
const week = [day("2026-10-12", 5), day("2026-10-13", 5), day("2026-10-14", 5), day("2026-10-15", 5), day("2026-10-16", 4), day("2026-10-17", 3), day("2026-10-18", 3)];

test("a week that ended before tracking started is not available", () => {
    const result = buildAttention({ events: [], dailyBreakdown: week, weekEndDate: "2026-10-11", since: "2026-10-16" });
    assert.equal(result.available, false);
    assert.equal(result.focus_rate, null);
    assert.equal(describeAttention(result), "");
});

test("only listens and pauses on or after the start date count", () => {
    const events = [event("pause-idle", "2026-10-14T02:00:00Z"), event("pause-hidden", "2026-10-16T02:00:00Z")];
    const result = buildAttention({ events, dailyBreakdown: week, weekEndDate: "2026-10-18", since: "2026-10-16" });
    assert.equal(result.tracked_listens, 10);
    assert.equal(result.idle_pauses, 0);
    assert.equal(result.hidden_pauses, 1);
    assert.equal(result.focus_rate, Math.round((10 / 11) * 100));
    assert.equal(result.level, "focused");
});

test("many idle and page-switch pauses lower the rate and ask for a reminder", () => {
    const events = [
        ...Array.from({ length: 6 }, (_, i) => event("pause-idle", `2026-10-17T0${i}:00:00Z`)),
        ...Array.from({ length: 6 }, (_, i) => event("pause-hidden", `2026-10-18T0${i}:00:00Z`))
    ];
    const result = buildAttention({ events, dailyBreakdown: [day("2026-10-17", 3), day("2026-10-18", 3)], weekEndDate: "2026-10-18", since: "2026-10-16" });
    assert.equal(result.focus_rate, 33);
    assert.equal(result.level, "needs_reminder");
    assert.match(describeAttention(result), /需要提醒.*放著不動自動暫停 6 次.*切換頁面暫停 6 次/);
});

test("ignores other event types and keys, and uses Taipei dates", () => {
    const events = [event("pause-idle", "2026-10-15T17:00:00Z"), event("web-login", "2026-10-17T01:00:00Z", "login"), event("something", "2026-10-17T01:00:00Z")];
    const result = buildAttention({ events, dailyBreakdown: [day("2026-10-16", 2)], weekEndDate: "2026-10-18", since: "2026-10-16" });
    assert.equal(result.idle_pauses, 1);
    assert.equal(result.hidden_pauses, 0);
});

test("no listening and no pauses means no rate, not 100 percent", () => {
    const result = buildAttention({ events: [], dailyBreakdown: [day("2026-10-17", 0)], weekEndDate: "2026-10-18", since: "2026-10-16" });
    assert.equal(result.focus_rate, null);
    assert.equal(result.level, null);
});

test("levels have clear thresholds", () => {
    assert.equal(attentionLevel(80), "focused");
    assert.equal(attentionLevel(79), "ok");
    assert.equal(attentionLevel(55), "ok");
    assert.equal(attentionLevel(54), "needs_reminder");
});
