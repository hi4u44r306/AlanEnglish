export const shuffleSpeakingQuestions = (questions, random = Math.random) => {
    const shuffled = [...(questions || [])];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
};

export const createAlphabetRound = (questions, random = Math.random) => (
    shuffleSpeakingQuestions(questions, random).map(question => ({
        ...question,
        display_text: random() < 0.5
            ? String(question.question_text || "").toLowerCase()
            : String(question.question_text || "").toUpperCase()
    }))
);

export const createFoundationRound = (questions, interactionType, random = Math.random) => (
    interactionType === "alphabet_round"
        ? createAlphabetRound(questions, random)
        : shuffleSpeakingQuestions(questions, random)
);
