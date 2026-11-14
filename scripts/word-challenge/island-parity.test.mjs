// 單字島前後端一致性：畫面端（src/utils/wordIsland.js）和伺服器端（Edge 用的 TypeScript）
// 對同一份進度，必須切出一樣的島、算出一樣的格子狀態。
// 執行：node --test scripts/word-challenge/island-parity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BANK_PATH } from "./generate-server-bank.mjs";
import { ISLAND_SIZE, buildIslandViews as webViews, islandWordsOf, taipeiDate as webTaipeiDate, nextTaipeiMidnightIso as webMidnight, inCooldown as webCooldown } from "../../src/utils/wordIsland.js";
import { WORD_BANK } from "../../supabase/functions/_shared/word-challenge-bank.generated.ts";
import {
    ISLAND_SIZE as SERVER_ISLAND_SIZE,
    buildIslandViews as serverViews,
    inCooldown as serverCooldown,
    islandsFor,
    nextTaipeiMidnightIso as serverMidnight,
    taipeiDate as serverTaipeiDate
} from "../../supabase/functions/_shared/word-challenge-island.ts";

const bank = JSON.parse(readFileSync(BANK_PATH, "utf8"));
const NOW = Date.parse("2026-11-14T06:00:00.000Z"); // 台北 14 日 14:00
const SAME_DAY = "2026-11-14T01:00:00.000Z"; // 台北 14 日 09:00
const YESTERDAY = "2026-11-13T09:00:00.000Z"; // 台北 13 日 17:00（隔天了）
const JUST_BEFORE_MIDNIGHT = "2026-11-13T15:59:59.000Z"; // 台北 13 日 23:59:59
const JUST_AFTER_MIDNIGHT = "2026-11-13T16:00:00.000Z"; // 台北 14 日 00:00:00

const wordsOfLevel = level => islandWordsOf(bank.words.filter(word => word.level === level && word.gloss));

test("both sides cut every level into the same islands in the same word order", () => {
    assert.equal(ISLAND_SIZE, SERVER_ISLAND_SIZE);
    for (let level = 1; level <= 6; level += 1) {
        const web = wordsOfLevel(level);
        const server = WORD_BANK.filter(word => word.level === level);
        assert.deepEqual(web.map(word => word.key), server.map(word => word.key), `level ${level} word order`);
        const serverIslands = islandsFor(level);
        assert.equal(serverIslands.flat().length, server.length);
        assert.ok(serverIslands.slice(0, -1).every(island => island.length === ISLAND_SIZE));
    }
});

test("taipei dates, midnight and cooldown agree across the day boundary", () => {
    for (const value of [NOW, Date.parse(SAME_DAY), Date.parse(YESTERDAY), Date.parse(JUST_BEFORE_MIDNIGHT), Date.parse(JUST_AFTER_MIDNIGHT)]) {
        assert.equal(webTaipeiDate(value), serverTaipeiDate(value));
        assert.equal(webMidnight(value), serverMidnight(value));
    }
    assert.equal(webMidnight(NOW), "2026-11-14T16:00:00.000Z");
    for (const missed of [SAME_DAY, YESTERDAY, JUST_BEFORE_MIDNIGHT, JUST_AFTER_MIDNIGHT, null]) {
        assert.equal(webCooldown(missed, NOW), serverCooldown(missed, NOW), String(missed));
    }
    assert.equal(serverCooldown(SAME_DAY, NOW), true);
    assert.equal(serverCooldown(YESTERDAY, NOW), false);
    assert.equal(serverCooldown(JUST_BEFORE_MIDNIGHT, NOW), false);
    assert.equal(serverCooldown(JUST_AFTER_MIDNIGHT, NOW), true);
});

test("tile states match on a mixed progress: claimed, re-missed claimed, cooling, old miss, locked", () => {
    for (let level = 1; level <= 6; level += 1) {
        const words = wordsOfLevel(level);
        const rows = [];
        // 第一座島全部佔領，其中一個之後又答錯；第二座島有今天答錯的、昨天答錯的、已佔領的；第三座島以後保持鎖定。
        words.slice(0, ISLAND_SIZE).forEach((word, index) => rows.push({ word_key: word.key, status: index === 3 ? "missed" : "mastered", first_mastered_at: YESTERDAY, last_missed_at: index === 3 ? SAME_DAY : null }));
        const second = words.slice(ISLAND_SIZE, ISLAND_SIZE * 2);
        if (second.length > 3) {
            rows.push({ word_key: second[0].key, status: "missed", first_mastered_at: null, last_missed_at: SAME_DAY });
            rows.push({ word_key: second[1].key, status: "missed", first_mastered_at: null, last_missed_at: YESTERDAY });
            rows.push({ word_key: second[2].key, status: "mastered", first_mastered_at: YESTERDAY, last_missed_at: null });
        }
        const progress = Object.fromEntries(rows.map(row => [row.word_key, { status: row.status, firstMasteredAt: row.first_mastered_at, lastMissedAt: row.last_missed_at }]));
        assert.deepEqual(webViews(words, progress, NOW), serverViews(level, rows, NOW), `level ${level}`);
    }
});

test("with no progress only the first island is open and no unclaimed tile carries the English word", () => {
    for (let level = 1; level <= 6; level += 1) {
        const views = serverViews(level, [], NOW);
        assert.equal(views[0].unlocked, true);
        assert.ok(views.slice(1).every(view => view.unlocked === false));
        assert.deepEqual(webViews(wordsOfLevel(level), {}, NOW), views);
        for (const tile of views.flatMap(view => view.tiles)) {
            assert.equal("display" in tile, false);
            assert.equal("key" in tile, false);
        }
    }
});
