import { readAzureWordAssessment } from "./azure-pronunciation.ts";
import { hasSpeakingAnswerSlots, matchesSpeakingAnswerTemplate } from "./speaking-pronunciation-reference.ts";
import { missingKeyWords } from "./speaking-key-nouns.ts";

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

export const OPTIONAL_GRAMMAR_WORDS = new Set([
    "a", "an", "the", "am", "are", "is", "was", "were", "do", "does", "did",
    "to", "of", "in", "on", "at", "for", "and", "please"
]);
export const POLARITY_WORDS = new Set(["yes", "no", "not"]);

// Speech recognizers write numbers as digits ("8:30", "5.1", "3,940", "8th") while answers may spell
// them out, or the other way round. Both sides are rewritten to the same English words before they
// are tokenized, so the digit form and the spoken form compare equal.
const NUMBER_ONES = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
];
const NUMBER_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const ORDINAL_WORDS: Record<string, string> = {
    one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth"
};
const underHundredWords = (n: number) => n < 20
    ? NUMBER_ONES[n]
    : NUMBER_TENS[Math.floor(n / 10)] + (n % 10 ? " " + NUMBER_ONES[n % 10] : "");
const integerWords = (n: number): string => {
    if (n < 100) return underHundredWords(n);
    if (n < 1000) return NUMBER_ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + underHundredWords(n % 100) : "");
    return underHundredWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + integerWords(n % 1000) : "");
};
const digitWords = (digits: string) => digits.split("").map(digit => NUMBER_ONES[Number(digit)]).join(" ");
const numberWords = (digits: string) => {
    if (digits.length > 1 && digits.startsWith("0")) return digitWords(digits);
    const n = Number(digits);
    if (!Number.isInteger(n) || n > 9999) return digits;
    // Years are read in pairs: 1999 is "nineteen ninety nine", 1905 is "nineteen oh five".
    if (n >= 1100 && n <= 1999) {
        const low = n % 100;
        return underHundredWords(Math.floor(n / 100)) + " "
            + (low === 0 ? "hundred" : low < 10 ? "oh " + NUMBER_ONES[low] : underHundredWords(low));
    }
    return integerWords(n);
};
const replaceLastWord = (words: string, change: (word: string) => string) => {
    const parts = words.split(" ");
    parts[parts.length - 1] = change(parts[parts.length - 1]);
    return parts.join(" ");
};
const ordinalWords = (digits: string) => replaceLastWord(numberWords(digits), word => ORDINAL_WORDS[word]
    || (word.endsWith("y") ? word.slice(0, -1) + "ieth" : word + "th"));
const pluralNumberWords = (digits: string) => replaceLastWord(numberWords(digits), word => (
    word.endsWith("y") ? word.slice(0, -1) + "ies" : word + "s"
));
export const spellOutNumbers = (value: unknown) => String(value || "")
    // 3,940 -> 3940 (only real thousands groups, so "1, 2, 3" lists are left alone)
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    // 8:30 -> eight thirty, 7:00 -> seven o'clock, 8:05 -> eight oh five
    .replace(/\b(\d{1,2}):([0-5]\d)\b/g, (_, hour: string, minute: string) => {
        const m = Number(minute);
        return " " + numberWords(String(Number(hour))) + " "
            + (m === 0 ? "o'clock" : m < 10 ? "oh " + NUMBER_ONES[m] : underHundredWords(m)) + " ";
    })
    // 5.1 -> five point one
    .replace(/\b(\d+)\.(\d+)\b/g, (_, whole: string, fraction: string) => (
        " " + numberWords(whole) + " point " + digitWords(fraction) + " "
    ))
    // 8th -> eighth, 21st -> twenty first
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, digits: string) => " " + ordinalWords(digits) + " ")
    // 20s -> twenties, 1990s -> nineteen nineties
    .replace(/\b(\d*0)s\b/gi, (_, digits: string) => " " + pluralNumberWords(digits) + " ")
    // 2pm -> 2 pm, E1 -> E 1
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/\d+/g, digits => " " + numberWords(digits) + " ");

