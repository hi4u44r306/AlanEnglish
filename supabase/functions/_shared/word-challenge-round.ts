// 單字大挑戰：伺服器出題。都是純函式（不碰資料庫、不碰網路），方便單獨測試。
// 重點：回給前端的題目絕不含完整英文答案；字母格只有空格、符號與已給的字母。
import { WORD_BANK, type ServerWord } from "./word-challenge-bank.generated.ts";
import { findServerWord, lettersOnly } from "./word-challenge-answer.ts";

export const QUESTION_COUNT = 10;
// 看中文固定先給第一個字母（和前端 BASE_REVEALED 相同）。
export const BASE_REVEALED = 1;

export type SlotTemplate = { kind: "letter"; hint: string } | { kind: "gap" } | { kind: "symbol"; value: string };

export type RoundQuestion = {
    position: number;
    gloss: string;
    letters: number;
    template: SlotTemplate[];
};

// 安全亂數：Edge（Deno）與 Node 都有 crypto.getRandomValues。
export const secureRandom = (): number => {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] / 4294967296;
};

const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
};

// 選題：先出還沒答對過的字（含答錯的），不夠再從已答對的字補。
// onlyKeys：練錯的字那一輪，只從這些字裡選。
export function pickRoundWords(
    level: number,
    masteredKeys: Iterable<string>,
    options: { onlyKeys?: string[] | null; count?: number; random?: () => number } = {}
): ServerWord[] {
    const { onlyKeys = null, count = QUESTION_COUNT, random = secureRandom } = options;
    const pool = onlyKeys
        ? onlyKeys.map(findServerWord).filter((word): word is ServerWord => Boolean(word))
        : WORD_BANK.filter(word => word.level === level);
    const mastered = new Set(masteredKeys);
    const fresh = shuffle(pool.filter(word => !mastered.has(word.key)), random);
    const known = shuffle(pool.filter(word => mastered.has(word.key)), random);
    return [...fresh, ...known].slice(0, count);
}

// 字母格樣板：每個英文字母一格（只有已給的字母會顯示），空白是間隔，連字號與撇號照原樣。
export function buildTemplate(display: string, revealed = BASE_REVEALED): SlotTemplate[] {
    let letterIndex = 0;
    return String(display).split("").map(char => {
        if (/[A-Za-z]/.test(char)) {
            const slot: SlotTemplate = { kind: "letter", hint: letterIndex < revealed ? char : "" };
            letterIndex += 1;
            return slot;
        }
        return char === " " ? { kind: "gap" } : { kind: "symbol", value: char };
    });
}

export function toRoundQuestion(word: ServerWord, position: number, revealed = BASE_REVEALED): RoundQuestion {
    return { position, gloss: word.gloss, letters: word.letters, template: buildTemplate(word.display, revealed) };
}

// 提示：一次多給下一個字母。最多給到只剩最後一個字母沒給（和前端 revealHint 的上限相同）。
export function nextHintCount(word: ServerWord, currentHints: number): number {
    const max = Math.max(word.letters - 1 - BASE_REVEALED, 0);
    return Math.min(currentHints + 1, max);
}

export function hintTemplate(word: ServerWord, hints: number): SlotTemplate[] {
    return buildTemplate(word.display, BASE_REVEALED + hints);
}

// 一輪的成績：用了提示的題目畫面上算對，但不計入 XP；而且只有「第一次學會」的新字才算進 XP 門檻
// （擁有者 2026-11-12 決定，避免有人查答案反覆刷 XP）。實際結算在資料庫函式 finish_word_challenge_round_v1，這裡是同一套規則的純函式版本，方便測試。
export type ScoredItem = { correct: boolean; hintCount: number; skipped: boolean; newlyMastered?: boolean };

export function scoreRound(items: ScoredItem[]): { correct: number; unhintedCorrect: number; newMastered: number } {
    return {
        correct: items.filter(item => item.correct).length,
        unhintedCorrect: items.filter(item => item.correct && item.hintCount === 0).length,
        newMastered: items.filter(item => item.correct && item.hintCount === 0 && item.newlyMastered === true).length
    };
}

export const XP_PER_ROUND = 10;
export const XP_DAILY_CAP = 30;
export const XP_MIN_NEW_MASTERED = 8;

// 這一輪能拿幾 XP：練錯的字（level 0）不給；新學會的字沒到 8 個不給；每天最多 30。
export function roundXp(level: number, newMastered: number, xpAlreadyToday: number): number {
    if (!(level >= 1 && level <= 6)) return 0;
    if (newMastered < XP_MIN_NEW_MASTERED) return 0;
    return Math.max(0, Math.min(XP_PER_ROUND, XP_DAILY_CAP - Math.max(0, xpAlreadyToday)));
}

export const normalizeTyped = (value: unknown): string => String(value ?? "").slice(0, 64);
export { lettersOnly };
