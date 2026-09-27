import { pageQuestionMode } from "./speakingPageQuestionMode";

describe("pageQuestionMode", () => {
    it("keeps each text question's prompt mode in a mixed page", () => {
        const metadata = { interaction_type: "mixed", question_modes: [
            { sort_order: 0, interaction_type: "text_qa", prompt_mode: "zh_to_en" },
            { sort_order: 1, interaction_type: "text_qa", prompt_mode: "english_qa" },
            { sort_order: 2, interaction_type: "standard_sentence" }
        ] };
        expect(pageQuestionMode(metadata, { sort_order: 0 })).toEqual({ interactionType: "text_qa", promptMode: "zh_to_en" });
        expect(pageQuestionMode(metadata, { sort_order: 1 })).toEqual({ interactionType: "text_qa", promptMode: "english_qa" });
        expect(pageQuestionMode(metadata, { sort_order: 2 })).toEqual({ interactionType: "standard_sentence", promptMode: null });
    });

    it("preserves older picture and single-mode drafts", () => {
        expect(pageQuestionMode({ interaction_type: "mixed" }, {
            sort_order: 0, speaking_question_interactions: [{ interaction_type: "picture_gap_sentence" }]
        }).interactionType).toBe("picture_gap_sentence");
        expect(pageQuestionMode({ interaction_type: "text_qa", prompt_mode: "zh_to_en" }, { sort_order: 0 }))
            .toEqual({ interactionType: "text_qa", promptMode: "zh_to_en" });
    });
});
