#!/usr/bin/env node
// 產生單字大挑戰字庫：
//   node scripts/word-challenge/build-word-bank.mjs --ecdict <ecdict.csv> --cedict <cedict_ts.u8> --cmudict <cmudict.dict>
// 三個辭典檔都不放進 repo（授權與檔案大小），請自行下載後指定路徑：
//   ECDICT（MIT）：https://github.com/skywind3000/ECDICT 的 ecdict.csv
//   CC-CEDICT（CC BY-SA 4.0）：https://www.mdbg.net/chinese/dictionary?page=cedict
//   CMUdict（BSD）：https://github.com/cmusphinx/cmudict 的 cmudict.dict
// 輸出：src/data/wordChallenge/wordBank.v1.json（同樣輸入一定產生同樣檔案）

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    ALGORITHM_VERSION,
    FREQUENCY_WEIGHT,
    LENGTH_WEIGHT,
    LEVEL_COUNT,
    TOPIC_WEIGHT,
    UK_SPELLINGS,
    assignLevels,
    countLetters,
    findVerifiedGloss,
    frequencyRank,
    makeKey,
    makePattern,
    parseCedict,
    parseCmudict,
    parseEcdictCsv,
    parseSourceEntry,
    pickEcdictRow,
    stressedPronunciation,
    topicWordSet
} from "./word-bank-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
export const SOURCE_PATH = path.join(here, "source/moe-basic-1200.txt");
export const THEMES_PATH = path.join(here, "source/moe-themes-1-33.json");
export const GLOSS_EXCLUSIONS_PATH = path.join(here, "source/gloss-exclusions.json");
export const OUTPUT_PATH = path.join(repoRoot, "src/data/wordChallenge/wordBank.v1.json");
export const BANK_VERSION = "v1";

const readArg = (argv, name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : "";
};

