// 單字島的規則（畫面端）。和 supabase/functions/_shared/word-challenge-island.ts 必須算出一樣的結果，
// scripts/word-challenge/island-parity.test.mjs 會逐等級比對。
// 規則：每座島 16 格；已佔領＝這個字曾經沒用提示答對；答錯後冷卻到台北時間隔天；前一座島佔滿才開放下一座。

export const ISLAND_SIZE = 16;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 一個等級的字依難度排序（容易的先出現）。伺服器直接用字庫順序，兩邊順序一致由測試保證。
export const islandWordsOf = words => [...words].sort((a, b) => (a.difficulty ?? 0) - (b.difficulty ?? 0));

export const splitIslands = words => {
    const islands = [];
    for (let start = 0; start < words.length; start += ISLAND_SIZE) islands.push(words.slice(start, start + ISLAND_SIZE));
    return islands;
};

export const taipeiDate = valueMs => new Date(valueMs + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);

export const nextTaipeiMidnightIso = valueMs => new Date(Date.parse(`${taipeiDate(valueMs)}T00:00:00.000Z`) + DAY_MS - TAIPEI_OFFSET_MS).toISOString();

// 剛看過答案：最近一次答錯（或跳過）和現在在台北時間的同一天。
export const inCooldown = (lastMissedAt, nowMs) => {
    if (!lastMissedAt) return false;
    const missedMs = Date.parse(lastMissedAt);
    return Number.isFinite(missedMs) && taipeiDate(missedMs) === taipeiDate(nowMs);
};

// progress：{ [word.key]: { status, firstMasteredAt, lastMissedAt } }（本機模式用；伺服器模式由伺服器直接給畫面狀態）。
export function buildIslandViews(words, progress, nowMs) {
    const islands = splitIslands(words);
    const views = [];
    let previousCleared = true;
    islands.forEach((group, island) => {
        const unlocked = previousCleared;
        const tiles = group.map((word, tile) => {
            const row = progress[word.key];
            const claimed = Boolean(row?.firstMasteredAt);
            const base = { tile, gloss: word.gloss, letters: word.letters ?? String(word.display).replace(/[^A-Za-z]/g, "").length, review: !claimed && row?.status === "missed" };
            if (claimed) return { ...base, state: "claimed", display: word.display, review: row?.status === "missed" };
            if (!unlocked) return { ...base, state: "locked" };
            if (inCooldown(row?.lastMissedAt, nowMs)) return { ...base, state: "cooldown", cooldown_until: nextTaipeiMidnightIso(nowMs) };
            return { ...base, state: "open" };
        });
        const claimedCount = tiles.filter(item => item.state === "claimed").length;
        views.push({ island, unlocked, total: group.length, claimed_count: claimedCount, tiles });
        previousCleared = claimedCount === group.length;
    });
    return views;
}
