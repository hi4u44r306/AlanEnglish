// 沒過時給學生看「系統聽到什麼」，並標出和題目不一樣的字。
// 比對方式和伺服器評分（supabase/functions/_shared/speaking-completeness.ts）相同：
// 小寫、展開縮寫、按順序找最長共同字串；th 被聽成 s/f/t/d/z 的字算念到。只用來顯示，不影響評分。

const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)?|\d+/g;

// 一個顯示用的字展開成評分用的字（it's → it is）。
const normalizeWord = word => String(word).toLowerCase().replace(/[’‘]/g, "'")
    .replace(/^i'm$/, "i am").replace(/^can't$/, "cannot").replace(/^won't$/, "will not").replace(/n't$/, " not")
    .replace(/^(you|we|they)'re$/, "$1 are").replace(/^(i|you|we|they)'ve$/, "$1 have")
    .replace(/^(it|he|she|that|what|where|who)'s$/, "$1 is")
    .split(" ")
    .filter(Boolean);

const TH_SUBSTITUTES = ["s", "f", "t", "d", "z"];
const thSoundAlikes = word => {
    if (!word.includes("th")) return [];
    const variants = new Set();
    for (const match of word.matchAll(/th/g)) {
        for (const substitute of TH_SUBSTITUTES) {
            const variant = word.slice(0, match.index) + substitute + word.slice(match.index + 2);
            variants.add(variant);
            if (match.index + 2 === word.length) variants.add(`${variant}e`);
        }
    }
    variants.delete(word);
    return [...variants];
};

// 把文字拆成顯示用的字，每個字記下它展開後的評分用字。
const tokens = text => (String(text || "").match(WORD) || []).map(display => ({ display, parts: normalizeWord(display) }));

export const diffSpokenWords = (expectedText, heardText) => {
    const expected = tokens(expectedText);
    const heard = tokens(heardText);
    const expectedParts = expected.flatMap((token, index) => token.parts.map(part => ({ part, index })));
    const thWords = [...new Set(expectedParts.map(item => item.part).filter(part => part.includes("th")))];
    const known = new Set(expectedParts.map(item => item.part));
    const heardParts = heard.flatMap((token, index) => token.parts.map(part => {
        const aligned = known.has(part) ? part : thWords.find(word => thSoundAlikes(word).includes(part)) || part;
        return { part: aligned, index };
    }));

    const rows = expectedParts.length;
    const cols = heardParts.length;
    const table = Array.from({ length: rows + 1 }, () => new Uint16Array(cols + 1));
    for (let i = 1; i <= rows; i += 1) for (let j = 1; j <= cols; j += 1) {
        table[i][j] = expectedParts[i - 1].part === heardParts[j - 1].part
            ? table[i - 1][j - 1] + 1
            : Math.max(table[i - 1][j], table[i][j - 1]);
    }
    const expectedHit = expectedParts.map(() => false);
    const heardHit = heardParts.map(() => false);
    for (let i = rows, j = cols; i && j;) {
        if (expectedParts[i - 1].part === heardParts[j - 1].part) { expectedHit[i - 1] = true; heardHit[j - 1] = true; i -= 1; j -= 1; }
        else if (table[i - 1][j] >= table[i][j - 1]) i -= 1;
        else j -= 1;
    }
    // 一個顯示用的字要全部的部分都對到才算對（it's 要 it 和 is 都聽到）。
    const mark = (list, parts, hits) => list.map((token, index) => ({
        text: token.display,
        ok: parts.every((item, position) => item.index !== index || hits[position])
    }));
    return { expected: mark(expected, expectedParts, expectedHit), heard: mark(heard, heardParts, heardHit) };
};
