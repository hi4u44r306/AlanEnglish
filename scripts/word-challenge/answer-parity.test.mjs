// 前後端一致性：伺服器版（Edge 用的 TypeScript）和前端版（畫面用的 JavaScript）對同一個答案，結果必須完全相同。
// 執行：node --test scripts/word-challenge/answer-parity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BANK_PATH, SERVER_BANK_PATH, buildServerBankSource, serverWords } from "./generate-server-bank.mjs";
import { WORD_CHALLENGE_MODES, buildLetterSlots, checkWordAnswer as webCheck } from "../../src/utils/wordChallengeAnswer.js";
import { WORD_BANK, WORD_BANK_VERSION } from "../../supabase/functions/_shared/word-challenge-bank.generated.ts";
import { checkWordAnswer as serverCheck, meaningPeersOf as serverPeers, findServerWord } from "../../supabase/functions/_shared/word-challenge-answer.ts";
import {
    BASE_REVEALED,
    QUESTION_COUNT,
    buildTemplate,
    hintTemplate,
    nextHintCount,
    pickRoundWords,
    roundXp,
    scoreRound,
    toRoundQuestion
} from "../../supabase/functions/_shared/word-challenge-round.ts";

const bank = JSON.parse(readFileSync(BANK_PATH, "utf8"));
const webWords = bank.words.filter(word => word.gloss);
const lettersOnlyOf = value => value.replace(/[^A-Za-z]/g, "").toLowerCase();

// 前端 src/services/wordChallengeBank.js 的 meaningPeersOf 規則（那個檔案直接 import JSON，Node 載不進來，所以這裡照同樣規則算，並在下面用原始碼文字確認規則沒變）。
const glossGroups = new Map();
for (const word of bank.words) {
    if (!word.gloss) continue;
    glossGroups.set(word.gloss, [...(glossGroups.get(word.gloss) || []), word.display]);
}
const webPeers = word => (word?.gloss ? (glossGroups.get(word.gloss) || []).filter(display => display !== word.display) : []);
const bankSource = readFileSync(new URL("../../src/services/wordChallengeBank.js", import.meta.url), "utf8");
const webSource = readFileSync(new URL("../../src/components/Pages/WordChallenge.jsx", import.meta.url), "utf8");

test("the web rules this test copies have not drifted", () => {
    assert.match(bankSource, /meaningPeersOf = word => \(word\?\.gloss \? \(glossPeers\.get\(word\.gloss\) \|\| \[\]\)\.filter\(display => display !== word\.display\) : \[\]\)/);
    assert.match(bankSource, /WORD_CHALLENGE_QUESTION_COUNT = 10;/);
    assert.match(webSource, /const BASE_REVEALED = 1;/);
    assert.match(webSource, /hints >= Math\.max\(current\.letters - 1 - BASE_REVEALED, 0\)/);
});

test("the generated server bank is exactly what the generator produces (no hand edits, not stale)", () => {
    // Windows 的 Git 可能把換行轉成 CRLF，內容相同就好。
    assert.equal(readFileSync(SERVER_BANK_PATH, "utf8").split("\r").join(""), buildServerBankSource(bank));
    assert.equal(WORD_BANK_VERSION, bank.meta.bankVersion);
    assert.equal(WORD_BANK.length, 672);
    assert.deepEqual(WORD_BANK, serverWords(bank));
});

test("the server bank carries no dictionary sources, homophones or ranking data", () => {
    for (const word of WORD_BANK) {
        for (const field of ["source", "homophones", "difficulty", "frequencyRank", "topic"]) assert.equal(word[field], undefined, `${word.key}.${field}`);
    }
});

const variants = word => {
    const typed = new Set([
        word.display,
        word.display.toUpperCase(),
        word.display.toLowerCase(),
        ` ${word.display} `,
        word.display.replace(/ /g, ""),
        word.display.replace(/ /g, "-"),
        word.display.slice(0, -1),
        `${word.display}x`,
        `x${word.display.slice(1)}`,
        word.display.slice(0, 1) + word.display.slice(2),
        "",
        "   ",
        "1234",
        "ｂｉｇ",
        "ＡＢＣ",
        "zzzzzz",
        "a".repeat(80)
    ]);
    for (const other of [...(word.alternates || []), ...(word.ukSpellings || [])]) {
        typed.add(other);
        typed.add(other.toUpperCase());
    }
    return [...typed];
};

test("every one of the 672 words is judged identically by the web and server versions", () => {
    let checked = 0;
    for (const word of webWords) {
        const serverWord = findServerWord(word.key);
        assert.ok(serverWord, `server is missing ${word.key}`);
        assert.deepEqual(serverPeers(serverWord), webPeers(word), `peers of ${word.key}`);
        for (const typed of variants(word)) {
            const web = webCheck(typed, word, WORD_CHALLENGE_MODES.meaning, webPeers(word));
            const server = serverCheck(typed, serverWord);
            assert.deepEqual(server, web, `${word.key} typed ${JSON.stringify(typed)}`);
            checked += 1;
        }
    }
    assert.ok(checked > 8000, `only ${checked} comparisons`);
});

test("words sharing the same Chinese meaning accept each other, in both versions", () => {
    const big = webWords.find(word => word.key === "big");
    const large = webWords.find(word => word.key === "large");
    assert.ok(big && large);
    for (const [from, to] of [[big, large], [large, big]]) {
        const server = serverCheck(to.display, findServerWord(from.key));
        assert.equal(server.correct, true);
        assert.equal(server.note, "synonym");
    }
});

