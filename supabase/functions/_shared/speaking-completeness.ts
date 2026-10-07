import { hasSpeakingAnswerSlots, matchesSpeakingAnswerTemplate } from "./speaking-pronunciation-reference.ts";
import { FOUNDATION_INTERACTION_TYPES, matchesFoundationAnswer } from "./speaking-foundation-answer.ts";

export const readingWords = (text: string): string[] => text.toLowerCase().replace(/[’‘]/g, "'")
    .replace(/\bi'm\b/g, "i am").replace(/\bcan't\b/g, "cannot").replace(/\bwon't\b/g, "will not").replace(/n't\b/g, " not")
    .replace(/\b(you|we|they)'re\b/g, "$1 are").replace(/\b(i|you|we|they)'ve\b/g, "$1 have")
    .replace(/\b(it|he|she|that|what|where|who)'s\b/g, "$1 is")
    .match(/[a-z]+(?:'[a-z]+)?|\d+/g) || [];

export function readingCoverage(expectedText: string, recognizedText: string) {
    const expected = readingWords(expectedText), heard = readingWords(recognizedText);
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
    return { matched, total: expected.length, score: expected.length ? Math.round(matched / expected.length * 100) : 0,
        words: expected.map((text, index) => ({ text, status: hits[index] ? "good" : "retry" })) };
}

// A textbook's trailing "(No, ...)" or "(Yes, ...)" replaces the preceding
// yes/no response; it is not an additional sentence the learner must read.
// Keep the shared question/answer prefix, and leave other parentheses intact.
export function readingAnswerAlternatives(template: string): string[] {
    const alternative = template.match(/\s*[（(]([^()（）]+)[）)]\s*[.!?]?\s*$/);
    if (!alternative || !/^(yes|no)\b[\s,]/i.test(alternative[1].trim())) return [template];
    const primary = template.slice(0, alternative.index).trim();
    const responses = [...primary.matchAll(/\b(?:yes|no)\b/gi)];
    const response = responses[responses.length - 1];
    if (!response || (response.index! > 0 && !/[.!?]\s*$/.test(primary.slice(0, response.index)))) return [template];
    return [primary, primary.slice(0, response.index) + alternative[1].trim()];
}

export function assessReadingCompleteness(question: { answerTemplate: string; acceptedAnswers: string[]; interactionType: string }, recognizedText: unknown) {
    if (typeof recognizedText !== "string" || recognizedText.length > 2000 || !/[a-z]/i.test(recognizedText)) {
        throw Object.assign(new Error("沒有辨識到有效英文，請重新錄音。"), { status: 422, code: "speech_no_match" });
    }
    const text = recognizedText.replace(/[\u0000-\u001f]/g, " ").trim();
    const templates = [question.answerTemplate, ...question.acceptedAnswers].flatMap(readingAnswerAlternatives);
    const hasSlots = templates.some(hasSpeakingAnswerSlots);
    const structuredMatch = templates.some(template => hasSpeakingAnswerSlots(template) && matchesSpeakingAnswerTemplate(template, text));
    const strictType = FOUNDATION_INTERACTION_TYPES.has(question.interactionType);
    if (!strictType && !["", "standard_sentence"].includes(question.interactionType)) {
        throw Object.assign(new Error("這個題型尚未支援本機朗讀評分。"), { status: 422, code: "local_question_unsupported" });
    }
    const strictMatch = strictType && matchesFoundationAnswer(question.interactionType, templates[0], text, templates.slice(1));
    const candidates = templates.map(template => readingCoverage(template.replace(/[\u005B［][^\u005D］]+[\u005D］]/g, ""), text));
    const coverage = candidates.reduce((best, next) => next.score > best.score ? next : best);
    const alphabet = ["alphabet_round", "letter_spelling"].includes(question.interactionType);
    // Letter aliases and personal slots are all-or-nothing; missing/personal text
    // must never be reported as a measured phoneme score.
    const score = alphabet || hasSlots ? (strictMatch || structuredMatch ? 100 : 0) : coverage.score;
    const answerMatch = hasSlots ? structuredMatch || strictMatch : strictType ? strictMatch : coverage.total > 0 && coverage.matched / coverage.total >= 0.8;
    const revealReference = answerMatch && !hasSlots && !alphabet;
    return {
        assessment_kind: "local_completeness_v1", assessment_status: "assessed", evidence_source: "client_transcript",
        recognized_text: text, answer_match: answerMatch,
        // Null explicitly means not measured. Historical Azure results stay intact.
        scores: { completeness: score, pronunciation: null, accuracy: null, fluency: null, prosody: null },
        words: revealReference ? coverage.words : readingWords(text).map(text => ({ text, status: "practice" })),
        feedback: answerMatch ? "已完成這次朗讀！這是朗讀完整度，不是發音準確度。"
            : alphabet ? "請聽示範，再把字母分開唸清楚；辨識也可能聽錯，可以重錄。"
                : "請再確認題目，用完整且正確的句子回答。辨識也可能聽錯，可以重錄。"
    };
}
