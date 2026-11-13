// 週報單字一行：不顯示 0、累計只增不減、只查自己、版本和題庫一致。
// 執行：node --test scripts/weekly-report-words.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WORD_PROGRESS_BANK_VERSION, loadWordMastery, summarizeWordMastery } from "../supabase/functions/_shared/weekly-report-words.ts";
import { WORD_BANK_VERSION } from "../supabase/functions/_shared/word-challenge-bank.generated.ts";

// 最小的假資料庫：記下每次查詢用了什麼條件，並依 first_mastered_at 過濾。
function fakeAdmin(rows, { failOn = null } = {}) {
    const calls = [];
    return {
        calls,
        from(table) {
            const query = { table, filters: [], nots: [], lts: [] };
            const builder = {
                select(_columns, options) { query.options = options; return builder; },
                eq(column, value) { query.filters.push([column, value]); return builder; },
                not(column, op, value) { query.nots.push([column, op, value]); return builder; },
                lt(column, value) {
                    query.lts.push([column, value]);
                    calls.push(query);
                    if (failOn) return Promise.resolve({ count: null, error: { message: failOn } });
                    const studentId = query.filters.find(([c]) => c === "student_id")?.[1];
                    const version = query.filters.find(([c]) => c === "bank_version")?.[1];
                    const matching = rows.filter(row => row.student_id === studentId && row.bank_version === version
                        && row.first_mastered_at !== null && row.first_mastered_at < value);
                    return Promise.resolve({ count: matching.length, error: null });
                }
            };
            return builder;
        }
    };
}

const row = (student_id, word_key, first_mastered_at, extra = {}) => ({ student_id, bank_version: "v1", word_key, first_mastered_at, ...extra });
const START = "2026-11-08T16:00:00.000Z"; // 週一 00:00 台北
const END = "2026-11-15T16:00:00.000Z";   // 下週一 00:00 台北

test("the bank version used by the report is the bank version the game writes", () => {
    assert.equal(WORD_PROGRESS_BANK_VERSION, WORD_BANK_VERSION);
    assert.match(readFileSync(new URL("../supabase/functions/_shared/weekly-report-words.ts", import.meta.url), "utf8"), /first_mastered_at/);
});

test("the example from the owner: knows 100, did not play this week → 'same as last week', never 0", () => {
    const summary = summarizeWordMastery({ total: 100, previous: 100 });
    assert.deepEqual(summary, { total_mastered: 100, previous_mastered: 100, added: 0, text: "累計會拼 100 個字，和上週一樣" });
    assert.doesNotMatch(summary.text, /本週|(^|\D)0 個/);
});

test("new words this week → 'M more than last week'", () => {
    assert.equal(summarizeWordMastery({ total: 112, previous: 100 }).text, "累計會拼 112 個字，比上週多 12 個");
    assert.equal(summarizeWordMastery({ total: 5, previous: 0 }).text, "累計會拼 5 個字，比上週多 5 個");
});

test("a student who never learned a word (or bad data) gets no line at all", () => {
    for (const input of [{ total: 0, previous: 0 }, null, undefined, {}, { total: -3, previous: 0 }, { total: "abc" }, { total: 2.5, previous: 1 }, { total: Infinity }]) {
        assert.equal(summarizeWordMastery(input), null, JSON.stringify(input));
    }
});

test("a previous count bigger than the total can never produce a negative or a drop", () => {
    const summary = summarizeWordMastery({ total: 80, previous: 95 });
    assert.equal(summary.added, 0);
    assert.equal(summary.previous_mastered, 80);
    assert.match(summary.text, /和上週一樣/);
    assert.equal(summarizeWordMastery({ total: 10, previous: -4 }).added, 10);
});

