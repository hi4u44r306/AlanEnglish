type ChallengeSet = {
    id: number;
    title?: string | null;
    generation_metadata?: Record<string, unknown> | null;
    speaking_questions?: Array<{ id: number }> | null;
};

const explicitOrder = (set: ChallengeSet) => Number(set?.generation_metadata?.challenge_order);

export const speakingChallengeSequenceOrder = (set: ChallengeSet): number => {
    const configured = explicitOrder(set);
    if (Number.isInteger(configured) && configured >= 0) return configured;

    const fromTitle = String(set?.title || "").match(/^\s*(?:P\s*)?(\d{1,4})\b/i);
    if (fromTitle) return Number(fromTitle[1]);
    return 100000 + Number(set?.id || 0);
};

export const sortSpeakingChallengeSets = <T extends ChallengeSet>(sets: T[]): T[] => (
    [...sets].sort((left, right) => (
        speakingChallengeSequenceOrder(left) - speakingChallengeSequenceOrder(right)
        || Number(left.id) - Number(right.id)
    ))
);

export const speakingChallengeIsComplete = (set: ChallengeSet, completedQuestionIds: Set<number>): boolean => {
    const questions = set.speaking_questions || [];
    return questions.length > 0 && questions.every(question => completedQuestionIds.has(Number(question.id)));
};

export const speakingChallengeUnlockState = <T extends ChallengeSet>(sets: T[], completedQuestionIds: Set<number>) => {
    const ordered = sortSpeakingChallengeSets(sets);
    return ordered.map((set, index) => ({
        id: Number(set.id),
        sequence_order: speakingChallengeSequenceOrder(set),
        is_completed: speakingChallengeIsComplete(set, completedQuestionIds),
        is_unlocked: index === 0 || speakingChallengeIsComplete(ordered[index - 1], completedQuestionIds)
    }));
};
