// 老師端「單字島進度」用的純函式：把一位學生的字進度，整理成老師看得懂的幾個數字。
// 不碰資料庫與網路；島怎麼切、什麼叫佔領，全部沿用 word-challenge-island.ts，不另外寫一份規則。
import { WORD_BANK } from "./word-challenge-bank.generated.ts";
import { buildIslandViews, taipeiDate, type ProgressRow } from "./word-challenge-island.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVEL_OF = new Map<string, number>(WORD_BANK.map(word => [word.key, word.level]));
export const WORD_LEVELS: number[] = [...new Set(WORD_BANK.map(word => word.level))].sort((a, b) => a - b);

export type LevelSummary = {
    level: number;
    claimed: number;
    upgraded: number;
    islands_total: number;
    islands_full: number;
    // 第一座還沒佔滿的島（從 1 開始數）；整個等級都佔滿時是 null。
    current_island: number | null;
    current_claimed: number;
    current_total: number;
    review_islands: number;
};

export type StudentIslandSummary = {
    claimed_total: number;
    upgraded_total: number;
    review_total: number;
    last_practiced_at: string | null;
    inactive_days: number | null;
    status_code: "never" | "normal" | "warning" | "concern" | "critical";
    // 最近有動作的那個年級，以及它現在在第幾座島。
    current: { level: number; island: number | null; claimed: number; total: number; all_done: boolean } | null;
    per_level: LevelSummary[];
};

const stampMs = (value: string | null | undefined) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const touchedAt = (row: ProgressRow) => Math.max(stampMs(row.first_mastered_at), stampMs(row.last_correct_at), stampMs(row.last_missed_at));

// 以台北日曆日算「幾天沒玩」：今天玩過是 0，昨天玩過是 1。
export const inactiveDays = (lastMs: number, nowMs: number) => Math.max(0, Math.round((Date.parse(taipeiDate(nowMs)) - Date.parse(taipeiDate(lastMs))) / DAY_MS));

// 7／14／30 天的規則和老師的「學生學習狀況」頁一致。
export const statusFor = (days: number | null): StudentIslandSummary["status_code"] => {
    if (days === null) return "never";
    if (days >= 30) return "critical";
    if (days >= 14) return "concern";
    if (days >= 7) return "warning";
    return "normal";
};

export function summarizeStudentIslands(allRows: ProgressRow[], nowMs: number): StudentIslandSummary {
    // 不在字庫裡的字（舊版字庫）一律略過，避免算錯。
    const rows = allRows.filter(row => LEVEL_OF.has(row.word_key));
    const claimedRows = rows.filter(row => Boolean(row.first_mastered_at));
    const lastMs = rows.reduce((max, row) => Math.max(max, touchedAt(row)), 0);

    const perLevel: LevelSummary[] = [];
    let currentLevel: { level: number; touched: number } | null = null;
    for (const level of WORD_LEVELS) {
        const levelRows = rows.filter(row => LEVEL_OF.get(row.word_key) === level);
        const views = buildIslandViews(level, levelRows, nowMs);
        const open = views.findIndex(view => view.claimed_count < view.total);
        const shown = open >= 0 ? views[open] : null;
        perLevel.push({
            level,
            claimed: views.reduce((sum, view) => sum + view.claimed_count, 0),
            upgraded: views.reduce((sum, view) => sum + (view.level_sum ?? 0), 0),
            islands_total: views.length,
            islands_full: views.filter(view => view.claimed_count === view.total).length,
            current_island: shown ? open + 1 : null,
            current_claimed: shown ? shown.claimed_count : views.length ? views[views.length - 1].total : 0,
            current_total: shown ? shown.total : views.length ? views[views.length - 1].total : 0,
            review_islands: views.filter(view => view.needs_review).length
        });
        const touched = levelRows.reduce((max, row) => Math.max(max, touchedAt(row)), 0);
        if (touched > 0 && (!currentLevel || touched > currentLevel.touched)) currentLevel = { level, touched };
    }

    const days = lastMs > 0 ? inactiveDays(lastMs, nowMs) : null;
    const focus = currentLevel ? perLevel.find(item => item.level === currentLevel!.level) ?? null : null;
    return {
        claimed_total: claimedRows.length,
        upgraded_total: claimedRows.filter(row => (Number(row.upgrade_level) || 0) >= 1).length,
        review_total: rows.filter(row => row.status === "missed").length,
        last_practiced_at: lastMs > 0 ? new Date(lastMs).toISOString() : null,
        inactive_days: days,
        status_code: statusFor(days),
        current: focus
            ? { level: focus.level, island: focus.current_island, claimed: focus.current_claimed, total: focus.current_total, all_done: focus.current_island === null }
            : null,
        per_level: perLevel
    };
}