test("loadWordMastery counts words first learned before the end and before the start of the week, for that student only", async () => {
    const admin = fakeAdmin([
        row(1, "a", "2026-10-01T00:00:00Z"),
        row(1, "b", "2026-11-09T01:00:00Z"),
        row(1, "c", "2026-11-12T01:00:00Z"),
        row(1, "d", "2026-11-16T01:00:00Z"),            // 下週才學會：不算
        row(1, "e", null, { status: "missed" }),         // 從沒學會：不算
        row(1, "f", "2026-11-10T01:00:00Z", { status: "missed" }), // 學會過又答錯：仍算「曾學會」
        row(2, "a", "2026-10-02T00:00:00Z"),            // 別人：不算
        { ...row(1, "g", "2026-10-05T00:00:00Z"), bank_version: "v0" } // 別的題庫版本：不算
    ]);
    const result = await loadWordMastery(admin, 1, START, END);
    assert.deepEqual(result, { total: 4, previous: 1 });
    assert.equal(admin.calls.length, 2);
    for (const call of admin.calls) {
        assert.equal(call.table, "student_word_progress");
        assert.deepEqual(call.filters, [["student_id", 1], ["bank_version", "v1"]]);
        assert.deepEqual(call.nots, [["first_mastered_at", "is", null]]);
        assert.deepEqual(call.options, { count: "exact", head: true });
    }
    assert.deepEqual(admin.calls.map(call => call.lts[0][1]).sort(), [START, END].sort());
});

test("a learned-then-missed word still counts, so the total never goes down", async () => {
    const before = fakeAdmin([row(7, "x", "2026-10-01T00:00:00Z", { status: "mastered" })]);
    const after = fakeAdmin([row(7, "x", "2026-10-01T00:00:00Z", { status: "missed" })]);
    assert.deepEqual(await loadWordMastery(before, 7, START, END), await loadWordMastery(after, 7, START, END));
});

test("a student with no rows gets null from the summary (no line shown)", async () => {
    const mastery = await loadWordMastery(fakeAdmin([]), 9, START, END);
    assert.deepEqual(mastery, { total: 0, previous: 0 });
    assert.equal(summarizeWordMastery(mastery), null);
});

test("database errors and bad student ids are thrown so the caller can skip the line", async () => {
    await assert.rejects(loadWordMastery(fakeAdmin([], { failOn: "boom" }), 1, START, END));
    for (const bad of [0, -1, 1.5, "x", null, undefined]) await assert.rejects(loadWordMastery(fakeAdmin([]), bad, START, END), /student_id/);
});

// ── 接線（原始碼合約）：週報與 Email 都只用伺服器已確定的學生、用正確的週邊界、失敗不拖垮整份報告 ──
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("the weekly report endpoint wires the word line in safely", () => {
    const source = read("../supabase/functions/weekly-report/index.ts");
    assert.match(source, /loadWordMastery\(admin, Number\(target\.id\), week\.start_at, week\.end_at\)/);
    assert.match(source, /word_challenge: wordChallenge,/);
    assert.match(source, /單字大挑戰：\$\{wordChallenge\.text\}/);
    // 失敗只記錄、不拖垮整份報告（和請假補課區塊相同做法），日誌不帶任何學生資料。
    const block = source.slice(source.indexOf("let wordChallenge"), source.indexOf("const makeupLines"));
    assert.match(block, /try \{[\s\S]*\} catch \(error\) \{[\s\S]*console\.error/);
    assert.doesNotMatch(block, /target\.name|email/);
});

test("the guardian email wires the same line in, with the week's own boundaries, and only when there is text", () => {
    const source = read("../supabase/functions/guardian-email/index.ts");
    assert.match(source, /loadWordMastery\(admin, Number\(student\.id\), range\.startAt, range\.endAt\)/);
    assert.match(source, /word_mastery: wordMasteryText,/);
    assert.match(source, /m\.word_mastery \? \["單字大挑戰", m\.word_mastery\] : null/);
    const block = source.slice(source.indexOf("let wordMasteryText"), source.indexOf("return {", source.indexOf("let wordMasteryText")));
    assert.match(block, /try \{[\s\S]*\} catch \(error\) \{[\s\S]*console\.error/);
});

test("the student page shows the line only for a positive total and never a zero", () => {
    const source = read("../src/components/Pages/WeeklyReportStudent.jsx").replace(/\/\/.*$/gm, "");
    assert.match(source, /wordsTotal > 0 &&/);
    assert.match(source, /和上週一樣/);
    assert.doesNotMatch(source, /本週拼了|本週會拼/);
});
