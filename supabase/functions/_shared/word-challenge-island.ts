// 單字島：島怎麼分、哪些格子可以點、什麼叫「剛看過答案」。都是純函式，不碰資料庫與網路，方便單獨測試。
// 規則（擁有者 2026-11-14 決定）：
//   * 每座島 16 格，每格一個字；字庫順序本來就是「同等級由易到難」，每 16 個切成一座島，不另外存。
//   * 「已佔領」＝這個字曾經沒用提示答對過（student_word_progress.first_mastered_at 不為空）。
//   * 每格只答一次；答錯立刻公布答案，並且冷卻到台北時間隔天，隔天答對才算學會。
//   * 前一座島全部佔領，下一座島才開放。
//   * 升級（擁有者 2026-11-16 決定）：兩段式。已佔領的格子在「不同天」再答對同一個字就升級，0 剛佔領 → 1 繁榮；
//     每格每天最多升一次、不倒退；沒有全帳號每日上限（自然受每日 60 題限制）。
//   * 小雲提醒：整座島佔滿並全部升級後，7 天沒有答對或答錯任何一格，就提醒複習最久沒碰的 3 格。
import { WORD_BANK, type ServerWord } from "./word-challenge-bank.generated.ts";

export const ISLAND_SIZE = 16;
export const MAX_TILE_LEVEL = 1;
export const REVIEW_AFTER_DAYS = 7;
export const REVIEW_PICK = 3;
export const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

export type ProgressRow = {
    word_key: string;
    status: string;
    first_mastered_at: string | null;
    last_missed_at: string | null;
    last_correct_at?: string | null;
    upgrade_level?: number | null;
    last_upgraded_on?: string | null;
};

export type TileState = "claimed" | "open" | "cooldown" | "locked";

export const islandsFor = (level: number): ServerWord[][] => {
    const words = WORD_BANK.filter(word => word.level === level);
    const islands: ServerWord[][] = [];
    for (let start = 0; start < words.length; start += ISLAND_SIZE) islands.push(words.slice(start, start + ISLAND_SIZE));
    return islands;
};

export const tileWord = (level: number, island: number, tile: number): ServerWord | null => {
    if (!Number.isInteger(island) || !Number.isInteger(tile) || island < 0 || tile < 0 || tile >= ISLAND_SIZE) return null;
    return islandsFor(level)[island]?.[tile] ?? null;
};

// 台北時間的日期（YYYY-MM-DD）。
export const taipeiDate = (valueMs: number): string => new Date(valueMs + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);

// 下一個台北午夜（冷卻結束的時間點），回傳 ISO 字串。
export const nextTaipeiMidnightIso = (valueMs: number): string => {
    const day = taipeiDate(valueMs);
    return new Date(Date.parse(`${day}T00:00:00.000Z`) + 24 * 60 * 60 * 1000 - TAIPEI_OFFSET_MS).toISOString();
};

// 剛看過答案：最近一次答錯（或跳過）和現在在台北時間的同一天。隔天起才算「記起來了」。
export const inCooldown = (lastMissedAt: string | null | undefined, nowMs: number): boolean => {
    if (!lastMissedAt) return false;
    const missedMs = Date.parse(lastMissedAt);
    return Number.isFinite(missedMs) && taipeiDate(missedMs) === taipeiDate(nowMs);
};

// 注意：字的 key 就等於英文答案，所以絕對不能放進沒佔領的格子。
export type IslandTile = {
    tile: number; gloss: string; letters: number; state: TileState; review: boolean;
    display?: string; cooldown_until?: string;
    level?: number; can_upgrade?: boolean; can_practice?: boolean; stale?: boolean;
};
export type IslandView = {
    island: number; unlocked: boolean; total: number; claimed_count: number;
    level_sum: number; maxed: boolean; completed_at: string | null; needs_review: boolean; tiles: IslandTile[];
};

