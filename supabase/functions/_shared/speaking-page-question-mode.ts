export const pageQuestionMode = (metadata: any = {}, question: any = {}, interaction: any = null) => {
    const configured = Array.isArray(metadata?.question_modes)
        ? metadata.question_modes.find((item: any) => Number(item?.sort_order) === Number(question?.sort_order)) : null;
    const interactionType = configured?.interaction_type
        || (metadata?.interaction_type === "mixed" ? interaction?.interaction_type || "standard_sentence" : metadata?.interaction_type)
        || "standard_sentence";
    return {
        interactionType,
        promptMode: interactionType === "text_qa" ? configured?.prompt_mode || metadata?.prompt_mode || "english_qa" : null
    };
};
