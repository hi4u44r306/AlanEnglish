type ChallengeSet = {
    id: number;
    title?: string | null;
    generation_metadata?: Record<string, unknown> | null;
    speaking_questions?: Array<{ id: number }> | null;
};

const TOPIC_TEMPLATE_KEYS = new Set([
    "workbook_1_greetings_polite_v1",
    "workbook_1_colors_objects_v1",
    "workbook_1_numbers_math_v1"
]);

export type SpeakingChallengeCatalogSection = "preparation" | "textbook" | "topic";

export const speakingChallengeCatalogSection = (set: ChallengeSet): SpeakingChallengeCatalogSection => {
    const metadata = set?.generation_metadata || {};
    if (metadata.interaction_type === "alphabet_round") return "preparation";
    if (TOPIC_TEMPLATE_KEYS.has(String(metadata.template_key || ""))) return "topic";
    return "textbook";
};

export const speakingChallengeSourcePages = (set: ChallengeSet): number[] => {
    const pages = Array.isArray(set?.generation_metadata?.source_pages)
        ? set.generation_metadata.source_pages
        : [];
    return [...new Set(pages
        .map(page => Number(page))
        .filter(page => Number.isInteger(page) && page > 0))]
        .sort((left, right) => left - right);
};

const explicitOrder = (set: ChallengeSet) => Number(set?.generation_metadata?.challenge_order);

export const speakingChallengeSequenceOrder = (set: ChallengeSet): number => {
    const section = speakingChallengeCatalogSection(set);
    const sectionOffset = section === "preparation" ? 0 : section === "textbook" ? 10000 : 20000;
    const configured = explicitOrder(set);
    if (Number.isInteger(configured) && configured >= 0) return sectionOffset + configured;

    const firstSourcePage = speakingChallengeSourcePages(set)[0];
    if (section !== "preparation" && firstSourcePage) return sectionOffset + firstSourcePage;

    const fromTitle = String(set?.title || "").match(/^\s*(?:P\s*)?(\d{1,4})\b/i);
    if (fromTitle) return sectionOffset + Number(fromTitle[1]);
    return sectionOffset + 5000 + Number(set?.id || 0);
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

    return ordered.map((set, index) => {
        // Students progress through one linear sequence per Workbook. A later
        // topic or textbook challenge must never bypass an unfinished earlier
        // challenge, regardless of its catalog section.
        const previous = ordered[index - 1];
        const section = speakingChallengeCatalogSection(set);
        const isUnlocked = index === 0 || speakingChallengeIsComplete(previous, completedQuestionIds);
        return {
            id: Number(set.id),
            catalog_section: section,
            source_pages: speakingChallengeSourcePages(set),
            sequence_order: speakingChallengeSequenceOrder(set),
            is_completed: speakingChallengeIsComplete(set, completedQuestionIds),
            is_unlocked: isUnlocked
        };
    });
};
