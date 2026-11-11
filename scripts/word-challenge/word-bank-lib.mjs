// 單字大挑戰字庫產生規則（純函式，方便測試）。
// 所有判斷都是固定規則，不靠人工逐字審核；同樣的輸入一定得到同樣的輸出。

export const ALGORITHM_VERSION = "word-bank-v1";
export const LEVEL_COUNT = 6;
// 難度＝0.40×「不在課綱生活主題分類」＋0.35×字母數百分位＋0.25×常見度百分位。
// 只用常見度會把 tiger、orange 這類國小早期字排到最難，所以加入課綱表三的主題分類。
export const TOPIC_WEIGHT = 0.4;
export const LENGTH_WEIGHT = 0.35;
export const FREQUENCY_WEIGHT = 0.25;
const MISSING_RANK = 60000;

// 括號內是詞形變化（不是同義字）的條目：只考主字，括號內不當答案。
export const INFLECTION_HEADS = new Set([
    "be", "do", "have", "he", "i", "it", "she", "they", "we", "you", "may", "will", "shoe"
]);

// 英式拼法對照（只列字庫裡會出現的美式字）。看到英式拼法也算對，但提醒美式寫法。
export const UK_SPELLINGS = {
    color: ["colour"],
    favorite: ["favourite"],
    center: ["centre"],
    gray: ["grey"],
    theater: ["theatre"],
    neighbor: ["neighbour"],
    program: ["programme"],
    math: ["maths"],
    airplane: ["aeroplane"],
    mom: ["mum"],
    pajamas: ["pyjamas"],
    jewelry: ["jewellery"],
    behavior: ["behaviour"],
    meter: ["metre"],
    kilometer: ["kilometre"],
    centimeter: ["centimetre"],
    practice: ["practise"],
    tire: ["tyre"],
    mustache: ["moustache"]
};

export const POS_LABELS = {
    "n.": "名詞",
    "v.": "動詞",
    "vt.": "動詞",
    "vi.": "動詞",
    "aux.": "助動詞",
    "a.": "形容詞",
    "adj.": "形容詞",
    "s.": "形容詞",
    "ad.": "副詞",
    "adv.": "副詞",
    "prep.": "介系詞",
    "pron.": "代名詞",
    "conj.": "連接詞",
    "int.": "感嘆詞",
    "interj.": "感嘆詞",
    "num.": "數詞",
    "art.": "冠詞"
};

const isAllCapsAbbreviation = text => /^[A-Z]{2,}$/.test(text);

// 解析官方字表的一行原始條目。
export function parseSourceEntry(raw) {
    const text = String(raw || "").trim();
    const parenMatch = text.match(/^(.*?)\s*\((.*)\)\s*$/);
    const main = (parenMatch ? parenMatch[1] : text).trim();
    const inner = parenMatch ? parenMatch[2] : "";
    const lowerMain = main.toLowerCase();

    let excludedReason = null;
    if (main.includes("/")) excludedReason = "slash";
    else if (main.includes(".")) excludedReason = "abbreviation";
    else if (main.length <= 1) excludedReason = "single-letter";
    else if (isAllCapsAbbreviation(main)) excludedReason = "abbreviation";

    const isInflection = INFLECTION_HEADS.has(lowerMain);
    const alternates = !inner || isInflection
        ? []
        : inner.split(",")
            .map(part => part.trim())
            .filter(part => part && !part.includes(".") && !isAllCapsAbbreviation(part) && part.length > 1);

    return {
        raw: text,
        main,
        alternates,
        isInflection,
        properNoun: /^[A-Z][a-z]/.test(main),
        excludedReason
    };
}

