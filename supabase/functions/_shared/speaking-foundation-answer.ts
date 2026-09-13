export const FOUNDATION_INTERACTION_TYPES = new Set([
    "alphabet_round",
    "letter_spelling",
    "picture_qa",
    "picture_gap_sentence"
]);

const LETTER_ALIASES: Record<string, string> = {
    a: "A", ay: "A", aye: "A",
    b: "B", be: "B", bee: "B",
    c: "C", sea: "C", see: "C",
    d: "D", dee: "D",
    e: "E",
    f: "F", ef: "F", eff: "F",
    g: "G", gee: "G",
    h: "H", aitch: "H", haitch: "H",
    i: "I", eye: "I",
    j: "J", jay: "J",
    k: "K", kay: "K",
    l: "L", el: "L", ell: "L",
    m: "M", em: "M",
    n: "N", en: "N",
    o: "O", oh: "O",
    p: "P", pea: "P", pee: "P",
    q: "Q", cue: "Q", queue: "Q",
    r: "R", are: "R",
    s: "S", es: "S", ess: "S",
    t: "T", tea: "T", tee: "T",
    u: "U", ewe: "U", yew: "U", you: "U",
    v: "V", vee: "V",
    w: "W",
    x: "X", ex: "X",
    y: "Y", why: "Y",
    z: "Z", zed: "Z", zee: "Z"
};

export const readFoundationInteractionType = (metadata: unknown) => {
    const type = String((metadata as any)?.interaction_type || "").trim();
    return FOUNDATION_INTERACTION_TYPES.has(type) ? type : "";
};

export const usesUnscriptedFoundationAssessment = (interactionType: unknown) => (
    interactionType === "picture_qa" || interactionType === "picture_gap_sentence"
);

const normalizedTokens = (value: unknown) => String(value || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

export const spokenLetterSequence = (value: unknown) => {
    const tokens = normalizedTokens(value);
    if (!tokens.length) return null;
    const letters: string[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (token === "double") {
            const next = tokens[index + 1];
            if (next === "u") {
                letters.push("W");
                index += 1;
                continue;
            }
            const repeated = LETTER_ALIASES[next];
            if (!repeated) return null;
            letters.push(repeated, repeated);
            index += 1;
            continue;
        }
        const letter = LETTER_ALIASES[token];
        if (!letter) return null;
        letters.push(letter);
    }
    return letters;
};

const expectedLetterSequence = (value: unknown) => String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter(Boolean);

export const normalizedSpokenSentence = (value: unknown) => String(value || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const visibleSentenceWords = (value: unknown) => (String(value || "")
    .match(/_+|[A-Za-z]+(?:['’][A-Za-z]+)?|[^A-Za-z_\s]+/g) || [])
    .map((text, tokenIndex) => ({ text, tokenIndex }))
    .filter(token => /^[A-Za-z]+(?:['’][A-Za-z]+)?$/.test(token.text));

export const pictureGapAnswerMatchesPrompt = (promptText: unknown, answerText: unknown) => {
    const pieces = String(promptText || "").split(/_{2,}/);
    if (pieces.length !== 2) return false;
    const before = normalizedSpokenSentence(pieces[0]);
    const after = normalizedSpokenSentence(pieces[1]);
    const answer = normalizedSpokenSentence(answerText);
    if (!answer || (before && answer !== before && !answer.startsWith(`${before} `))
        || (after && answer !== after && !answer.endsWith(` ${after}`))) return false;
    const fillStart = before.length;
    const fillEnd = after ? answer.length - after.length : answer.length;
    return Boolean(answer.slice(fillStart, fillEnd).trim());
};

export const pictureQaResponseHasQuestionAndAnswer = (value: unknown) => {
    const raw = String(value || "");
    const questionEnd = raw.indexOf("?");
    if (questionEnd < 0) return false;
    const question = normalizedSpokenSentence(raw.slice(0, questionEnd));
    const answer = normalizedSpokenSentence(raw.slice(questionEnd + 1));
    return question.split(" ").filter(Boolean).length >= 2 && answer.split(" ").filter(Boolean).length >= 1;
};

export const matchesFoundationAnswer = (
    interactionType: unknown,
    expectedAnswer: unknown,
    recognizedText: unknown,
    acceptedAnswers: unknown = []
) => {
    const type = String(interactionType || "");
    if (!FOUNDATION_INTERACTION_TYPES.has(type)) return false;
    if (type === "picture_qa" || type === "picture_gap_sentence") {
        const spoken = normalizedSpokenSentence(recognizedText);
        const accepted = [expectedAnswer, ...(Array.isArray(acceptedAnswers) ? acceptedAnswers : [])]
            .map(normalizedSpokenSentence)
            .filter(Boolean);
        return Boolean(spoken) && accepted.includes(spoken);
    }
    const expected = expectedLetterSequence(expectedAnswer);
    const spoken = spokenLetterSequence(recognizedText);
    if (!spoken || spoken.length !== expected.length) return false;
    if (type === "alphabet_round" && expected.length !== 1) return false;
    if (type === "letter_spelling" && expected.length < 2) return false;
    return expected.every((letter, index) => spoken[index] === letter);
};

export const foundationRetryFeedback = (interactionType: unknown) => (
    interactionType === "alphabet_round"
        ? "再看清楚這個字母，聽完提示音後重新唸一次。"
        : interactionType === "picture_qa"
            ? "請看圖片，把完整問句和完整回答一起說出來。"
            : interactionType === "picture_gap_sentence"
                ? "請看圖片，把包含空格答案的完整句子說出來。"
        : "請慢慢逐字母拼讀，確認沒有漏字、換序或多唸字母。"
);
