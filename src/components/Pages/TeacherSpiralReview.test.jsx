import { normalizeGeneratedCards } from "./spiralReviewParsing";

describe("TeacherSpiralReview", () => {
    test("normalizes generated word and sentence cards", () => {
        expect(normalizeGeneratedCards([
            { card_type: "word", prompt_en: " apple ", meaning_zh: " 蘋果 ", example_sentence: " I see an apple. " },
            { card_type: "sentence", prompt_en: "How are you?", meaning_zh: "你好嗎" }
        ]))
            .toEqual([
                { card_type: "word", prompt_en: "apple", meaning_zh: "蘋果", example_sentence: "I see an apple." },
                { card_type: "sentence", prompt_en: "How are you?", meaning_zh: "你好嗎", example_sentence: "" }
            ]);
    });

    test("ignores empty and workbook blank-answer prompts", () => {
        expect(normalizeGeneratedCards([
            { prompt_en: "" }, { prompt_en: "My name is ____." }, { prompt_en: "cat", meaning_zh: "貓" }
        ])).toEqual([{ card_type: "word", prompt_en: "cat", meaning_zh: "貓", example_sentence: "" }]);
    });
});