export function makeKey(main, properNoun, takenKeys) {
    const base = main.toLowerCase().replace(/'/g, "").replace(/\s+/g, "-");
    let key = base;
    if (takenKeys.has(key)) key = `${base}-${properNoun ? "name" : "word"}`;
    if (!/^[a-z0-9-]{1,40}$/.test(key)) throw new Error(`invalid key: ${key}`);
    if (takenKeys.has(key)) throw new Error(`duplicate key: ${key}`);
    takenKeys.add(key);
    return key;
}

// 字母格樣式：字母用 _，空格與連字號直接顯示。
export const makePattern = main => main.replace(/[A-Za-z]/g, "_");
export const countLetters = main => (main.match(/[A-Za-z]/g) || []).length;

// ---------- ECDICT ----------

// 簡單的 CSV 解析（支援雙引號與跳脫的雙引號）。只回傳 wanted 裡的字（小寫比對）。
export function parseEcdictCsv(text, wanted) {
    const rows = new Map();
    let field = "";
    let row = [];
    let inQuotes = false;
    let header = null;
    const pushRow = () => {
        row.push(field);
        field = "";
        if (!header) header = row;
        else {
            const word = (row[0] || "").toLowerCase();
            if (wanted.has(word)) {
                const record = Object.fromEntries(header.map((name, index) => [name, row[index] || ""]));
                // 同一個小寫字可能有大小寫不同的兩列（May／may），全部保留。
                if (!rows.has(word)) rows.set(word, []);
                rows.get(word).push(record);
            }
        }
        row = [];
    };
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (inQuotes) {
            if (char === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else inQuotes = false;
            } else field += char;
        } else if (char === '"') inQuotes = true;
        else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n") pushRow();
        else if (char !== "\r") field += char;
    }
    if (field || row.length) pushRow();
    return rows;
}

export function pickEcdictRow(rows, main) {
    if (!rows || rows.length === 0) return null;
    return rows.find(record => record.word === main) || rows.find(record => record.word.toLowerCase() === main.toLowerCase()) || rows[0];
}

const toRank = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
};

// 常見度名次：先用 COCA（frq），沒有再用 BNC，都沒有就拿各單字名次的最大值（片語）。
export function frequencyRank(main, lookupRow) {
    const rowRank = record => toRank(record?.frq) || toRank(record?.bnc);
    const direct = rowRank(lookupRow(main));
    if (direct) return direct;
    const parts = main.split(/[\s-]+/).filter(Boolean);
    if (parts.length > 1) {
        const partRanks = parts.map(part => rowRank(lookupRow(part)) || MISSING_RANK);
        return Math.max(...partRanks);
    }
    return MISSING_RANK;
}

// 解析 ECDICT 中文翻譯欄。回傳 [{ pos, terms }]，略過 [网络]、[计] 這類標記的行。
export function parseEcdictTranslation(translation) {
    return String(translation || "")
        .split(/\\n|\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("["))
        .map(line => {
            const posMatch = line.match(/^([a-z]+\.)\s*/);
            const pos = posMatch ? posMatch[1] : "";
            const body = posMatch ? line.slice(posMatch[0].length) : line;
            const terms = body
                .replace(/（[^）]*）|\([^)]*\)|<[^>]*>/g, "")
                .split(/[,，;；、]/)
                .map(term => term.trim())
                .filter(term => term && /^[一-鿿]+$/.test(term));
            return { pos, terms };
        })
        .filter(line => line.terms.length > 0);
}

// ---------- CC-CEDICT ----------

const DISQUALIFYING_FLAGS = /\((PRC|dialect|old|archaic|literary|Cantonese|slang|Internet slang|vulgar|derog\.|Buddhism|TCM)\)/i;

const cleanEnglish = piece => piece
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function parseCedict(text) {
    const bySimp = new Map();
    const twByEnglish = new Map();
    for (const line of String(text).split(/\r?\n/)) {
        if (!line || line.startsWith("#")) continue;
        const match = line.match(/^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/);
        if (!match) continue;
        const [, trad, simp, pinyin, defsRaw] = match;
        const senses = defsRaw.split("/").filter(Boolean).map(def => {
            const tw = /^\(Tw\)/.test(def.trim());
            const disqualified = DISQUALIFYING_FLAGS.test(def) || /^(surname|abbr\.|variant of|old variant|see |CL:|used in|erhua)/i.test(def.trim());
            const pieces = def.split(";").map(cleanEnglish).filter(Boolean);
            return { raw: def, tw, disqualified, pieces };
        });
        const entry = { trad, simp, pinyin, senses, hasTwSense: senses.some(sense => sense.tw) };
        if (!bySimp.has(simp)) bySimp.set(simp, []);
        bySimp.get(simp).push(entry);
        for (const sense of senses) {
            if (!sense.tw || sense.disqualified) continue;
            for (const piece of sense.pieces) {
                if (!twByEnglish.has(piece)) twByEnglish.set(piece, []);
                twByEnglish.get(piece).push(entry);
            }
        }
    }
    return { bySimp, twByEnglish };
}

const englishCandidates = (word, posLabel) => {
    const lower = word.toLowerCase();
    const candidates = new Set([lower]);
    if (posLabel === "動詞") candidates.add(`to ${lower}`);
    if (posLabel === "形容詞") ["to be", "to get", "to become", "be", "get"].forEach(prefix => candidates.add(`${prefix} ${lower}`));
    return candidates;
};

