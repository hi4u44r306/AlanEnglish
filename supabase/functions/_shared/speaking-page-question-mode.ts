export const pageQuestionMode = (metadata: any = {}, question: any = {}, interaction: any = null) => {
    const sortOrder = Number(question?.sort_order);
    const configured = Array.isArray(metadata?.question_modes)
        ? metadata.question_modes.find((item: any) => Number(item?.sort_order) === sortOrder) : null;
    const interactionType = configured?.interaction_type
        || (metadata?.interaction_type === "mixed" ? question?.interaction_type || interaction?.interaction_type || "standard_sentence" : metadata?.interaction_type)
        || "standard_sentence";
    const configuredPromptMode = configured?.prompt_mode
        || question?.prompt_mode
        || (Array.isArray(metadata?.prompt_modes_by_sort_order) ? metadata.prompt_modes_by_sort_order[sortOrder] : null)
        || metadata?.prompt_mode
        || "english_qa";
    return {
        interactionType,
        promptMode: interactionType === "text_qa" && ["english_qa", "zh_to_en", "grammar_cue"].includes(configuredPromptMode)
            ? configuredPromptMode : interactionType === "text_qa" ? "english_qa" : null
    };
};
