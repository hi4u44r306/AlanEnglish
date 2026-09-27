export const pageQuestionMode = (metadata = {}, question = {}) => {
    const configured = Array.isArray(metadata.question_modes)
        ? metadata.question_modes.find(item => Number(item.sort_order) === Number(question.sort_order)) : null;
    const interaction = Array.isArray(question.speaking_question_interactions)
        ? question.speaking_question_interactions[0] : question.speaking_question_interactions;
    const interactionType = configured?.interaction_type
        || (metadata.interaction_type === "mixed" ? interaction?.interaction_type || "standard_sentence" : metadata.interaction_type)
        || "standard_sentence";
    return {
        interactionType,
        promptMode: interactionType === "text_qa" ? configured?.prompt_mode || metadata.prompt_mode || "english_qa" : null
    };
};