export function buildWordBank({ sourceText, themesText, glossExclusionsText, ecdictText, cedictText, cmudictText }) {
    const topicWords = topicWordSet(JSON.parse(themesText));
    const glossExclusions = new Set(JSON.parse(glossExclusionsText).groups.flatMap(group => group.words.map(word => word.toLowerCase())));
    const sourceLines = sourceText.split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#"));
    const parsed = sourceLines.map(parseSourceEntry);
    const included = parsed.filter(entry => !entry.excludedReason);
    const excluded = parsed.filter(entry => entry.excludedReason).map(entry => ({ raw: entry.raw, reason: entry.excludedReason }));

    const wanted = new Set();
    for (const entry of included) {
        wanted.add(entry.main.toLowerCase());
        entry.main.split(/[\s-]+/).forEach(part => wanted.add(part.toLowerCase()));
    }
    const ecdict = parseEcdictCsv(ecdictText, wanted);
    const lookupRow = word => pickEcdictRow(ecdict.get(word.toLowerCase()), word);
    const cedict = parseCedict(cedictText);
    const prons = parseCmudict(cmudictText);

    // 主字小寫相同的條目（May／may）先放一般字，專有名詞再加後綴。
    const ordered = [...included].sort((a, b) => Number(a.properNoun) - Number(b.properNoun));
    const takenKeys = new Set();
    const keyed = new Map();
    for (const entry of ordered) keyed.set(entry.raw, makeKey(entry.main, entry.properNoun, takenKeys));

    // 小寫相同的兩個條目（May／may、Miss／miss）辭典分不清是哪一個意思，不出看中文題。
    const lowerCounts = new Map();
    for (const entry of included) lowerCounts.set(entry.main.toLowerCase(), (lowerCounts.get(entry.main.toLowerCase()) || 0) + 1);

    const items = included.map(entry => {
        const key = keyed.get(entry.raw);
        const row = lookupRow(entry.main);
        const lower = entry.main.toLowerCase();
        const glossAllowed = lowerCounts.get(lower) === 1 && !glossExclusions.has(lower);
        const gloss = glossAllowed ? findVerifiedGloss(entry.main, row, cedict) : null;
        return {
            key,
            display: entry.main,
            source: entry.raw,
            letters: countLetters(entry.main),
            pattern: makePattern(entry.main),
            properNoun: entry.properNoun,
            alternates: entry.alternates,
            ukSpellings: UK_SPELLINGS[entry.main.toLowerCase()] || [],
            topic: topicWords.has(entry.main.toLowerCase()),
            frequencyRank: frequencyRank(entry.main, lookupRow),
            gloss: gloss ? { zh: gloss.zh, sources: gloss.sources } : null
        };
    });

    // 同音字：只在字庫內配對，而且兩個字都只有一種重音念法。
    const pronByKey = new Map(items.map(item => [item.key, item.display.includes(" ") ? null : stressedPronunciation(prons, item.display)]));
    for (const item of items) {
        const pron = pronByKey.get(item.key);
        item.homophones = pron
            ? items
                .filter(other => other.key !== item.key && pronByKey.get(other.key) === pron && other.display.toLowerCase() !== item.display.toLowerCase())
                .map(other => other.display)
                .sort()
            : [];
    }

    const leveled = assignLevels(items).sort((a, b) => a.level - b.level || a.difficulty - b.difficulty || a.key.localeCompare(b.key));
    // 空陣列、false 與和 display 相同的 source 不輸出，前端一律以預設值補上。
    const words = leveled.map(item => {
        const compact = { key: item.key, display: item.display, level: item.level, letters: item.letters };
        if (item.source !== item.display) compact.source = item.source;
        if (item.properNoun) compact.properNoun = true;
        if (item.topic) compact.topic = true;
        if (item.alternates.length) compact.alternates = item.alternates;
        if (item.ukSpellings.length) compact.ukSpellings = item.ukSpellings;
        if (item.homophones.length) compact.homophones = item.homophones;
        if (item.gloss) compact.gloss = item.gloss.zh;
        compact.difficulty = item.difficulty;
        compact.frequencyRank = item.frequencyRank;
        return compact;
    });

    const levelCounts = Array.from({ length: LEVEL_COUNT }, (_, index) => {
        const level = index + 1;
        const levelWords = words.filter(word => word.level === level);
        return { level, words: levelWords.length, meaningReady: levelWords.filter(word => word.gloss).length };
    });

    const body = {
        meta: {
            bankVersion: BANK_VERSION,
            algorithmVersion: ALGORITHM_VERSION,
            source: "教育部 十二年國教英語文課綱 附錄五 參考字彙表 表一 基本 1,200 字",
            levelRule: `難度＝${TOPIC_WEIGHT}×（不在課綱表三第 1–33 類生活主題）＋${LENGTH_WEIGHT}×字母數百分位＋${FREQUENCY_WEIGHT}×常見度百分位（COCA／BNC 名次，取自 ECDICT），排序後平均切成 ${LEVEL_COUNT} 級；不是教育部官方分年級。`,
            glossRule: "只看主要意思：ECDICT 第一個詞性的前兩個中文詞，且該詞在 CC-CEDICT 的第一個解釋就是這個英文字才採用；有台灣特殊用法、方言或舊用法標記的詞不用；繁體取自 CC-CEDICT；再排除 gloss-exclusions.json 列出的多義字與非台灣常用說法。其他字只出「聽發音」題。",
            attribution: [
                "ECDICT (MIT License) https://github.com/skywind3000/ECDICT",
                "CC-CEDICT (CC BY-SA 4.0) https://www.mdbg.net/chinese/dictionary?page=cedict",
                "CMU Pronouncing Dictionary (BSD) https://github.com/cmusphinx/cmudict"
            ],
            totalSourceEntries: sourceLines.length,
            totalWords: words.length,
            meaningReady: words.filter(word => word.gloss).length,
            levels: levelCounts,
            excluded
        },
        words
    };
    // 每個字一行：Git diff 看得出哪個字改變，檔案也不會太大。
    const json = `{"meta":${JSON.stringify(body.meta)},\n"words":[\n${body.words.map(word => JSON.stringify(word)).join(",\n")}\n]}\n`;
    return { body, json, checksum: createHash("sha256").update(json).digest("hex").slice(0, 16) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const argv = process.argv.slice(2);
    const ecdictPath = readArg(argv, "--ecdict");
    const cedictPath = readArg(argv, "--cedict");
    const cmudictPath = readArg(argv, "--cmudict");
    if (!ecdictPath || !cedictPath || !cmudictPath) {
        console.error("用法：node scripts/word-challenge/build-word-bank.mjs --ecdict <csv> --cedict <txt> --cmudict <dict> [--out <json>]");
        process.exit(1);
    }
    const result = buildWordBank({
        sourceText: readFileSync(SOURCE_PATH, "utf8"),
        themesText: readFileSync(THEMES_PATH, "utf8"),
        glossExclusionsText: readFileSync(GLOSS_EXCLUSIONS_PATH, "utf8"),
        ecdictText: readFileSync(ecdictPath, "utf8"),
        cedictText: readFileSync(cedictPath, "utf8"),
        cmudictText: readFileSync(cmudictPath, "utf8")
    });
    const outPath = readArg(argv, "--out") || OUTPUT_PATH;
    writeFileSync(outPath, result.json, "utf8");
    const { meta } = result.body;
    console.log(`寫入 ${path.relative(repoRoot, outPath)}：${meta.totalWords} 字（排除 ${meta.excluded.length}），可出看中文題 ${meta.meaningReady} 字，checksum ${result.checksum}`);
    for (const level of meta.levels) console.log(`  第 ${level.level} 級：${level.words} 字，其中看中文 ${level.meaningReady} 字`);
}
