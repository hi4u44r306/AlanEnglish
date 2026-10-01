import { isReadAloudType, usesSinglePracticeMode } from "./speakingPracticeMode";

it.each(["alphabet_round", "letter_spelling", "standard_sentence"])("%s uses one practice mode", interaction_type => {
    expect(isReadAloudType(interaction_type)).toBe(true);
    expect(usesSinglePracticeMode({ generation_metadata: { interaction_type } })).toBe(true);
});
it.each(["text_qa", "picture_qa", "picture_gap_sentence", "", "unknown"])("%s keeps answer modes", interaction_type => {
    expect(usesSinglePracticeMode({ generation_metadata: { interaction_type } })).toBe(false);
});
it("mixed pages require complete reviewed types, with no answering questions", () => {
    const item = { question_count: 2, generation_metadata: { interaction_type: "mixed", question_modes: [
        { sort_order: 0, interaction_type: "standard_sentence" }, { sort_order: 1, interaction_type: "standard_sentence" }
    ] } };
    expect(usesSinglePracticeMode(item)).toBe(true);
    expect(usesSinglePracticeMode({ ...item, question_count: 3 })).toBe(false);
    item.generation_metadata.question_modes[1].interaction_type = "text_qa";
    expect(usesSinglePracticeMode(item)).toBe(false);
    item.generation_metadata.question_modes[1] = { sort_order: 0, interaction_type: "standard_sentence" };
    expect(usesSinglePracticeMode(item)).toBe(false);
});