const senseMatches = (sense, candidates) => sense.pieces.some(piece => candidates.has(piece));

// 兩個來源一致才算「已驗證」，而且只看兩邊的「主要意思」，寧可少出題也不要出錯：
// 1. 只用 ECDICT 翻譯的第一行（第一個詞性）的前兩個中文詞。
// 2. 這個中文詞在 CC-CEDICT 的「第一個解釋」必須就是這個英文字。
// 3. CC-CEDICT 標了台灣特殊用法（Tw）、方言、舊用法等的詞一律不用（避免「蝦米」「囝仔」這類用語）。
// 4. 顯示用 CC-CEDICT 的繁體欄。
export const PRIMARY_TERM_LIMIT = 2;
const ADJECTIVE_POS = new Set(["a.", "adj.", "s."]);

export function findVerifiedGloss(word, ecdictRow, cedict) {
    if (!ecdictRow) return null;
    const [firstLine] = parseEcdictTranslation(ecdictRow.translation);
    if (!firstLine) return null;
    const posLabel = POS_LABELS[firstLine.pos] || "";
    const candidates = englishCandidates(word, posLabel);
    for (const term of firstLine.terms.slice(0, PRIMARY_TERM_LIMIT)) {
        const attempts = [{ base: term, suffix: "" }];
        if (ADJECTIVE_POS.has(firstLine.pos) && /的$/.test(term) && term.length > 1) attempts.push({ base: term.slice(0, -1), suffix: "的" });
        for (const { base, suffix } of attempts) {
            for (const entry of cedict.bySimp.get(base) || []) {
                if (entry.hasTwSense) continue;
                const [primarySense] = entry.senses;
                if (!primarySense || primarySense.disqualified || primarySense.tw) continue;
                if (!senseMatches(primarySense, candidates)) continue;
                return { zh: `${entry.trad}${suffix}`, pos: posLabel, sources: ["ECDICT", "CC-CEDICT"] };
            }
        }
    }
    return null;
}

// ---------- CMUdict（同音字） ----------

export function parseCmudict(text) {
    const prons = new Map();
    for (const line of String(text).split(/\r?\n/)) {
        if (!line || line.startsWith(";;;")) continue;
        const match = line.match(/^([^\s(]+)(?:\(\d+\))?\s+(.+?)\s*(#.*)?$/);
        if (!match) continue;
        const word = match[1].toLowerCase();
        if (!prons.has(word)) prons.set(word, []);
        prons.get(word).push(match[2].trim());
    }
    return prons;
}

// 只有「重音念法只有一種」的字才參與同音判斷，避免 read（reed／red）這類一字多音被誤判。
export function stressedPronunciation(prons, word) {
    const list = prons.get(word.toLowerCase()) || [];
    const stressed = [...new Set(list.filter(pron => /1/.test(pron)))];
    return stressed.length === 1 ? stressed[0] : null;
}

// ---------- 分級 ----------

const percentileMap = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const lastIndex = Math.max(sorted.length - 1, 1);
    return value => {
        // 以「小於這個值的數量」換算百分位，同值得到同分。
        let low = 0;
        let high = sorted.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (sorted[mid] < value) low = mid + 1;
            else high = mid;
        }
        return low / lastIndex;
    };
};

// 課綱表三第 1–33 類的字（去掉括號後小寫）。
export function topicWordSet(themesSource) {
    const words = new Set();
    for (const theme of themesSource?.themes || []) {
        for (const word of theme.words || []) words.add(String(word).replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase());
    }
    return words;
}

export function assignLevels(items) {
    const freqPct = percentileMap(items.map(item => item.frequencyRank));
    const lenPct = percentileMap(items.map(item => item.letters));
    const scored = items.map(item => ({
        ...item,
        difficulty: Number((
            TOPIC_WEIGHT * (item.topic ? 0 : 1)
            + LENGTH_WEIGHT * lenPct(item.letters)
            + FREQUENCY_WEIGHT * freqPct(item.frequencyRank)
        ).toFixed(4))
    }));
    scored.sort((a, b) => a.difficulty - b.difficulty || a.key.localeCompare(b.key));
    const perLevel = Math.ceil(scored.length / LEVEL_COUNT);
    return scored.map((item, index) => ({ ...item, level: Math.min(LEVEL_COUNT, Math.floor(index / perLevel) + 1) }));
}
