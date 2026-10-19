import { hasSpeakingAnswerSlots, matchesSpeakingAnswerTemplate } from "./speaking-pronunciation-reference.ts";
import { FOUNDATION_INTERACTION_TYPES, OPTIONAL_GRAMMAR_WORDS, POLARITY_WORDS, alignThSoundAlikes, matchesFoundationAnswer, spellOutNumbers } from "./speaking-foundation-answer.ts";
import { missingKeyWords } from "./speaking-key-nouns.ts";

export const readingWords = (text: string): string[] => spellOutNumbers(text).toLowerCase().replace(/[’‘]/g, "'")
    .replace(/\bi'm\b/g, "i am").replace(/\bcan't\b/g, "cannot").replace(/\bwon't\b/g, "will not").replace(/n't\b/g, " not")
    .replace(/\b(you|we|they)'re\b/g, "$1 are").replace(/\b(i|you|we|they)'ve\b/g, "$1 have")
    .replace(/\b(it|he|she|that|what|where|who)'s\b/g, "$1 is")
    .match(/[a-z]+(?:'[a-z]+)?|\d+/g) || [];

export function readingCoverage(expectedText: string, recognizedText: string) {
    const expected = readingWords(expectedText);
    const { spoken: heard, tips: thTips } = alignThSoundAlikes(expected, readingWords(recognizedText));
    const table = Array.from({ length: expected.length + 1 }, () => new Uint16Array(heard.length + 1));
    for (let i = 1; i <= expected.length; i++) for (let j = 1; j <= heard.length; j++) {
        table[i][j] = expected[i - 1] === heard[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
    }
    const hits = expected.map(() => false);
    let i = expected.length, j = heard.length;
    while (i && j) {
        if (expected[i - 1] === heard[j - 1]) { hits[i - 1] = true; i--; j--; }
        else if (table[i - 1][j] >= table[i][j - 1]) i--; else j--;
    }
    const matched = table[expected.length][heard.length];
    return { matched, total: expected.length, score: expected.length ? Math.round(matched / expected.length * 100) : 0, thTips,
        words: expected.map((text, index) => ({ text, status: hits[index] ? "good" : "retry" })) };
}

// A textbook's trailing "(No, ...)" or "(Yes, ...)" replaces the preceding
// yes/no response; reading either or both responses is acceptable.
// Keep the shared question/answer prefix; other parentheses are expanded by readingAnswerAlternatives.
function yesNoAlternatives(template: string): string[] {
    const alternative = template.match(/\s*[（(]([^()（）]+)[）)]\s*[.!?]?\s*$/);
    if (!alternative || !/^(yes|no)\b[\s,]/i.test(alternative[1].trim())) return [template];
    const primary = template.slice(0, alternative.index).trim();
    const responses = [...primary.matchAll(/\b(?:yes|no)\b/gi)];
    const response = responses[responses.length - 1];
    if (!response || (response.index! > 0 && !/[.!?]\s*$/.test(primary.slice(0, response.index)))) return [template];
    const prefix = primary.slice(0, response.index);
    const second = alternative[1].trim();
    return [primary, prefix + second, primary + " " + second, prefix + second + " " + primary.slice(response.index)];
}

// Textbook answers also mark choices inline: "two dozen (of) beer", "I'm (We're) in bed",
// "worried/nervous", "Mind the gap. / Mind your step." Each template is expanded into readable
// variants (never more than 32); the scorer keeps whichever variant the child's reading matches best.
// Variants only drop or swap in the author's own words, so no new answer word is ever invented.
const MAX_ANSWER_VARIANTS = 32;
const MAX_SLASHES = 6;
const ENDS_SENTENCE = /[.!?。！？]["'”’]*$/;
const INLINE_MARKS = /[/／()（）]/;
const SINGLE_WORD = /^[A-Za-z]+(?:['’][A-Za-z]+)?$/;

const uniqueRoundRobin = (lists: string[][]) => {
    const result: string[] = [];
    for (let index = 0; result.length < MAX_ANSWER_VARIANTS && lists.some(list => index < list.length); index += 1) {
        for (const list of lists) {
            if (index < list.length && !result.includes(list[index])) result.push(list[index]);
            if (result.length >= MAX_ANSWER_VARIANTS) break;
        }
    }
    return result;
};

const tidyAnswerVariant = (text: string) => text
    .replace(/[()（）]/g, " ")
    .replace(/[/／]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/^[\s.,!?;:]+/, "")
    .trim();

// "(of)": without it or with it; a capitalized or contracted single word ("I'm (We're)") may also
// replace the word right before it.
const expandParentheses = (text: string, depth = 0): string[] => {
    const match = text.match(/[（(]([^()（）]*)[）)]/);
    if (!match || depth > 6) return [text];
    const before = text.slice(0, match.index);
    const after = text.slice((match.index as number) + match[0].length);
    const inner = match[1].trim();
    const joinLeft = before !== "" && !/\s$/.test(before);
    const joinRight = /^[A-Za-z]/.test(after);
    const options = [
        before + (joinLeft || joinRight ? "" : " ") + after,
        before + (joinLeft ? "" : " ") + inner + (joinRight ? "" : " ") + after
    ];
    const previous = before.match(/([A-Za-z]+(?:['’][A-Za-z]+)?)\s+$/);
    if (previous && SINGLE_WORD.test(inner) && (/^[A-Z]/.test(inner) || /['’]/.test(inner))) {
        options.push(before.slice(0, previous.index) + inner + (joinRight ? "" : " ") + after);
    }
    return uniqueRoundRobin(options.map(option => expandParentheses(option, depth + 1)));
};

// "a/b": keep the left choice (drop 1-3 words, or the whole sentence, after the slash) or the right
// choice (drop 1-3 words, or the whole sentence, before it).
const expandSlashUnits = (units: string[], memo: Map<string, string[]>): string[] => {
    const key = units.join(" ");
    const cached = memo.get(key);
    if (cached) return cached;
    const slash = units.indexOf("/");
    let result: string[];
    if (slash < 0) result = [key];
    else {
        const left = units.slice(0, slash);
        const right = units.slice(slash + 1);
        if (!left.length || !right.length || right[0] === "/") result = expandSlashUnits([...left, ...right], memo);
        else {
            const leftEndsSentence = ENDS_SENTENCE.test(left[left.length - 1]);
            let leftSpan = 0;
            for (let index = left.length - 1; index >= 0; index -= 1) {
                if (index < left.length - 1 && ENDS_SENTENCE.test(left[index])) break;
                leftSpan += 1;
            }
            let rightSpan = 0;
            for (const unit of right) {
                if (unit === "/") break;
                rightSpan += 1;
                if (ENDS_SENTENCE.test(unit)) break;
            }
            const keepLeft = (count: number) => [...left, ...right.slice(count)];
            const keepRight = (count: number) => [...left.slice(0, left.length - count), ...right];
            const options: string[][] = [];
            for (let count = 1; count <= 3; count += 1) {
                if (count <= rightSpan) options.push(keepLeft(count));
                // Keep at least one word of the left sentence ("Your passport/card" must not become
                // just "card ..."), unless the left choice is a single word ("Worried/Nervous").
                if (count <= Math.max(1, leftSpan - 1)) options.push(keepRight(count));
            }
            if (leftEndsSentence) {
                options.push(keepLeft(rightSpan));
                // "Please give me some, thank you./ No way. I hate it.": the right choice can be several sentences.
                const rightChoice = right.indexOf("/") < 0 ? right.length : right.indexOf("/");
                if (rightChoice > rightSpan) options.push(keepLeft(rightChoice));
                if (/^[A-Z]/.test(right[0])) options.push(keepRight(leftSpan));
            }
            result = uniqueRoundRobin(options
                .filter(option => option.some(unit => /[A-Za-z]/.test(unit)))
                .map(option => expandSlashUnits(option, memo)));
        }
    }
    memo.set(key, result);
    return result;
};
const expandSlashes = (text: string) => {
    if (!/[/／]/.test(text)) return [text];
    const units = text.replace(/\s*[/／]\s*/g, " / ").trim().split(/\s+/);
    if (units.filter(unit => unit === "/").length > MAX_SLASHES) return [text];
    return expandSlashUnits(units, new Map());
};

export function readingAnswerAlternatives(template: string): string[] {
    const base = yesNoAlternatives(template);
    // Personal-answer slots keep their own matcher; their brackets must not be rewritten.
    if (hasSpeakingAnswerSlots(template)) return base;
    const expanded = uniqueRoundRobin(base.map(text => INLINE_MARKS.test(text)
        ? uniqueRoundRobin(expandParentheses(text).map(expandSlashes))
            .map(tidyAnswerVariant)
            .filter(variant => /[A-Za-z]/.test(variant))
        : [text]));
    return expanded.length ? expanded : base;
}

export function assessReadingCompleteness(question: { answerTemplate: string; acceptedAnswers: string[]; interactionType: string }, recognizedText: unknown) {
    if (typeof recognizedText !== "string" || recognizedText.length > 2000 || !/[a-z]/i.test(recognizedText)) {
        throw Object.assign(new Error("沒有辨識到有效英文，請重新錄音。"), { status: 422, code: "speech_no_match" });
    }
    const text = recognizedText.replace(/[\x00-\x1f]/g, " ").trim();
    const templates = [question.answerTemplate, ...question.acceptedAnswers].flatMap(readingAnswerAlternatives);
    const hasSlots = templates.some(hasSpeakingAnswerSlots);
    const structuredMatch = templates.some(template => hasSpeakingAnswerSlots(template) && matchesSpeakingAnswerTemplate(template, text));
    const strictType = FOUNDATION_INTERACTION_TYPES.has(question.interactionType);
    if (!strictType && !["", "standard_sentence"].includes(question.interactionType)) {
        throw Object.assign(new Error("這個題型尚未支援本機朗讀評分。"), { status: 422, code: "local_question_unsupported" });
    }
    const strictMatch = strictType && matchesFoundationAnswer(question.interactionType, templates[0], text, templates.slice(1));
    const variants = templates.map(template => template.replace(/[\[［][^\]］]+[\]］]/g, ""));
    const candidates = variants.map(variant => readingCoverage(variant, text));
    const coverage = candidates.reduce((best, next) => next.score > best.score ? next : best);
    // A long sentence reaches 70% even with a wrong noun or name, so the variant read must also have
    // every key word heard ("They come from Japan." does not pass for "They come from Italy.").
    const heardKeyWords = (variant: string) => !missingKeyWords(variant, alignThSoundAlikes(readingWords(variant), readingWords(text)).spoken).length;
    const keyMatch = candidates
        .filter((candidate, index) => candidate.score >= 70 && candidate.total > 0 && heardKeyWords(variants[index]))
        .reduce<typeof coverage | null>((best, next) => !best || next.score > best.score ? next : best, null);
    const alphabet = ["alphabet_round", "letter_spelling"].includes(question.interactionType);
    // Letter aliases and personal slots are all-or-nothing; missing/personal text
    // must never be reported as a measured phoneme score.
    const score = alphabet || hasSlots ? (strictMatch || structuredMatch ? 100 : 0) : coverage.score;
    const answerMatch = score >= 70 && (hasSlots ? structuredMatch || strictMatch : strictType ? strictMatch : Boolean(keyMatch));
    const revealReference = answerMatch && !hasSlots && !alphabet;
    // Show the variant that passed (the best-scoring one may have missed a key word).
    const shown = answerMatch && !strictType && !hasSlots && keyMatch ? keyMatch : coverage;
    // Passed, but a th word was heard as s/f/t/d/z: pass it and say which word to practise.
    const pronunciationTips = answerMatch && !alphabet ? shown.thTips.map(tip => ({ ...tip, sound: "th" })) : [];
    return {
        assessment_kind: "local_completeness_v1", assessment_status: "assessed", evidence_source: "client_transcript",
        recognized_text: text, answer_match: answerMatch, pronunciation_tips: pronunciationTips,
        // Null explicitly means not measured. Historical Azure results stay intact.
        scores: { completeness: score, pronunciation: null, accuracy: null, fluency: null, prosody: null },
        words: revealReference ? shown.words : readingWords(text).map(text => ({ text, status: "practice" })),
        feedback: answerMatch ? pronunciationTips.length
            ? `通過了！不過 ${pronunciationTips.map(tip => tip.word).join("、")} 的 th 可能沒念清楚（系統聽成 ${pronunciationTips.map(tip => tip.heard).join("、")}）。下次把舌尖輕放在上下牙齒中間再念，會更標準。`
            : "已完成這次朗讀！這是朗讀完整度，不是發音準確度。"
            : alphabet ? "請聽示範，再把字母分開唸清楚；辨識也可能聽錯，可以重錄。"
                : "請再確認題目，用完整且正確的句子回答。辨識也可能聽錯，可以重錄。"
    };
}

// ---- Azure 再確認：本機判沒過、但只差一點（多半是辨識聽錯）時才值得花錢再確認。
// 只在伺服器判斷；前端送來的文字不可信，所以這裡也只決定「要不要再確認」，最後仍由 Azure 判定。
const RECHECK_TYPES = new Set(["", "standard_sentence", "text_qa", "picture_qa", "picture_gap_sentence"]);
// 換了這些字是意思不同（他／她、數字、是否），不是聽錯，不送再確認。
export const MEANING_SWAP_WORDS = new Set([
    "he", "she", "his", "her", "him", "they", "we", "i", "you", "it", "my", "your", "our", "their", "me", "us", "them",
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"
]);
export const RECHECK_RULES = Object.freeze({ minCoverage: 60, minWords: 3, maxWords: 20, maxExtraWords: 2 });

const isCoreWord = (word: string) => !OPTIONAL_GRAMMAR_WORDS.has(word) && !POLARITY_WORDS.has(word);
const polarity = (words: string[]) => words.filter(word => POLARITY_WORDS.has(word)).join(" ");

export function localRecheckCandidate(
    question: { answerTemplate: string; acceptedAnswers: string[]; interactionType: string },
    recognizedText: unknown
): { eligible: boolean; reason: string; referenceText?: string } {
    if (!RECHECK_TYPES.has(String(question.interactionType || ""))) return { eligible: false, reason: "type" };
    if (typeof recognizedText !== "string" || !/[a-z]/i.test(recognizedText)) return { eligible: false, reason: "no_text" };
    const templates = [question.answerTemplate, ...question.acceptedAnswers].flatMap(readingAnswerAlternatives);
    if (templates.some(hasSpeakingAnswerSlots)) return { eligible: false, reason: "slots" };
    const heard = readingWords(recognizedText);
    const ranked = templates
        .map(template => {
            const coverage = readingCoverage(template, recognizedText);
            const missingCore = coverage.words.filter(word => word.status !== "good" && isCoreWord(word.text)).map(word => word.text);
            return { template, coverage, missingCore };
        })
        .sort((left, right) => right.coverage.score - left.coverage.score || left.missingCore.length - right.missingCore.length);
    const best = ranked[0];
    if (!best) return { eligible: false, reason: "no_template" };
    const expected = readingWords(best.template);
    if (expected.length < RECHECK_RULES.minWords || expected.length > RECHECK_RULES.maxWords) return { eligible: false, reason: "length" };
    if (polarity(expected) !== polarity(heard)) return { eligible: false, reason: "polarity" };
    if (best.coverage.score < RECHECK_RULES.minCoverage) return { eligible: false, reason: "far" };
    const allowedMissing = expected.length >= 8 ? 2 : 1;
    if (!best.missingCore.length || best.missingCore.length > allowedMissing) return { eligible: false, reason: "core_words" };
    if (best.missingCore.some(word => MEANING_SWAP_WORDS.has(word))) return { eligible: false, reason: "meaning_swap" };
    // 念成別的字（聽到的字數不少於題目）才算聽錯；漏念不送。
    if (heard.length < expected.length) return { eligible: false, reason: "omission" };
    if (heard.length - expected.length > RECHECK_RULES.maxExtraWords) return { eligible: false, reason: "extra_words" };
    // 被取代的字不能是句子裡另一個答案字（只是換位置）。
    const substitutes = heard.filter(word => !expected.includes(word));
    if (!substitutes.length) return { eligible: false, reason: "reordered" };
    if (substitutes.some(word => MEANING_SWAP_WORDS.has(word))) return { eligible: false, reason: "meaning_swap" };
    return { eligible: true, reason: "close", referenceText: best.template.replace(/[\[［][^\]］]+[\]］]/g, "").replace(/\s+/g, " ").trim() };
}
