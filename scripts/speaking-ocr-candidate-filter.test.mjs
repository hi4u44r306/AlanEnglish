import assert from "node:assert/strict";
import test from "node:test";
import {
    extractNumberedTextQaPairs,
    filterOcrPageSpeakingCandidates
} from "../supabase/functions/_shared/speaking-ocr-candidate-filter.ts";
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
        question_text: "How old is your dad?",
        model_answer: "He is forty years old.",
        accepted_intents: []
    }), true);
    assert.equal(textQaQuestionContentValid({
        question_text: "What's your mother's name?",
        model_answer: "His name is Sam.",
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
    assert.equal(textQaQuestionContentValid({
        question_text: "Do you have brothers or sisters?",
        model_answer: "No, I'm the only child.",
        accepted_intents: ["Yes, I have a brother and a sister."]
    }), true);
});

test("pairs reviewed Workbook 3 numbered text questions without guessing blank answers", () => {
    const page5 = extractNumberedTextQaPairs(`Personal questions
1. Who are you?
I am ________, your _________.
2. What is your name?
My name is _________.
3. Are you happy with your name? You like it or hate it?
Yes, I like it. Why do you ask?
6. Do you have a nickname?
________ / Sweet potato / No, I don't have a nickname.
7. Do you want to change your name? What would it be?
No, I like my name. / Yes, I like the name "_________."`);
    assert.deepEqual(page5, [
        { question_text: "Are you happy with your name?", model_answer: "Yes, I like it.", accepted_answers: [] },
        { question_text: "Do you have a nickname?", model_answer: "No, I don't have a nickname.", accepted_answers: [] },
        { question_text: "Do you want to change your name?", model_answer: "No, I like my name.", accepted_answers: [] }
    ]);

    const page7 = extractNumberedTextQaPairs(`Personal questions
8. Are you a boy/girl?
Can't you tell? Of course, I am a boy/ girl.
9. Are you a fool?
No, I am a genius.
10. Hey, are you with me?
Yes, I am listening.
11. What's your father's name?
He is ______ / His name is ________.
12. What's your mother's name?
She is ______ / Her name is ________.
13. Do you love them?
Yes, I do. For sure.
14. How old are you? What age are you?
I am _____ years old. How about you?`);
    assert.deepEqual(page7, [
        { question_text: "Are you a boy/girl?", model_answer: "Of course, I am a boy.", accepted_answers: ["Of course, I am a girl."] },
        { question_text: "Are you a fool?", model_answer: "No, I am a genius.", accepted_answers: [] },
        { question_text: "Hey, are you with me?", model_answer: "Yes, I am listening.", accepted_answers: [] },
        { question_text: "Do you love them?", model_answer: "Yes, I do.", accepted_answers: ["For sure."] }
    ]);

    const page9 = extractNumberedTextQaPairs(`Personal questions
15. How old is your dad?
He is _____ years old. How about yours?
16. How old is your mom?
She is _____ years old. How about yours?
17. What's your grandfather's name? And what age? Do you like him?
He's _____. _____ years old. I always love him.
18. What's your grandmother's name? And what age? Do you like her?
She's _____. _____ years old. I always love her.
19. Do you have brothers or sisters?
No, I'm the only child. / Yes, I have a brother and a sister.
20. What's your brother's name? Do you love him?
His name is _____. I don't love him, sometimes.
21. What's your sister's name? Do you love her?
Her name is _____. I love her, sometimes.`);
    assert.deepEqual(page9, [{
        question_text: "Do you have brothers or sisters?",
        model_answer: "No, I'm the only child.",
        accepted_answers: ["Yes, I have a brother and a sister."]
    }]);
});
