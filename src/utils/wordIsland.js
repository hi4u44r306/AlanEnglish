// 單字島的規則（畫面端）。和 supabase/functions/_shared/word-challenge-island.ts 必須算出一樣的結果，
// scripts/word-challenge/island-parity.test.mjs 會逐等級比對。
// 規則：每座島 16 格；已佔領＝這個字曾經沒用提示答對；答錯後冷卻到台北時間隔天；前一座島佔滿才開放下一座。

export const ISLAND_SIZE = 16;
export const MAX_TILE_LEVEL = 1;
export const REVIEW_AFTER_DAYS = 7;
export const REVIEW_PICK = 3;
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

// 升級（兩段式）：已佔領的格子在「不同天」再答對就升級（0 剛佔領 → 1 繁榮），每格每天最多一次、不倒退、沒有全帳號每日上限。
// 小雲：整座島全部升級後，7 天沒碰就提醒複習最久沒碰的 3 格；升滿的島可以隨時練習任何一格。
export const upgradesToday = (progress, nowMs) => Object.values(progress).filter(row => row?.lastUpgradedOn === taipeiDate(nowMs)).length;

export const canUpgradeTile = (row, nowMs) => {
    if (!row?.firstMasteredAt) return false;
    if ((Number(row.upgradeLevel) || 0) >= MAX_TILE_LEVEL) return false;
    const today = taipeiDate(nowMs);
    if (taipeiDate(Date.parse(row.firstMasteredAt)) >= today) return false;
    if (row.lastUpgradedOn && row.lastUpgradedOn >= today) return false;
    return !inCooldown(row.lastMissedAt, nowMs);
};

// progress：{ [word.key]: { status, firstMasteredAt, lastMissedAt, lastCorrectAt, upgradeLevel, lastUpgradedOn } }（本機模式用；伺服器模式由伺服器直接給畫面狀態）。
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
            if (claimed) {
                return {
                    ...base, state: "claimed", display: word.display, claimed_at: row?.firstMasteredAt ?? null, review: row?.status === "missed",
                    level: Math.min(Number(row?.upgradeLevel) || 0, MAX_TILE_LEVEL), can_upgrade: canUpgradeTile(row, nowMs)
                };
            }
            if (!unlocked) return { ...base, state: "locked" };
            if (inCooldown(row?.lastMissedAt, nowMs)) return { ...base, state: "cooldown", cooldown_until: nextTaipeiMidnightIso(nowMs) };
            return { ...base, state: "open" };
        });
        const claimedCount = tiles.filter(item => item.state === "claimed").length;
        const levelSum = tiles.reduce((sum, item) => sum + (item.level ?? 0), 0);
        const maxed = claimedCount === group.length && tiles.every(item => (item.level ?? 0) >= MAX_TILE_LEVEL);
        let needsReview = false;
        if (maxed) {
            const touched = group.map((word, tile) => {
                const row = progress[word.key];
                return { tile, at: Math.max(...[row?.lastCorrectAt, row?.lastMissedAt, row?.firstMasteredAt].map(value => (value ? Date.parse(value) : 0))) };
            });
            const latest = Math.max(...touched.map(item => item.at));
            needsReview = latest > 0 && nowMs - latest >= REVIEW_AFTER_DAYS * DAY_MS;
            const stale = new Set(needsReview ? [...touched].sort((a, b) => a.at - b.at).slice(0, REVIEW_PICK).map(item => item.tile) : []);
            tiles.forEach((item, tile) => {
                item.can_practice = true;
                if (stale.has(tile)) item.stale = true;
            });
        }
        const completedAt = claimedCount === group.length ? group.map(word => progress[word.key]?.firstMasteredAt ?? "").sort().pop() || null : null;
        views.push({ island, unlocked, total: group.length, claimed_count: claimedCount, level_sum: levelSum, maxed, completed_at: completedAt, needs_review: needsReview, tiles });
        previousCleared = claimedCount === group.length;
    });
    return views;
}
