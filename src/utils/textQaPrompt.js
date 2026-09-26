// Chinese learner clues may appear anywhere in the displayed question. Only
// the English part has to form a punctuated prompt for speaking practice.
export const textQaPromptIsComplete = value => {
    const spoken = String(value || "").replace(/？/g, "?")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/[()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
    return /[A-Za-z]/.test(spoken) && /[.!?]["']?$/.test(spoken);
};
