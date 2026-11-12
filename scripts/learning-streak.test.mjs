import assert from "node:assert/strict";
import test from "node:test";
import { computeLearningStreak } from "../supabase/functions/_shared/learning-streak.ts";

// 2026-11-12 是週四。那週的星期一是 11-09。
const TODAY = "2026-11-12";
const days = (...list) => list;
const range = (from, count) => Array.from({ length: count }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));

test("完全沒紀錄：0 天", () => {
    const result = computeLearningStreak([], TODAY);
    assert.equal(result.current, 0);
    assert.equal(result.today_done, false);
});

test("今天還沒練習，不算漏掉：昨天以前連續的照算", () => {
    const result = computeLearningStreak(days("2026-11-10", "2026-11-11"), TODAY);
    assert.equal(result.current, 2);
    assert.equal(result.today_done, false);
});

test("今天也練習了：連同今天一起算", () => {
    const result = computeLearningStreak(days("2026-11-10", "2026-11-11", "2026-11-12"), TODAY);
    assert.equal(result.current, 3);
    assert.equal(result.today_done, true);
});

test("同一週漏 1 天用免死金牌，連續不中斷，但那天不算天數", () => {
    // 週一、二有做，週三漏，週四有做 → 3 天，週三是金牌
    const result = computeLearningStreak(days("2026-11-09", "2026-11-10", "2026-11-12"), TODAY);
    assert.equal(result.current, 3);
    assert.deepEqual(result.week.map(day => day.status), ["done", "done", "shield", "done", "future", "future", "future"]);
});

test("同一週漏 2 天：第二個漏掉的就中斷", () => {
    // 週一做、週二漏(金牌)、週三漏(中斷)、週四做 → 只有週四 1 天
    const result = computeLearningStreak(days("2026-11-09", "2026-11-12"), TODAY);
    assert.equal(result.current, 1);
});

test("不同週各有 1 次金牌", () => {
    // 上週三漏、本週三漏，其他天都有做
    const dates = [...range("2026-11-02", 7), ...range("2026-11-09", 4)].filter(date => date !== "2026-11-04" && date !== "2026-11-11");
    const result = computeLearningStreak(dates, TODAY);
    assert.equal(result.current, dates.length);
});

test("沒有更早的紀錄時不會用金牌：新同學第一天就是 1 天", () => {
    const result = computeLearningStreak(days("2026-11-12"), TODAY);
    assert.equal(result.current, 1);
});

test("斷了很多天之後重新開始，從頭算", () => {
    const result = computeLearningStreak(days("2026-10-01", "2026-10-02", "2026-11-12"), TODAY);
    assert.equal(result.current, 1);
});

test("長期連續 400 天", () => {
    const dates = range("2025-10-09", 400); // 到 2026-11-12
    assert.equal(dates.at(-1), TODAY);
    assert.equal(computeLearningStreak(dates, TODAY).current, 400);
});

test("未來日期、格式錯誤的資料會被忽略", () => {
    const result = computeLearningStreak(["2026-11-13", "abc", "", "2026-11-12"], TODAY);
    assert.equal(result.current, 1);
});

test("最長紀錄：中斷後 current 變小，longest 仍保留之前最長的一次", () => {
    const old = range("2026-09-01", 100); // 9/1～12/9? 先截到 10/9
    const longRun = old.filter(date => date <= "2026-10-09"); // 39 天
    const result = computeLearningStreak([...longRun, "2026-11-12"], TODAY);
    assert.equal(result.current, 1);
    assert.equal(result.longest, longRun.length);
});

test("longest 不會小於 current", () => {
    const result = computeLearningStreak(days("2026-11-10", "2026-11-11", "2026-11-12"), TODAY);
    assert.equal(result.longest, 3);
});
