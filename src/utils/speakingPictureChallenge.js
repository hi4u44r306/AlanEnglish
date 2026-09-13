const SENTENCE_TOKEN_PATTERN = /_+|[A-Za-z]+(?:['’][A-Za-z]+)?|[^A-Za-z_\s]+/g;

export const PICTURE_INTERACTION_TYPES = new Set(["picture_qa", "picture_gap_sentence"]);

export const tokenizeSpeakingSentence = value => {
    const matches = String(value || "").match(SENTENCE_TOKEN_PATTERN) || [];
    return matches.map((text, tokenIndex) => ({
        tokenIndex,
        text,
        kind: /^_+$/.test(text) ? "blank" : /^[A-Za-z]+(?:['’][A-Za-z]+)?$/.test(text) ? "word" : "punctuation"
    }));
};

export const createPictureChallengeRound = (questions, random = Math.random) => {
    const shuffled = [...(questions || [])];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
};
