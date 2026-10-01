export const isReadAloudType = type => ["alphabet_round", "letter_spelling", "standard_sentence"].includes(type);

// Unknown or incomplete mixed-page metadata keeps both modes. Never infer a
// question type from its page number, title, or English punctuation.
export const usesSinglePracticeMode = item => {
    const metadata = item?.generation_metadata || {};
    if (metadata.interaction_type !== "mixed") return isReadAloudType(metadata.interaction_type);
    const modes = metadata.question_modes;
    const count = Number(item.question_count ?? item.speaking_questions?.length);
    return count > 0 && Array.isArray(modes) && modes.length === count
        && new Set(modes.map(mode => Number(mode.sort_order))).size === count
        && modes.every(mode => isReadAloudType(mode.interaction_type));
};
