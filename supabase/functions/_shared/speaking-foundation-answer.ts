import { readAzureWordAssessment } from "./azure-pronunciation.ts";
import { hasSpeakingAnswerSlots, matchesSpeakingAnswerTemplate } from "./speaking-pronunciation-reference.ts";

export const FOUNDATION_INTERACTION_TYPES = new Set([
    "alphabet_round",
    "letter_spelling",
    "text_qa",
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
    // Speech recognition can render the letter name "O" as a numeral or word.
    // These aliases apply only to the controlled letter-answer modes below.
    o: "O", oh: "O", zero: "O", "0": "O",
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

// A page-based draft can contain standard and picture questions together. The
// set-level `mixed` marker is deliberately not a foundation answer mode: the
// actual answer policy must be derived from each question's approved row.
export const readQuestionSetInteractionType = (metadata: unknown) => {
    const type = String((metadata as any)?.interaction_type || "").trim();
    return type === "mixed" ? type : readFoundationInteractionType(metadata);
};

export const resolveQuestionInteractionType = (questionSetInteractionType: unknown, pictureInteraction: unknown) => {
    if (questionSetInteractionType !== "mixed") return String(questionSetInteractionType || "");
    return readFoundationInteractionType(pictureInteraction);
};

export const usesUnscriptedFoundationAssessment = (interactionType: unknown) => (
    interactionType === "text_qa" || interactionType === "picture_qa" || interactionType === "picture_gap_sentence"
);

const normalizedTokens = (value: unknown) => String(value || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0\s]+/g, " ")
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

const OPTIONAL_GRAMMAR_WORDS = new Set([
    "a", "an", "the", "am", "are", "is", "was", "were", "do", "does", "did",
    "to", "of", "in", "on", "at", "for", "and", "please"
]);
const POLARITY_WORDS = new Set(["yes", "no", "not"]);

const canonicalSentenceTokens = (value: unknown) => normalizedSpokenSentence(value)
    .replace(/\b(i'm)\b/g, "i am")
    .replace(/\b(you're|we're|they're)\b/g, match => ({ "you're": "you are", "we're": "we are", "they're": "they are" }[match] || match))
    .replace(/\b(it's|he's|she's|that's|what's|where's|who's)\b/g, match => ({
        "it's": "it is", "he's": "he is", "she's": "she is", "that's": "that is",
        "what's": "what is", "where's": "where is", "who's": "who is"
    }[match] || match))
    .replace(/\b(isn't|aren't|wasn't|weren't|don't|doesn't|didn't|can't|cannot|won't)\b/g, match => ({
        "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
        "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "can not",
        "cannot": "can not", "won't": "will not"
    }[match] || match))
    .split(" ")
    .filter(Boolean);

const tokenEditDistance = (expected: string[], spoken: string[]) => {
    let previous = spoken.map((_, index) => index + 1);
    previous.unshift(0);
    expected.forEach((expectedToken, expectedIndex) => {
        const current = [expectedIndex + 1];
        spoken.forEach((spokenToken, spokenIndex) => {
            current.push(Math.min(
                current[spokenIndex] + 1,
                previous[spokenIndex + 1] + 1,
                previous[spokenIndex] + (expectedToken === spokenToken ? 0 : 1)
            ));
        });
        previous = current;
    });
    return previous[spoken.length];
};

// Young learners should not fail because the speech recognizer drops one short
// grammar word.  Core answer words and yes/no polarity still have to match, and
// longer answers may differ by at most 30 percent of their tokens.
export const matchesChildFriendlySentence = (expectedAnswer: unknown, recognizedText: unknown) => {
    const expected = canonicalSentenceTokens(expectedAnswer);
    const spoken = canonicalSentenceTokens(recognizedText);
    if (!expected.length || !spoken.length) return false;
    if (expected.join(" ") === spoken.join(" ")) return true;
    if (expected.length < 3) return false;

    const expectedPolarity = expected.filter(token => POLARITY_WORDS.has(token));
    const spokenPolarity = spoken.filter(token => POLARITY_WORDS.has(token));
    if (expectedPolarity.join(" ") !== spokenPolarity.join(" ")) return false;

    const expectedCore = expected.filter(token => !OPTIONAL_GRAMMAR_WORDS.has(token) && !POLARITY_WORDS.has(token));
    const spokenCore = spoken.filter(token => !OPTIONAL_GRAMMAR_WORDS.has(token) && !POLARITY_WORDS.has(token));
    const remainingCore = [...spokenCore];
    const matchedCoreCount = expectedCore.reduce((count, token) => {
        const index = remainingCore.indexOf(token);
        if (index < 0) return count;
        remainingCore.splice(index, 1);
        return count + 1;
    }, 0);
    const requiredCoreMatches = expectedCore.length <= 1
        ? expectedCore.length
        : Math.ceil(expectedCore.length * 0.7);
    if (matchedCoreCount < requiredCoreMatches) return false;

    const distance = tokenEditDistance(expected, spoken);
    const allowedDistance = Math.max(1, Math.floor(expected.length * 0.3));
    return distance <= allowedDistance;
};

// Chinese IMEs can produce full-width low lines even when the author intends
// to type ____. Canonicalize both forms before validation and persistence.
export const normalizePictureGapPrompt = (value: unknown) => String(value || "")
    .replace(/[_＿﹍﹎]{2,}/g, "____");

export const visibleSentenceWords = (value: unknown) => (normalizePictureGapPrompt(value)
    .match(/_+|[A-Za-z]+(?:['’][A-Za-z]+)?|[^A-Za-z_\s]+/g) || [])
    .map((text, tokenIndex) => ({ text, tokenIndex }))
    .filter(token => /^[A-Za-z]+(?:['’][A-Za-z]+)?$/.test(token.text));

export const pictureGapAnswerMatchesPrompt = (promptText: unknown, answerText: unknown) => {
    const rawPieces = normalizePictureGapPrompt(promptText).split(/_{2,}/);
    if (rawPieces.length < 2) return false;
    const pieces = rawPieces.map(piece => normalizedSpokenSentence(piece).split(" ").filter(Boolean));
    if (pieces.slice(1, -1).some(piece => piece.length === 0)) return false;
    const answer = normalizedSpokenSentence(answerText).split(" ").filter(Boolean);
    if (!answer.length) return false;
    const matchesAt = (piece: string[], start: number) => (
        piece.every((token, offset) => answer[start + offset] === token)
    );
    if (pieces[0].length && !matchesAt(pieces[0], 0)) return false;

    const matchRemaining = (pieceIndex: number, cursor: number): boolean => {
        if (pieceIndex >= pieces.length) return cursor === answer.length;
        const piece = pieces[pieceIndex];
        const isLast = pieceIndex === pieces.length - 1;
        if (!piece.length) return isLast && cursor < answer.length;
        for (let start = cursor + 1; start + piece.length <= answer.length; start += 1) {
            if (!matchesAt(piece, start)) continue;
            const nextCursor = start + piece.length;
            if (isLast ? nextCursor === answer.length : matchRemaining(pieceIndex + 1, nextCursor)) return true;
        }
        return false;
    };

    return matchRemaining(1, pieces[0].length);
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
    if (type === "text_qa" || type === "picture_qa" || type === "picture_gap_sentence") {
        const spoken = normalizedSpokenSentence(recognizedText);
        const accepted = [expectedAnswer, ...(Array.isArray(acceptedAnswers) ? acceptedAnswers : [])]
            .map(value => String(value || "").trim())
            .filter(Boolean);
        return Boolean(spoken) && accepted.some(answer => hasSpeakingAnswerSlots(answer)
            ? matchesSpeakingAnswerTemplate(answer, recognizedText)
            : matchesChildFriendlySentence(answer, recognizedText));
    }
    const expected = expectedLetterSequence(expectedAnswer);
    const spoken = spokenLetterSequence(recognizedText);
    if (!spoken || spoken.length !== expected.length) return false;
    if (type === "alphabet_round" && expected.length !== 1) return false;
    if (type === "letter_spelling" && expected.length < 2) return false;
    return expected.every((letter, index) => spoken[index] === letter);
};

const CHILD_SPELLING_AVERAGE_ACCURACY_FLOOR = 45;
const CHILD_SPELLING_SINGLE_LETTER_FLOOR = 20;

export const evaluateLetterSpellingAssessment = (
    expectedAnswer: unknown,
    recognizedText: unknown,
    providerWords: unknown
) => {
    if (matchesFoundationAnswer("letter_spelling", expectedAnswer, recognizedText)) {
        return { answerMatch: true, uncertain: false, basis: "recognized_text" };
    }

    const expected = expectedLetterSequence(expectedAnswer);
    const words = Array.isArray(providerWords) ? providerWords : [];
    if (expected.length < 2 || !words.length) {
        return { answerMatch: false, uncertain: true, basis: "unassessable" };
    }

    const alignedLetters: string[] = [];
    const accuracyScores: number[] = [];
    for (const item of words) {
        const assessment = readAzureWordAssessment(item);
        const errorType = String(assessment.errorType || "None").trim().toLowerCase();
        if (errorType === "omission" || errorType === "insertion") {
            return { answerMatch: false, uncertain: false, basis: errorType };
        }

        const letters = spokenLetterSequence((item as any)?.Word);
        const accuracy = Number(assessment.accuracyScore);
        if (!letters?.length || !Number.isFinite(accuracy)) {
            return { answerMatch: false, uncertain: true, basis: "unassessable" };
        }
        alignedLetters.push(...letters);
        accuracyScores.push(...letters.map(() => Math.max(0, Math.min(100, accuracy))));
    }

    if (alignedLetters.length !== expected.length
        || !expected.every((letter, index) => alignedLetters[index] === letter)) {
        return { answerMatch: false, uncertain: false, basis: "sequence_mismatch" };
    }

    const averageAccuracy = accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;
    const lowestAccuracy = Math.min(...accuracyScores);
    const answerMatch = averageAccuracy >= CHILD_SPELLING_AVERAGE_ACCURACY_FLOOR
        && lowestAccuracy >= CHILD_SPELLING_SINGLE_LETTER_FLOOR;

    return {
        answerMatch,
        uncertain: !answerMatch,
        basis: answerMatch ? "aligned_words" : "low_confidence",
        averageAccuracy: Math.round(averageAccuracy * 100) / 100,
        lowestAccuracy: Math.round(lowestAccuracy * 100) / 100
    };
};

export const foundationRetryFeedback = (interactionType: unknown) => (
    interactionType === "alphabet_round"
        ? "再看清楚這個字母，聽完提示音後重新唸一次。"
        : interactionType === "text_qa"
            ? "請依題目線索，用其中一個可接受的完整英文句子回答；不要把 he／she 或 his／her 混在同一句。"
        : interactionType === "picture_qa"
            ? "請看圖片，把完整問句和完整回答一起說出來。"
            : interactionType === "picture_gap_sentence"
                ? "請看圖片，把包含空格答案的完整句子說出來。"
        : "請慢慢逐字母拼讀，確認沒有漏字、換序或多唸字母。"
);
