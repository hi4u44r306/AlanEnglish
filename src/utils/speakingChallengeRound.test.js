import { createAlphabetRound, shuffleSpeakingQuestions } from "./speakingChallengeRound";

describe("speaking challenge rounds", () => {
    it("uses Fisher-Yates without dropping or duplicating questions", () => {
        const questions = [1, 2, 3, 4].map(id => ({ id }));
        const values = [0.1, 0.7, 0.2];
        const shuffled = shuffleSpeakingQuestions(questions, () => values.shift());
        expect(shuffled.map(item => item.id).sort()).toEqual([1, 2, 3, 4]);
        expect(new Set(shuffled.map(item => item.id)).size).toBe(4);
        expect(questions.map(item => item.id)).toEqual([1, 2, 3, 4]);
    });

    it("shows every alphabet question once and randomizes only letter case", () => {
        const questions = "ABC".split("").map((letter, index) => ({ id: index + 1, question_text: letter }));
        const round = createAlphabetRound(questions, () => 0);
        expect(round).toHaveLength(3);
        expect(new Set(round.map(item => item.id)).size).toBe(3);
        expect(round.map(item => item.display_text).sort()).toEqual(["a", "b", "c"]);
        expect(round.every(item => item.question_text === item.display_text.toUpperCase())).toBe(true);
    });
});
