import { createPictureChallengeRound, tokenizeSpeakingSentence } from "./speakingPictureChallenge";

describe("speaking picture challenge helpers", () => {
    it("tokenizes visible words, punctuation and the answer blank without revealing an answer", () => {
        expect(tokenizeSpeakingSentence("The ____ is in the tree.")).toEqual([
            { tokenIndex: 0, text: "The", kind: "word" },
            { tokenIndex: 1, text: "____", kind: "blank" },
            { tokenIndex: 2, text: "is", kind: "word" },
            { tokenIndex: 3, text: "in", kind: "word" },
            { tokenIndex: 4, text: "the", kind: "word" },
            { tokenIndex: 5, text: "tree", kind: "word" },
            { tokenIndex: 6, text: ".", kind: "punctuation" }
        ]);
    });

    it("shuffles a complete round without omissions or duplicates", () => {
        const questions = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
        const randomValues = [0, 0.25, 0.5];
        const round = createPictureChallengeRound(questions, () => randomValues.shift() ?? 0);
        expect(round).toHaveLength(4);
        expect(new Set(round.map(item => item.id)).size).toBe(4);
        expect(round).not.toBe(questions);
    });
});
