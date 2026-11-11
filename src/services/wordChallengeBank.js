import wordBank from "../data/wordChallenge/wordBank.v1.json";
import { WORD_CHALLENGE_MODES } from "../utils/wordChallengeAnswer";

export const WORD_CHALLENGE_QUESTION_COUNT = 10;
export const WORD_BANK_META = wordBank.meta;
export const WORD_BANK_VERSION = wordBank.meta.bankVersion;

const WORDS = wordBank.words;

export const WORD_CHALLENGE_LEVELS = WORD_BANK_META.levels.map(level => ({
    level: level.level,
    grade: ["一", "二", "三", "四", "五", "六"][level.level - 1] || String(level.level),
    words: level.words,
    meaningReady: level.meaningReady
}));

const glossPeers = new Map();
for (const word of WORDS) {
    if (!word.gloss) continue;
    if (!glossPeers.has(word.gloss)) glossPeers.set(word.gloss, []);
    glossPeers.get(word.gloss).push(word.display);
}

// 看中文模式：字庫裡中文意思完全相同的其他字都算對。
export const meaningPeersOf = word => (word?.gloss ? (glossPeers.get(word.gloss) || []).filter(display => display !== word.display) : []);

export const wordsForLevel = (level, mode) => WORDS.filter(word => word.level === level && (mode !== WORD_CHALLENGE_MODES.meaning || Boolean(word.gloss)));

export const findWordByKey = key => WORDS.find(word => word.key === key) || null;

const shuffle = (items, random) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
};

// 選題：先出還沒答對過的字（含之前答錯的），不夠再從已答對的字補。
export function pickQuestions(level, mode, { masteredKeys = [], onlyKeys = null, count = WORD_CHALLENGE_QUESTION_COUNT, random = Math.random } = {}) {
    const pool = onlyKeys
        ? onlyKeys.map(findWordByKey).filter(word => word && (mode !== WORD_CHALLENGE_MODES.meaning || Boolean(word.gloss)))
        : wordsForLevel(level, mode);
    const mastered = new Set(masteredKeys);
    const fresh = shuffle(pool.filter(word => !mastered.has(word.key)), random);
    const known = shuffle(pool.filter(word => mastered.has(word.key)), random);
    return [...fresh, ...known].slice(0, count);
}
