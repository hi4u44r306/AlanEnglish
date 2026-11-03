import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../supabase/functions/assignment-manager/index.ts", import.meta.url), "utf8");

// 只抽出不碰資料庫的日期驗證函式來執行。
const start = source.indexOf("const validateAssignmentDates");
const end = source.indexOf("const hasAiTask");
assert.ok(start > 0 && end > start, "找不到 validateAssignmentDates");
const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: "ES2020" } }).outputText;
const validateAssignmentDates = new Function(`${js}; return validateAssignmentDates;`)();

test("有效日期與 23:59 截止通過，且回傳 ISO", () => {
    const result = validateAssignmentDates("2026-11-03", "2026-11-10T23:59:00+08:00");
    assert.equal(result.error, null);
    assert.equal(result.dueAt, "2026-11-10T15:59:00.000Z");
});
test("沒有截止日代表不設期限", () => {
    assert.deepEqual(validateAssignmentDates("2026-11-03", null), { error: null, dueAt: null });
});
test("錯誤格式截止日回 400 訊息而不是拋例外", () => {
    assert.doesNotThrow(() => validateAssignmentDates("2026-11-03", "bad-date"));
    assert.equal(validateAssignmentDates("2026-11-03", "bad-date").error, "截止日期格式不正確");
});
test("截止早於發布日被擋；同一天通過", () => {
    assert.equal(validateAssignmentDates("2026-11-10", "2026-11-03T23:59:00+08:00").error, "截止日期不能早於發布日期");
    assert.equal(validateAssignmentDates("2026-11-03", "2026-11-03T23:59:00+08:00").error, null);
});
test("發布日期格式錯誤被擋", () => {
    assert.equal(validateAssignmentDates("2026/11/03", null).error, "發布日期格式不正確");
    assert.equal(validateAssignmentDates("2026-13-45", null).error, "發布日期格式不正確");
});
test("兩條建立路徑都使用同一個驗證", () => {
    assert.equal((source.match(/validateAssignmentDates\(assignedDate, body\?\.due_at\)/g) || []).length, 2);
    assert.doesNotMatch(source, /new Date\(String\(body\.due_at\)\)\.toISOString\(\)/);
});
