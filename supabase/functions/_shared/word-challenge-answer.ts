// 單字大挑戰：伺服器端判斷拼字。
// 這是 src/utils/wordChallengeAnswer.js 的 TypeScript 版（只有「看中文」模式），規則必須一模一樣。
// scripts/word-challenge/answer-parity.test.mjs 會逐字比對兩邊結果；改其中一邊時一定要同步改另一邊。
import { WORD_BANK, type ServerWord } from "./word-challenge-bank.generated.ts";

export type WordCheckResult = {
    correct: boolean;
    note: "empty" | "capitalize" | "uk" | "synonym" | "oneLetter" | null;
    expected: string;
    matched?: string;
};

// 只比對英文字母：去掉空白、連字號、撇號與句點，不分大小寫，全形字母先轉半形。
export const lettersOnly = (value: unknown): string => String(value ?? "")
    .normalize("NFKC")
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();

const firstLetter = (value: unknown): string => (String(value ?? "").normalize("NFKC").match(/[A-Za-z]/) || [""])[0];

const withinOneEdit = (a: string, b: string): boolean => {
    if (a === b) return false;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            i += 1;
            j += 1;
            continue;
        }
        edits += 1;
        if (edits > 1) return false;
        if (a.length > b.length) i += 1;
        else if (a.length < b.length) j += 1;
        else {
            i += 1;
            j += 1;
        }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
};

const wordsByKey = new Map<string, ServerWord>(WORD_BANK.map(word => [word.key, word]));

// 字庫裡中文意思完全相同的其他字（例如「大的」＝ big／large）。
const glossPeers = new Map<string, string[]>();
for (const word of WORD_BANK) {
    const list = glossPeers.get(word.gloss) || [];
    list.push(word.display);
    glossPeers.set(word.gloss, list);
}

export const findServerWord = (key: string): ServerWord | null => wordsByKey.get(key) || null;

export const meaningPeersOf = (word: ServerWord): string[] =>
    (glossPeers.get(word.gloss) || []).filter(display => display !== word.display);

export function checkWordAnswer(input: unknown, word: ServerWord, meaningPeers: string[] = meaningPeersOf(word)): WordCheckResult {
    const typed = lettersOnly(input);
    const expected = word.display;
    const target = lettersOnly(expected);
    if (!typed) return { correct: false, note: "empty", expected };

    if (typed === target) {
        if (word.properNoun && firstLetter(input) && firstLetter(input) !== firstLetter(input).toUpperCase()) {
            return { correct: true, note: "capitalize", expected };
        }
        return { correct: true, note: null, expected };
    }

    const uk = (word.ukSpellings || []).find(spelling => lettersOnly(spelling) === typed);
    if (uk) return { correct: true, note: "uk", expected, matched: uk };

    const synonym = [...(word.alternates || []), ...meaningPeers].find(other => lettersOnly(other) === typed);
    if (synonym) return { correct: true, note: "synonym", expected, matched: synonym };

    return { correct: false, note: withinOneEdit(typed, target) ? "oneLetter" : null, expected };
}