const canonicalSentenceTokens = (value: unknown) => normalizedSpokenSentence(spellOutNumbers(value))
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

// th is the sound Taiwanese children (and speech recognizers) most often miss: "mouth" comes back
// as "mouse", "three" as "tree". When an answer word has th, the same word with th replaced by
// s/f/t/d/z (plus a trailing e when th ends the word) still counts as said; the caller tells the
// student which th word to practise.
const TH_SUBSTITUTES = ["s", "f", "t", "d", "z"];
export const thSoundAlikes = (word: string): string[] => {
    if (!word.includes("th")) return [];
    const variants = new Set<string>();
    for (const match of word.matchAll(/th/g)) {
        const position = match.index ?? 0;
        for (const substitute of TH_SUBSTITUTES) {
            const variant = word.slice(0, position) + substitute + word.slice(position + 2);
            variants.add(variant);
            if (position + 2 === word.length) variants.add(variant + "e");
        }
    }
    variants.delete(word);
    return [...variants];
};

// Words that sound exactly alike: the recognizer cannot tell them apart ("It is an eye." comes back
// as "It is an I."), so hearing one when the answer has the other is not a mistake. No/know and other
// pairs that change yes/no meaning are left out on purpose.
const HOMOPHONE_GROUPS = [
    ["eye", "i"], ["two", "to", "too"], ["four", "for"], ["eight", "ate"], ["one", "won"],
    ["see", "sea"], ["be", "bee"], ["right", "write"], ["hear", "here"], ["their", "there"],
    ["buy", "by", "bye"], ["son", "sun"], ["meet", "meat"], ["pear", "pair"], ["week", "weak"],
    ["blue", "blew"], ["flower", "flour"], ["night", "knight"], ["new", "knew"], ["hour", "our"],
    ["whole", "hole"], ["wear", "where"], ["wood", "would"], ["deer", "dear"], ["road", "rode"],
    ["tail", "tale"], ["mail", "male"], ["plane", "plain"], ["sail", "sale"],
    // American / British spellings and spelling variants say the same word.
    ["color", "colour"], ["colors", "colours"], ["favorite", "favourite"], ["gray", "grey"], ["mom", "mum"],
    ["meter", "metre"], ["meters", "metres"], ["kilometers", "kilometres"], ["centimeters", "centimetres"],
    ["neighbor", "neighbour"], ["neighbors", "neighbours"], ["flavor", "flavour"], ["favor", "favour"],
    ["center", "centre"], ["theater", "theatre"], ["pajamas", "pyjamas"], ["ok", "okay"], ["mr", "mister"],
    ["donuts", "doughnuts"], ["traveling", "travelling"], ["practice", "practise"],
    // Names the recognizer may spell another way.
    ["sean", "shawn", "shaun"], ["jenny", "jennie"], ["vicky", "vicki", "vickie"], ["cindy", "sindy"],
    ["ann", "anne"], ["sara", "sarah"], ["jeff", "geoff"], ["mandy", "mandi"], ["kenny", "kenney"],
    ["louisa", "luisa"], ["helen", "hellen"], ["jill", "gill"], ["judy", "judi"], ["tony", "toni"],
    ["sue", "su"], ["alan", "allen", "allan"], ["susan", "suzan"], ["betty", "bettie"], ["sally", "sallie"],
    ["lucy", "lucie"], ["jim", "gym"], ["tina", "teena"], ["yilan", "ilan"], ["keelung", "keelong", "kilung", "jilong"],
    ["nick", "nic"], ["mike", "mic"]
];
// Groups that share a word are merged, so every spelling maps to every other one.
const HOMOPHONES = new Map<string, string[]>();
{
    const groupOf = new Map<string, Set<string>>();
    for (const group of HOMOPHONE_GROUPS) {
        const merged = new Set<string>(group);
        for (const word of group) for (const other of groupOf.get(word) || []) merged.add(other);
        for (const word of merged) groupOf.set(word, merged);
    }
    for (const [word, group] of groupOf) HOMOPHONES.set(word, [...group].filter(other => other !== word));
}

