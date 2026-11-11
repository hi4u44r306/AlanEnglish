import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    assignLevels,
    findVerifiedGloss,
    makeKey,
    parseCedict,
    parseCmudict,
    parseEcdictTranslation,
    parseSourceEntry,
    stressedPronunciation,
    topicWordSet
} from "./word-bank-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const bank = JSON.parse(readFileSync(path.join(here, "../../src/data/wordChallenge/wordBank.v1.json"), "utf8"));
const exclusions = JSON.parse(readFileSync(path.join(here, "source/gloss-exclusions.json"), "utf8"));

test("source entries: parentheses, inflections and exclusions follow fixed rules", () => {
    assert.deepEqual(parseSourceEntry("airplane (plane)"), { raw: "airplane (plane)", main: "airplane", alternates: ["plane"], isInflection: false, properNoun: false, excludedReason: null });
    assert.deepEqual(parseSourceEntry("be (am, is, are, was, were, been)").alternates, []);
    assert.deepEqual(parseSourceEntry("good-bye (goodbye, bye)").alternates, ["goodbye", "bye"]);
    assert.deepEqual(parseSourceEntry("doctor (Dr.)").alternates, []);
    assert.equal(parseSourceEntry("a.m.").excludedReason, "abbreviation");
    assert.equal(parseSourceEntry("R.O.C./ROC").excludedReason, "slash");
    assert.equal(parseSourceEntry("I (me, my, mine, myself)").excludedReason, "single-letter");
    assert.equal(parseSourceEntry("OK").excludedReason, "abbreviation");
    assert.equal(parseSourceEntry("ice cream").excludedReason, null);
    assert.equal(parseSourceEntry("Monday").properNoun, true);
});

test("keys are unique; a proper noun that collides gets a suffix", () => {
    const taken = new Set();
    assert.equal(makeKey("may", false, taken), "may");
    assert.equal(makeKey("May", true, taken), "may-name");
    assert.equal(makeKey("ice cream", false, taken), "ice-cream");
    assert.equal(makeKey("o'clock", false, taken), "oclock");
});

test("gloss needs both dictionaries to agree on the primary meaning", () => {
    const cedict = parseCedict([
        "貓 猫 [mao1] /cat/CL:隻|只[zhi1]/",
        "罐頭 罐头 [guan4 tou5] /tin; can/",
        "能 能 [neng2] /to be able to; to be capable of/",
        "出租車 出租车 [chu1 zu1 che1] /taxi/(Tw) rental car/",
        "蝦米 虾米 [xia1 mi3] /small shrimp/(Tw) what/",
        "生氣 生气 [sheng1 qi4] /to get angry; to be furious/vitality/"
    ].join("\n"));
    assert.deepEqual(findVerifiedGloss("cat", { translation: "n. 猫" }, cedict)?.zh, "貓");
    // can 的主要意思（第一行）是「能」，CC-CEDICT 的「能」不是 can → 不出看中文題（不會退而求其次用「罐頭」）。
    assert.equal(findVerifiedGloss("can", { translation: "aux. 能\\nn. 罐头" }, cedict), null);
    // 有台灣特殊用法標記的詞不用。
    assert.equal(findVerifiedGloss("taxi", { translation: "n. 出租车" }, cedict), null);
    assert.equal(findVerifiedGloss("angry", { translation: "a. 生气的, 愤怒的" }, cedict)?.zh, "生氣的");
});

test("ECDICT translation lines skip tagged lines and strip notes", () => {
    assert.deepEqual(parseEcdictTranslation("n. 电脑, 电子计算机\\n[计] 计算机"), [{ pos: "n.", terms: ["电脑", "电子计算机"] }]);
});

test("homophones only use words with a single stressed pronunciation", () => {
    const prons = parseCmudict("two T UW1\ntoo T UW1\nread R EH1 D\nread(2) R IY1 D\nred R EH1 D\n");
    assert.equal(stressedPronunciation(prons, "two"), stressedPronunciation(prons, "too"));
    assert.equal(stressedPronunciation(prons, "read"), null);
});

test("levels are deterministic and topic words come earlier", () => {
    const items = [
        { key: "cat", letters: 3, frequencyRank: 3000, topic: true },
        { key: "though", letters: 6, frequencyRank: 300, topic: false },
        { key: "tiger", letters: 5, frequencyRank: 4000, topic: true },
        { key: "whose", letters: 5, frequencyRank: 900, topic: false },
        { key: "dog", letters: 3, frequencyRank: 2000, topic: true },
        { key: "quite", letters: 5, frequencyRank: 700, topic: false }
    ];
    const first = assignLevels(items).map(item => `${item.key}:${item.level}`);
    assert.deepEqual(assignLevels([...items].reverse()).map(item => `${item.key}:${item.level}`).sort(), [...first].sort());
    const levelOf = key => assignLevels(items).find(item => item.key === key).level;
    assert.ok(levelOf("tiger") < levelOf("though"));
    assert.equal(topicWordSet({ themes: [{ words: ["father (dad, daddy)", "Taiwan"] }] }).has("father"), true);
});

test("committed word bank: 1,200 words, 6 levels of 200, valid unique keys", () => {
    assert.equal(bank.meta.totalWords, 1200);
    assert.equal(bank.words.length, 1200);
    assert.deepEqual(bank.meta.levels.map(level => level.words), [200, 200, 200, 200, 200, 200]);
    const keys = new Set();
    for (const word of bank.words) {
        assert.match(word.key, /^[a-z0-9-]{1,40}$/);
        assert.ok(!keys.has(word.key), `duplicate ${word.key}`);
        keys.add(word.key);
        assert.ok(word.level >= 1 && word.level <= 6);
        assert.equal(word.letters, (word.display.match(/[A-Za-z]/g) || []).length);
    }
    for (const required of ["airplane", "e-mail", "ice-cream", "monday", "t-shirt", "may", "may-name"]) assert.ok(keys.has(required), required);
    for (const excluded of ["a.m.", "Mr.", "OK", "a/an"]) assert.ok(bank.meta.excluded.some(item => item.raw === excluded), excluded);
});

test("committed word bank: excluded and ambiguous words never get a Chinese prompt", () => {
    const blocked = new Set(exclusions.groups.flatMap(group => group.words));
    for (const word of bank.words) {
        if (blocked.has(word.display.toLowerCase())) assert.equal(word.gloss, undefined, word.display);
    }
    for (const display of ["may", "May", "miss", "Miss"]) {
        assert.equal(bank.words.find(word => word.display === display).gloss, undefined, display);
    }
    assert.equal(bank.words.find(word => word.display === "cat").gloss, "貓");
    assert.ok(bank.meta.meaningReady >= 500);
});
