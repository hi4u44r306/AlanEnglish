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
