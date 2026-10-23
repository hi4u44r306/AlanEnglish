import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeRecentListening } from "../supabase/functions/_shared/recent-listening.ts";

const books = [{ id: 1, code: "wb1" }, { id: 2, code: "wb2" }];
const tracks = [
    { id: 10, book_id: 1, page: "P4", music_name: "Hello", enabled: true },
    { id: 11, book_id: 1, page: "P5", music_name: "Colors", enabled: true },
    { id: 20, book_id: 2, page: "P1", title: "Intro", enabled: true },
    { id: 30, book_id: 2, page: "P9", music_name: "Off", enabled: false }
];

test("每本教材只留最新的一首，最新的書排前面", () => {
    const result = shapeRecentListening([
        { track_id: 10, last_played_at: "2026-10-20T01:00:00Z" },
        { track_id: 11, last_played_at: "2026-10-21T01:00:00Z" },
        { track_id: 20, last_played_at: "2026-10-22T01:00:00Z" }
    ], tracks, books);
    assert.deepEqual(result.map(item => [item.book_code, item.track_id, item.page]), [["wb2", 20, "P1"], ["wb1", 11, "P5"]]);
    assert.equal(result[0].track_title, "Intro", "沒有 music_name 時用 title");
});

test("停用的音檔、找不到書、沒有時間的紀錄都略過", () => {
    const result = shapeRecentListening([
        { track_id: 30, last_played_at: "2026-10-23T01:00:00Z" },
        { track_id: 999, last_played_at: "2026-10-23T02:00:00Z" },
        { track_id: 10, last_played_at: null },
        { track_id: 11, last_played_at: "2026-10-21T01:00:00Z" }
    ], tracks, books);
    assert.deepEqual(result.map(item => item.track_id), [11]);
});

test("上限 12 本，空資料回空陣列", () => {
    assert.deepEqual(shapeRecentListening([], [], []), []);
    const many = Array.from({ length: 20 }, (_, i) => i + 1);
    const result = shapeRecentListening(many.map(i => ({ track_id: i, last_played_at: `2026-10-${String(i).padStart(2, "0")}T00:00:00Z` })),
        many.map(i => ({ id: i, book_id: i, page: "P1", music_name: "t", enabled: true })), many.map(i => ({ id: i, code: `b${i}` })));
    assert.equal(result.length, 12);
});
