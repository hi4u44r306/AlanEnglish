// 「跟著念」三步：聽這題 → 拼出挖空的單字 → 看著完整句子念。
// 只是練習流程：通關、獎勵仍只看「自己說」，這裡不送任何紀錄。

const BLANK = /[_＿﹍﹎]{2,}/;

const normalize = value => String(value || "")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// 從句型（It is an ____.）與完整答案（It is an eye.）找出每個空格的答案（["eye"]）。
// 對不上、或空格裡沒有英文字母時回傳 null，就不出拼字題。
export const gapAnswersFromPattern = (pattern, answer) => {
    // 相鄰的空格（____ ____）當成同一格，答案可以是好幾個字。
    // 句尾的中文提示（例如「It is ____.( 一隻 )」）只是給學生看的，比對答案時拿掉。
    const pieces = normalize(pattern).replace(/s*[（(][^A-Za-z()（）]*[)）]s*$/, "").replace(/[_＿﹍﹎]{2,}(?:\s+[_＿﹍﹎]{2,})+/g, "____").split(BLANK);
    if (pieces.length < 2) return null;
    const full = normalize(answer);
    const lower = full.toLowerCase();
    const first = pieces[0].trim().toLowerCase();
    if (first && !lower.startsWith(first)) return null;
    let cursor = first.length;
    const answers = [];
    for (let index = 1; index < pieces.length; index += 1) {
        const piece = pieces[index].trim().toLowerCase();
        const isLast = index === pieces.length - 1;
        let end;
        if (!piece) end = isLast ? full.length : -1;
        else if (isLast) end = lower.endsWith(piece) && lower.length - piece.length >= cursor ? lower.length - piece.length : -1;
        else end = lower.indexOf(piece, cursor + 1);
        if (end < 0) return null;
        const filled = full.slice(cursor, end).trim().replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "");
        if (!/[A-Za-z]/.test(filled) || filled.length > 30) return null;
        answers.push(filled);
        cursor = end + piece.length;
    }
    return answers;
};

export const spellingTargetFor = question => {
    const pattern = question?.picture_interaction?.sentence_pattern;
    if (!pattern) return null;
    return gapAnswersFromPattern(pattern, question?.model_answer);
};

// 這題在「跟著念」的起始步驟：有片段先聽；沒片段但能拼字就拼字；都沒有就直接念。
export const initialGuidedStep = (question, challengeMode) => {
    if (challengeMode !== "easy") return "speak";
    if (question?.clip?.type === "audio") return "listen";
    return spellingTargetFor(question) ? "spell" : "speak";
};

export const nextGuidedStep = (step, question) => (
    step === "listen" && spellingTargetFor(question) ? "spell" : "speak"
);

// 要拼的部分：字母不多（10 個以內）就全部拼；太長就只拼最長的那個字（同長取後面的），
// 只顯示那個空格，同一格的其他字直接填好，免得字母方塊多到超出畫面。回傳每個字元與它是否要學生拼。
export const SPELL_LETTER_LIMIT = 10;
const spellingFocus = answers => {
    if (answers.join("").replace(/[^A-Za-z]/g, "").length <= SPELL_LETTER_LIMIT) return null;
    let focus = null;
    answers.forEach((answer, answerIndex) => {
        for (const match of answer.matchAll(/[A-Za-z]+/g)) {
            if (!focus || match[0].length >= focus.text.length) focus = { answerIndex, answer, start: match.index, text: match[0] };
        }
    });
    return focus;
};

// 只拼其中一格時是第幾個空格（從 0 起算）；每格都要拼時回傳 -1。題目句子用它標出要拼的那一格。
export const spellingFocusIndex = answers => spellingFocus(answers)?.answerIndex ?? -1;

export const spellingPlan = answers => {
    const focus = spellingFocus(answers);
    const target = focus ? focus.answer : answers.join(" ");
    return target.split("").map((char, index) => ({
        index,
        char,
        spell: /[A-Za-z]/.test(char) && (!focus || (index >= focus.start && index < focus.start + focus.text.length))
    }));
};

// 字母方塊：答案的字母加上幾個不在答案裡的字母，打亂順序。random 可注入以便測試。
export const letterTiles = (answers, extra = 2, random = Math.random) => {
    const letters = answers.join("").replace(/[^A-Za-z]/g, "").toLowerCase().split("");
    const pool = "abcdefghijklmnopqrstuvwxyz".split("").filter(letter => !letters.includes(letter));
    const decoys = [];
    for (let index = 0; index < extra && pool.length; index += 1) {
        decoys.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    const tiles = [...letters, ...decoys].map((letter, index) => ({ id: index, letter }));
    for (let index = tiles.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [tiles[index], tiles[swap]] = [tiles[swap], tiles[index]];
    }
    return tiles;
};
