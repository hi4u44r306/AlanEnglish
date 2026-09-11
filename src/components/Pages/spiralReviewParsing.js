export const normalizeGeneratedCards = cards => (Array.isArray(cards) ? cards : [])
    .map(card => ({
        card_type: card?.card_type === "sentence" ? "sentence" : "word",
        prompt_en: String(card?.prompt_en || "").trim(),
        meaning_zh: String(card?.meaning_zh || "").trim(),
        example_sentence: String(card?.example_sentence || "").trim()
    }))
    .filter(card => card.prompt_en && !/_{2,}|\[\s*\]|\(\s*\)|（\s*）/.test(card.prompt_en));