// 今天已經升了幾塊（台北時間）。
export const upgradesToday = (progress: ProgressRow[], nowMs: number): number => {
    const today = taipeiDate(nowMs);
    return progress.filter(row => row.last_upgraded_on === today).length;
};

// 這一格現在能不能「升級作答」：已佔領、還沒升級、佔領不是今天、今天沒升過這一格、沒有剛看過答案。
export const canUpgradeTile = (row: ProgressRow | undefined, nowMs: number): boolean => {
    if (!row?.first_mastered_at) return false;
    const level = Number(row.upgrade_level) || 0;
    if (level >= MAX_TILE_LEVEL) return false;
    const today = taipeiDate(nowMs);
    if (taipeiDate(Date.parse(row.first_mastered_at)) >= today) return false;
    if (row.last_upgraded_on && row.last_upgraded_on >= today) return false;
    return !inCooldown(row.last_missed_at, nowMs);
};

// 一整個等級的島嶼狀態。已佔領的格子才帶英文答案；其餘只帶中文與字母數。
export function buildIslandViews(level: number, progress: ProgressRow[], nowMs: number): IslandView[] {
    const byKey = new Map(progress.map(row => [row.word_key, row]));
    const islands = islandsFor(level);
    const views: IslandView[] = [];
    let previousCleared = true;
    islands.forEach((words, island) => {
        const unlocked = previousCleared;
        const tiles = words.map((word, tile): IslandTile => {
            const row = byKey.get(word.key);
            const claimed = Boolean(row?.first_mastered_at);
            const cooling = !claimed && inCooldown(row?.last_missed_at, nowMs);
            const base = { tile, gloss: word.gloss, letters: word.letters, review: !claimed && row?.status === "missed" };
            if (claimed) {
                return {
                    ...base, state: "claimed", display: word.display, review: row?.status === "missed",
                    level: Math.min(Number(row?.upgrade_level) || 0, MAX_TILE_LEVEL), can_upgrade: canUpgradeTile(row, nowMs)
                };
            }
            if (!unlocked) return { ...base, state: "locked" };
            if (cooling) return { ...base, state: "cooldown", cooldown_until: nextTaipeiMidnightIso(nowMs) };
            return { ...base, state: "open" };
        });
        const claimedCount = tiles.filter(item => item.state === "claimed").length;
        const levelSum = tiles.reduce((sum, item) => sum + (item.level ?? 0), 0);
        const maxed = claimedCount === words.length && tiles.every(item => (item.level ?? 0) >= MAX_TILE_LEVEL);
        // 小雲提醒：整座島全部升級後，7 天沒有碰（答對或答錯都算碰）就提醒複習最久沒碰的 3 格。
        let needsReview = false;
        if (maxed) {
            const touched = words.map((word, tile) => {
                const row = byKey.get(word.key);
                const stamps = [row?.last_correct_at, row?.last_missed_at, row?.first_mastered_at].map(value => (value ? Date.parse(value) : 0));
                return { tile, at: Math.max(...stamps) };
            });
            const latest = Math.max(...touched.map(item => item.at));
            needsReview = latest > 0 && nowMs - latest >= REVIEW_AFTER_DAYS * 24 * 60 * 60 * 1000;
            const stale = new Set(needsReview ? [...touched].sort((a, b) => a.at - b.at).slice(0, REVIEW_PICK).map(item => item.tile) : []);
            tiles.forEach((item, tile) => {
                item.can_practice = true;
                if (stale.has(tile)) item.stale = true;
            });
        }
        // 島佔滿的時間＝最後一格第一次學會的時間；節日限定島靠它判斷是不是在節日期間完成。
        const completedAt = claimedCount === words.length ? words.map(word => byKey.get(word.key)?.first_mastered_at ?? "").sort().pop() || null : null;
        views.push({ island, unlocked, total: words.length, claimed_count: claimedCount, level_sum: levelSum, maxed, completed_at: completedAt, needs_review: needsReview, tiles });
        previousCleared = claimedCount === words.length;
    });
    return views;
}