// A contraction is split into two words by both tokenizers, so "it's" (it is) and "its" no longer
// line up one to one. These sound the same, so the heard form is rewritten to the answer's form.
const PHRASE_HOMOPHONES: [string, string[]][] = [
    ["its", ["it", "is"]], ["whose", ["who", "is"]], ["your", ["you", "are"]],
    ["their", ["they", "are"]], ["there", ["they", "are"]]
];
const sequenceAt = (tokens: string[], sequence: string[], start: number) => (
    sequence.every((token, offset) => tokens[start + offset] === token)
);
const containsSequence = (tokens: string[], sequence: string[]) => (
    tokens.some((_, index) => sequenceAt(tokens, sequence, index))
);
const countSequence = (tokens: string[], sequence: string[]) => (
    tokens.filter((_, index) => sequenceAt(tokens, sequence, index)).length
);
const commonLength = (left: string[], right: string[]) => {
    let previous = new Array(right.length + 1).fill(0);
    for (const token of left) {
        const current = [0];
        right.forEach((other, index) => current.push(token === other ? previous[index] + 1 : Math.max(previous[index + 1], current[index])));
        previous = current;
    }
    return previous[right.length];
};
// Rewrite `limit` matches, each time the one that best lines up with the answer: "Yes, it is its heart."
// heard as "yes it is it is heart" keeps the real "it is" and turns the extra one back into "its".
const replaceBestSequences = (expected: string[], tokens: string[], from: string[], to: string[], limit: number) => {
    let result = tokens;
    for (let round = 0; round < limit; round += 1) {
        let best: string[] | null = null;
        let bestScore = -1;
        for (let index = 0; index + from.length <= result.length; index += 1) {
            if (!sequenceAt(result, from, index)) continue;
            const candidate = [...result.slice(0, index), ...to, ...result.slice(index + from.length)];
            const score = commonLength(expected, candidate);
            if (score > bestScore) { best = candidate; bestScore = score; }
        }
        if (!best) break;
        result = best;
    }
    return result;
};
const alignPhraseHomophones = (expected: string[], spoken: string[]) => {
    for (const [word, phrase] of PHRASE_HOMOPHONES) {
        const extraPhrases = countSequence(spoken, phrase) - countSequence(expected, phrase);
        const missingWords = countSequence(expected, [word]) - countSequence(spoken, [word]);
        if (extraPhrases > 0 && missingWords > 0) spoken = replaceBestSequences(expected, spoken, phrase, [word], Math.min(extraPhrases, missingWords));
        else if (extraPhrases < 0 && missingWords < 0) spoken = replaceBestSequences(expected, spoken, [word], phrase, Math.min(-extraPhrases, -missingWords));
    }
    return spoken;
};

