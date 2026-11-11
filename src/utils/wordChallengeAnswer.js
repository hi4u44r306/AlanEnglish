// 單字大挑戰：判斷學生打的拼字。
// 規則固定、可重現；之後伺服器結算時要用同一套規則（第三階段另做一份 TypeScript 版並測試兩邊一致）。

// 只比對英文字母：去掉空白、連字號、撇號與句點，不分大小寫，全形字母先轉半形。
export const lettersOnly = value => String(value ?? "")
    .normalize("NFKC")
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();

const firstLetter = value => (String(value ?? "").normalize("NFKC").match(/[A-Za-z]/) || [""])[0];

const withinOneEdit = (a, b) => {
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

export const WORD_CHALLENGE_MODES = Object.freeze({ audio: "audio", meaning: "meaning" });

// meaningPeers：看中文模式下，字庫裡中文意思完全相同的其他字（例如「大的」＝ big／large）。
export function checkWordAnswer(input, word, mode, meaningPeers = []) {
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

    if (mode === WORD_CHALLENGE_MODES.audio) {
        const homophone = (word.homophones || []).find(other => lettersOnly(other) === typed);
        if (homophone) return { correct: true, note: "homophone", expected, matched: homophone };
    }

    if (mode === WORD_CHALLENGE_MODES.meaning) {
        const synonym = [...(word.alternates || []), ...meaningPeers].find(other => lettersOnly(other) === typed);
        if (synonym) return { correct: true, note: "synonym", expected, matched: synonym };
    }

    return { correct: false, note: withinOneEdit(typed, target) ? "oneLetter" : null, expected };
}

// 字母格：每個英文字母一格，空白顯示成間隔，連字號與撇號照原樣顯示。
export function buildLetterSlots(display, typed = "", revealed = 0) {
    const letters = lettersOnly(typed).split("");
    let letterIndex = 0;
    return String(display).split("").map((char, index) => {
        if (/[A-Za-z]/.test(char)) {
            const slot = {
                kind: "letter",
                key: `l-${index}`,
                value: letters[letterIndex] || "",
                hint: letterIndex < revealed ? char : ""
            };
            letterIndex += 1;
            return slot;
        }
        return { kind: char === " " ? "gap" : "symbol", key: `s-${index}`, value: char === " " ? "" : char };
    });
}

export const NOTE_MESSAGES = {
    capitalize: word => `答對了！記得第一個字母要大寫：${word.display}`,
    uk: (word, result) => `答對了！${result.matched} 是英式拼法，課本用美式：${word.display}`,
    homophone: (word, result) => `也對！${result.matched} 和 ${word.display} 念起來一樣，這題的字是 ${word.display}`,
    synonym: (word, result) => `也對！${result.matched} 也是這個意思，這題的字是 ${word.display}`,
    oneLetter: () => "差一個字母！"
};

export function noteMessage(word, result) {
    const build = result?.note ? NOTE_MESSAGES[result.note] : null;
    return build ? build(word, result) : "";
}
