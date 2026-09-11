export const parseReviewCards = value => String(value || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
        const [prompt, meaning, example] = line.split(/\s*[|｜\t]\s*/);
        return {
            card_type: String(prompt || "").trim().includes(" ") ? "sentence" : "word",
            prompt_en: String(prompt || "").trim(),
            meaning_zh: String(meaning || "").trim(),
            example_sentence: String(example || "").trim()
        };
    })
    .filter(card => card.prompt_en);