test("proper nouns, UK spellings and one-letter slips keep their notes", () => {
    assert.deepEqual(serverCheck("june", findServerWord("june")), { correct: true, note: "capitalize", expected: "June" });
    assert.equal(serverCheck("grey", findServerWord("gray")).note, "uk");
    assert.equal(serverCheck("mom", findServerWord("mother")).note, "synonym");
    assert.equal(serverCheck("mothe", findServerWord("mother")).note, "oneLetter");
    assert.equal(serverCheck("", findServerWord("mother")).note, "empty");
});

test("the letter template matches the web letter slots and never leaks the answer", () => {
    for (const word of webWords) {
        for (const revealed of [BASE_REVEALED, BASE_REVEALED + 1, BASE_REVEALED + 3]) {
            const webSlots = buildLetterSlots(word.display, "", revealed);
            const template = buildTemplate(word.display, revealed);
            assert.equal(template.length, webSlots.length);
            template.forEach((slot, index) => {
                const expected = webSlots[index];
                if (expected.kind === "letter") assert.deepEqual(slot, { kind: "letter", hint: expected.hint });
                else if (expected.kind === "gap") assert.deepEqual(slot, { kind: "gap" });
                else assert.deepEqual(slot, { kind: "symbol", value: expected.value });
            });
        }
        const question = toRoundQuestion(findServerWord(word.key), 0);
        const given = question.template.filter(slot => slot.kind === "letter" && slot.hint).length;
        assert.equal(given, Math.min(BASE_REVEALED, word.letters));
        // 回給前端的題目文字裡不能出現完整答案（單字很短時可能剛好是字母巧合，所以只檢查字母數大於已給字母的字）。
        if (word.letters > BASE_REVEALED + 1) {
            // 欄位值（kind 等固定名稱除外）不能剛好拼出答案。
            const values = [];
            const collect = (node, key) => {
                if (typeof node === "string") { if (key !== "kind") values.push(node.toLowerCase()); }
                else if (Array.isArray(node)) node.forEach(item => collect(item, key));
                else if (node && typeof node === "object") Object.entries(node).forEach(([k, v]) => collect(v, k));
            };
            collect(question, "");
            assert.equal(values.includes(word.display.toLowerCase()), false, word.key);
            // 所有已給的字母連起來，也不能是完整答案。
            const givenLetters = question.template.filter(slot => slot.kind === "letter").map(slot => slot.hint).join("");
            assert.notEqual(givenLetters.toLowerCase(), lettersOnlyOf(word.display), word.key);
            assert.equal("display" in question || "key" in question, false);
        }
    }
});

test("hints give one more letter each time and stop with the last letter still hidden", () => {
    const word = findServerWord("mother");
    let hints = 0;
    const seen = [];
    for (let step = 0; step < 10; step += 1) {
        hints = nextHintCount(word, hints);
        seen.push(hints);
    }
    assert.equal(Math.max(...seen), word.letters - 1 - BASE_REVEALED);
    const given = hintTemplate(word, hints).filter(slot => slot.kind === "letter" && slot.hint).length;
    assert.equal(given, word.letters - 1);
    // 兩個字母的字沒有提示可以給。
    const short = WORD_BANK.find(item => item.letters <= 2);
    if (short) assert.equal(nextHintCount(short, 0), 0);
});

test("round picking: ten words of the level, fresh words first, only-keys rounds stay inside the list", () => {
    const level3 = WORD_BANK.filter(word => word.level === 3);
    const picked = pickRoundWords(3, []);
    assert.equal(picked.length, QUESTION_COUNT);
    assert.equal(QUESTION_COUNT, 10);
    assert.equal(new Set(picked.map(word => word.key)).size, QUESTION_COUNT);
    assert.ok(picked.every(word => word.level === 3));

    const masteredAllButTen = level3.slice(10).map(word => word.key);
    const fresh = pickRoundWords(3, masteredAllButTen).map(word => word.key).sort();
    assert.deepEqual(fresh, level3.slice(0, 10).map(word => word.key).sort());

    const only = ["big", "large", "mother", "not-a-word"];
    const missed = pickRoundWords(0, [], { onlyKeys: only });
    assert.deepEqual(missed.map(word => word.key).sort(), ["big", "large", "mother"]);

    // 固定亂數時結果可重現。
    const seeded = () => 0.25;
    assert.deepEqual(pickRoundWords(2, [], { random: seeded }).map(word => word.key), pickRoundWords(2, [], { random: seeded }).map(word => word.key));
});

test("round score and XP: only first-time-learned, hint-free words count toward 8; missed-word rounds give none; 30 a day at most", () => {
    const items = (correct, hinted, fresh) => Array.from({ length: 10 }, (_, index) => ({
        correct: index < correct,
        hintCount: index < hinted ? 1 : 0,
        skipped: false,
        newlyMastered: index < fresh
    }));
    assert.deepEqual(scoreRound(items(9, 2, 9)), { correct: 9, unhintedCorrect: 7, newMastered: 7 });
    assert.deepEqual(scoreRound(items(9, 0, 9)), { correct: 9, unhintedCorrect: 9, newMastered: 9 });
    // 全對但字都學會過了：不算新學會。
    assert.deepEqual(scoreRound(items(10, 0, 0)), { correct: 10, unhintedCorrect: 10, newMastered: 0 });

    assert.equal(roundXp(2, 8, 0), 10);
    assert.equal(roundXp(2, 7, 0), 0);
    assert.equal(roundXp(0, 10, 0), 0);
    assert.equal(roundXp(7, 10, 0), 0);
    assert.equal(roundXp(1, 10, 20), 10);
    assert.equal(roundXp(1, 10, 25), 5);
    assert.equal(roundXp(1, 10, 30), 0);
    assert.equal(roundXp(1, 10, 99), 0);
});
