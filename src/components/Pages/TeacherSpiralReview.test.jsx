import { parseReviewCards } from "./spiralReviewParsing";

describe("TeacherSpiralReview", () => {
    test("parses word and sentence rows separated by full-width or ASCII pipes", () => {
        expect(parseReviewCards("apple｜蘋果｜I see an apple.\nHow are you? | 你好嗎"))
            .toEqual([
                { card_type: "word", prompt_en: "apple", meaning_zh: "蘋果", example_sentence: "I see an apple." },
                { card_type: "sentence", prompt_en: "How are you?", meaning_zh: "你好嗎", example_sentence: "" }
            ]);
    });

    test("ignores blank rows", () => {
        expect(parseReviewCards("\ncat｜貓\n\n")).toHaveLength(1);
    });
});
