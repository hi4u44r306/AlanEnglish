import assert from "node:assert/strict";
import test from "node:test";
import { filterOcrPageSpeakingCandidates } from "../supabase/functions/_shared/speaking-ocr-candidate-filter.ts";
import { textQaQuestionContentValid } from "../supabase/functions/_shared/speaking-text-qa.ts";

test("keeps only complete, speakable English sentences for automatic OCR candidates", () => {
    const result = filterOcrPageSpeakingCandidates(`Workbook 3
Page 4
1. It is an eye.（一隻）
Look at the picture.
__________
| | | | |
They are her eyes.
A. This is my book!
www.alanenglish.com.tw`);

    assert.deepEqual(result.sentences, ["It is an eye.", "They are her eyes.", "This is my book!"]);
    assert.equal(result.sourceText, "It is an eye.\nThey are her eyes.\nThis is my book!");
    assert.ok(result.discardedSegments >= 5);
});

test("does not turn incomplete exercises or directions into automatic speaking questions", () => {
    const result = filterOcrPageSpeakingCandidates(`P12
Read and circle.
It is ____.
Name: __________
1 2 3 4`);

    assert.deepEqual(result.sentences, []);
    assert.ok(result.discardedSegments >= 4);
});

test("expands printed he/she and his/her choices into consistent complete sentences", () => {
    const result = filterOcrPageSpeakingCandidates(`Who is the student?
He/She is my friend. His/Her name is Sam.
They are his/her eyes.`);

    assert.deepEqual(result.sentences, [
        "Who is the student?",
        "He is my friend.",
        "She is my friend.",
        "His name is Sam.",
        "Her name is Sam.",
        "They are his eyes.",
        "They are her eyes."
    ]);
    assert.equal(result.sentences.includes("He is my friend. Her name is Sam."), false);
});

test("keeps reviewed red text as a hint without turning the fragment into an answer", () => {
    const result = filterOcrPageSpeakingCandidates(`Whose book is it?
It is his/her book.
[[RED_ANSWER: his/her]]`);

    assert.deepEqual(result.sentences, [
        "Whose book is it?",
        "It is his book.",
        "It is her book."
    ]);
    assert.deepEqual(result.redAnswerHints, ["his/her"]);
    assert.equal(result.sentences.includes("his/her"), false);
});

test("requires opposite consistent alternatives only when a text question does not specify gender", () => {
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is your friend?",
        model_answer: "He is my friend.",
        accepted_intents: ["She is my friend."]
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is your friend?",
        model_answer: "He is my friend.",
        accepted_intents: []
    }), false);
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is he?",
        model_answer: "He is my friend.",
        accepted_intents: []
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is he?",
        model_answer: "He is my friend.",
        accepted_intents: ["She is my friend."]
    }), false);
    assert.equal(textQaQuestionContentValid({
        question_text: "Who is he?",
        model_answer: "This is my friend.",
        accepted_intents: []
    }), false);
    assert.equal(textQaQuestionContentValid({
        question_text: "Whose eyes are these?",
        model_answer: "They are his eyes.",
        accepted_intents: ["They are her eyes."]
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "Whose eyes are these?",
        model_answer: "He has her eyes.",
        accepted_intents: ["She has his eyes."]
    }), false);
});
