import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSpeakingAudioUsage, speakingAudioMonth } from "../supabase/functions/_shared/speaking-audio-usage.ts";

const now = new Date("2026-10-04T07:00:00Z");
const mockAdmin = ({ limit = 7200, rows = [], policyError = null, requestError = null, pageSize = 1000 } = {}) => {
    const calls = [];
    return { calls, from(table) {
        const query = { table, filters: [], columns: "" };
        calls.push(query);
        const builder = {
            select(columns) { query.columns = columns; return builder; },
            eq(key, value) { query.filters.push(["eq", key, value]); return builder; },
            gte(key, value) { query.filters.push(["gte", key, value]); return builder; },
            lt(key, value) { query.filters.push(["lt", key, value]); return builder; },
            order() { return builder; },
            async maybeSingle() { return { data: { student_monthly_seconds: limit, global_monthly_seconds: 360000 }, error: policyError }; },
            async range(start, end) {
                query.range = [start, end];
                return { data: rows.slice(start, Math.min(end + 1, start + pageSize)), count: rows.length, error: requestError };
            }
        };
        return builder;
    } };
};

test("台北月界線含跨年，不依 UTC 月份重置", () => {
    assert.deepEqual(speakingAudioMonth(new Date("2026-12-31T16:01:00Z")), {
        starts_at: "2026-12-31T16:00:00.000Z", resets_at: "2027-01-31T16:00:00.000Z"
    });
});
test("只讀已驗證學生的本月秒數，失敗／歷史未知時長照後端預留規則計入", async () => {
    const admin = mockAdmin({ rows: [
        { audio_seconds: 3 }, { audio_seconds: 25 },
        { audio_seconds: null, interaction_type: "alphabet_round" },
        { audio_seconds: null, interaction_type: "letter_spelling" },
        { audio_seconds: null, interaction_type: "standard_sentence" }
    ] });
    assert.deepEqual(await loadSpeakingAudioUsage(admin, 7, now), {
        status: "ready", limit_seconds: 7200, used_seconds: 77, remaining_seconds: 7123,
        resets_at: "2026-10-31T16:00:00.000Z"
    });
    assert.equal(admin.calls[1].columns, "audio_seconds,interaction_type");
    assert.deepEqual(admin.calls[1].filters, [
        ["eq", "student_id", 7], ["gte", "created_at", "2026-09-30T16:00:00.000Z"],
        ["lt", "created_at", now.toISOString()]
    ]);
});
test("超過 1000 筆與低於預設頁長都讀完，不誤報還有額度", async () => {
    const admin = mockAdmin({ rows: Array.from({ length: 1003 }, () => ({ audio_seconds: 7 })), pageSize: 500 });
    const usage = await loadSpeakingAudioUsage(admin, 7, now);
    assert.equal(usage.used_seconds, 7021);
    assert.equal(usage.remaining_seconds, 179);
    assert.deepEqual(admin.calls.slice(1).map(query => query.range[0]), [0, 500, 1000]);
});
test("無用量是完整額度，超額是零；上限讀正式設定而非前端固定值", async () => {
    assert.equal((await loadSpeakingAudioUsage(mockAdmin(), 7, now)).remaining_seconds, 7200);
    assert.equal((await loadSpeakingAudioUsage(mockAdmin({ limit: 10, rows: [{ audio_seconds: 12 }] }), 7, now)).remaining_seconds, 0);
});
test("讀取錯誤／空政策／非法秒數不能冒充未使用或洩漏資料庫錯誤", async () => {
    for (const options of [{ policyError: new Error("private error") }, { requestError: new Error("private error") },
        { limit: null }, { rows: [{ audio_seconds: 0 }] }, { rows: [{ audio_seconds: 26 }] }]) {
        assert.deepEqual(await loadSpeakingAudioUsage(mockAdmin(options), 7, now), { status: "unavailable" });
    }
    const admin = mockAdmin();
    assert.deepEqual(await loadSpeakingAudioUsage(admin, 0, now), { status: "unavailable" });
    assert.equal(admin.calls.length, 0);
});