// Compound words and abbreviations are written together or apart ("living room" / "livingroom",
// "p m" / "pm", "t v" / "tv"): join 2-3 heard words that spell one answer word, or split one heard
// word that spells two neighbouring answer words.
const withoutApostrophes = (word: string) => word.replace(/'/g, "");
const alignJoinedWords = (expected: string[], spoken: string[]) => {
    const expectedWords = new Set(expected);
    const expectedByLetters = new Map(expected.map(word => [withoutApostrophes(word), word]));
    const result: string[] = [];
    for (let index = 0; index < spoken.length;) {
        const size = [3, 2].find(length => {
            const window = spoken.slice(index, index + length);
            return window.length === length && expectedByLetters.has(withoutApostrophes(window.join("")))
                && !containsSequence(expected, window);
        });
        if (size) {
            result.push(expectedByLetters.get(withoutApostrophes(spoken.slice(index, index + size).join(""))) as string);
            index += size;
            continue;
        }
        const token = spoken[index];
        const split = expectedWords.has(token) ? -1 : expected.findIndex((word, position) => (
            position + 1 < expected.length && withoutApostrophes(word + expected[position + 1]) === withoutApostrophes(token)
        ));
        if (split >= 0) result.push(expected[split], expected[split + 1]);
        else result.push(token);
        index += 1;
    }
    return result;
};

// Replace heard words that are a homophone of an answer word, or differ from it only in its th;
// report the th ones (homophones are not the child's mistake, so no tip).
export const alignThSoundAlikes = (expected: string[], spoken: string[]) => {
    const tips: { word: string; heard: string }[] = [];
    const expectedWords = new Set(expected);
    spoken = alignJoinedWords(expected, alignPhraseHomophones(expected, spoken));
    // Linking: "its ears" run together comes back as "its years" (a y sound slips in before a
    // vowel-initial word), so "y" + an answer word that starts with a vowel counts as that word.
    // A possessive keeps its homophone: "Anne's" for the answer's "Ann's".
    const homophoneOf = (token: string) => {
        const direct = (HOMOPHONES.get(token) || []).find(word => expectedWords.has(word));
        if (direct || !token.endsWith("'s")) return direct;
        const base = (HOMOPHONES.get(token.slice(0, -2)) || []).find(word => expectedWords.has(word + "'s"));
        return base ? base + "'s" : undefined;
    };
    spoken = spoken.map(token => expectedWords.has(token) ? token
        : homophoneOf(token)
            || (/^y[aeiou]/.test(token) && expectedWords.has(token.slice(1)) ? token.slice(1) : token));
    // A homophone that is also an answer word ("I am the apple of his eye." heard as "... his I"):
    // when the transcript has more of it than the answer and fewer of its partner, the extra one is the partner.
    for (const word of new Set(expected)) {
        const missing = countSequence(expected, [word]) - countSequence(spoken, [word]);
        if (missing <= 0) continue;
        for (const partner of HOMOPHONES.get(word) || []) {
            const extra = countSequence(spoken, [partner]) - countSequence(expected, [partner]);
            if (extra > 0) spoken = replaceBestSequences(expected, spoken, [partner], [word], Math.min(missing, extra));
        }
    }
    const thWords = [...new Set(expected.filter(token => token.includes("th")))];
    if (!thWords.length) return { spoken, tips };
    const aligned = spoken.map(token => {
        if (expectedWords.has(token)) return token;
        const word = thWords.find(candidate => thSoundAlikes(candidate).includes(token));
        if (!word) return token;
        if (!tips.some(tip => tip.word === word)) tips.push({ word, heard: token });
        return word;
    });
    return { spoken: aligned, tips };
};

// Young learners should not fail because the speech recognizer drops one short
// grammar word.  Core answer words and yes/no polarity still have to match, and
// longer answers may differ by at most 30 percent of their tokens.
export const matchesChildFriendlySentence = (expectedAnswer: unknown, recognizedText: unknown) => {
    const expected = canonicalSentenceTokens(expectedAnswer);
    const spoken = alignThSoundAlikes(expected, canonicalSentenceTokens(recognizedText)).spoken;
    if (!expected.length || !spoken.length) return false;
    if (expected.join(" ") === spoken.join(" ")) return true;
    if (expected.length < 3) return false;

    const expectedPolarity = expected.filter(token => POLARITY_WORDS.has(token));
    const spokenPolarity = spoken.filter(token => POLARITY_WORDS.has(token));
    if (expectedPolarity.join(" ") !== spokenPolarity.join(" ")) return false;
    // Important nouns and names must be said: "They come from Japan." is not "They come from Italy."
    if (missingKeyWords(expectedAnswer, spoken).length) return false;

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
