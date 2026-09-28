import assert from "node:assert/strict";
import test from "node:test";
import { pageQuestionMode } from "../supabase/functions/_shared/speaking-page-question-mode.ts";

test("manual page question type and prompt mode follow each question", () => {
    const metadata = { interaction_type: "mixed", question_modes: [
        { sort_order: 0, interaction_type: "text_qa", prompt_mode: "zh_to_en" },
        { sort_order: 1, interaction_type: "standard_sentence" },
        { sort_order: 2, interaction_type: "picture_gap_sentence" }
    ] };
    assert.deepEqual(pageQuestionMode(metadata, { sort_order: 0 }), { interactionType: "text_qa", promptMode: "zh_to_en" });
    assert.deepEqual(pageQuestionMode(metadata, { sort_order: 1 }), { interactionType: "standard_sentence", promptMode: null });
    assert.deepEqual(pageQuestionMode(metadata, { sort_order: 2 }), { interactionType: "picture_gap_sentence", promptMode: null });
    assert.deepEqual(pageQuestionMode({ interaction_type: "text_qa", prompt_mode: "english_qa" }, { sort_order: 0 }),
        { interactionType: "text_qa", promptMode: "english_qa" });
    assert.deepEqual(pageQuestionMode({
        interaction_type: "text_qa", prompt_mode: "mixed",
        prompt_modes_by_sort_order: ["english_qa", "grammar_cue"]
    }, { sort_order: 1 }), { interactionType: "text_qa", promptMode: "grammar_cue" });
});
