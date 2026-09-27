// Chinese learner clues may appear anywhere in the displayed question. Only
// the English part has to form a punctuated prompt for speaking practice.
export const textQaPromptIsComplete = value => {
    const spoken = String(value || "")
        .replace(/\s*[（(]\s*[^()（）]+?\s*[）)]\s*$/u, "")
        .replace(/？/g, "?")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/[()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
    return /[A-Za-z]/.test(spoken) && /[.!?]["']?$/.test(spoken);
};

export const zhToEnPromptIsComplete = value => {
    const prompt = String(value || "").trim();
    return (prompt.match(/[\u3400-\u9fff]/g) || []).length >= 2;
};

export const zhToEnAnswerIsComplete = value => textQaPromptIsComplete(value)
    && !/[\u3400-\u9fff]/.test(String(value || ""));

export const grammarCuePromptIsComplete = value => {
    const prompt = String(value || "").replace(/[_＿﹍﹎]{2,}/g, " ").replace(/\s+/g, " ").trim();
    return prompt.length >= 3 && /[A-Za-z\u3400-\u9fff]/u.test(prompt);
};

export const questionPromptMode = (metadata, questionOrSortOrder) => {
    const sortOrder = typeof questionOrSortOrder === "object"
        ? Number(questionOrSortOrder?.sort_order) : Number(questionOrSortOrder);
    const modes = Array.isArray(metadata?.prompt_modes_by_sort_order)
        ? metadata.prompt_modes_by_sort_order : [];
    const mode = modes[sortOrder] || metadata?.prompt_mode || "english_qa";
    return ["english_qa", "zh_to_en", "grammar_cue"].includes(mode) ? mode : "english_qa";
};
