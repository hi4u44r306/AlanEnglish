import { test } from "node:test";
import assert from "node:assert/strict";
import {
    authorizeSpeakingChallenge,
    buildPublicSpeakingQuestion
} from "../supabase/functions/_shared/speaking-challenge-view.ts";

const activeAccess = {
    is_active: true,
    features: { pronunciation: true }
};

test("學生角色與發音資格在任何題目操作前 fail closed", async () => {
    let loadCalls = 0;
    const loadAccess = async studentId => {
        loadCalls += 1;
        assert.equal(studentId, 7);
        return activeAccess;
    };

    assert.deepEqual(
        await authorizeSpeakingChallenge({ id: 1, role: "teacher" }, loadAccess),
        { demoMode: true, effectiveAccess: null }
    );
    assert.deepEqual(
        await authorizeSpeakingChallenge({ id: 2, role: "admin" }, loadAccess),
        { demoMode: true, effectiveAccess: null }
    );
    assert.equal(loadCalls, 0);

    await assert.rejects(
        authorizeSpeakingChallenge({ id: 3, role: "guardian" }, loadAccess),
        error => error.status === 403 && error.code === undefined
    );
    assert.equal(loadCalls, 0);

    const inactive = async () => ({ is_active: false, features: { pronunciation: true } });
    await assert.rejects(
        authorizeSpeakingChallenge({ id: 7, role: "student" }, inactive),
        error => error.status === 403 && error.code === "pronunciation_access_required"
    );
    const noPronunciation = async () => ({ is_active: true, features: { pronunciation: false } });
    await assert.rejects(
        authorizeSpeakingChallenge({ id: 7, role: "student" }, noPronunciation),
        error => error.status === 403 && error.code === "pronunciation_access_required"
    );

    assert.deepEqual(
        await authorizeSpeakingChallenge({ id: 7, role: "student" }, loadAccess),
        { demoMode: false, effectiveAccess: activeAccess }
    );
    assert.equal(loadCalls, 1);
});

const secretQuestion = {
    id: 2101,
    sort_order: 2,
    question_text: "SECRET QUESTION",
    hint_zh: "SECRET HINT",
    keywords: ["SECRET KEYWORD"],
    simple_answer: "SECRET SIMPLE ANSWER",
    model_answer: "SECRET MODEL ANSWER",
    follow_up_question: "SECRET FOLLOW UP",
    pronunciation_notes_zh: "SECRET NOTES"
};

const createOpaqueSigner = () => {
    const keys = [];
    const sign = async key => {
        keys.push(key);
        return `https://signed.test/${keys.length}`;
    };
    return { keys, sign };
};

test("P21 學生輸出只保留核准圖片，不含問句、答案、accepted responses 或 R2 key", async () => {
    const signer = createOpaqueSigner();
    const result = await buildPublicSpeakingQuestion({
        question: secretQuestion,
        interactionType: "picture_qa",
        progressStatus: "opened",
        pictureInteraction: {
            interaction_type: "picture_qa",
            prompt_text: "SECRET FULL QUESTION",
            answer_text: "SECRET FULL ANSWER",
            accepted_full_responses: ["SECRET ACCEPTED ANSWER"]
        },
        visualAsset: {
            status: "ready",
            private_object_key: "private/secret-p21.webp",
            alt_zh: "課本核准插圖"
        },
        signPrivateObject: signer.sign
    });

    assert.deepEqual(result, {
        id: 2101,
        question_text: "",
        hint_zh: "",
        keywords: [],
        simple_answer: "",
        model_answer: "",
        follow_up_question: null,
        pronunciation_notes_zh: "",
        visual_aid: {
            kind: "private-image",
            image_url: "https://signed.test/1",
            alt_zh: "課本核准插圖"
        },
        picture_interaction: {
            type: "picture_qa",
            sentence_pattern: null
        },
        sort_order: 2,
        interaction_type: "picture_qa",
        progress_status: "opened",
        question_audio_status: "hidden",
        question_audio_url: null,
        model_audio_status: "hidden",
        model_audio_url: null
    });
    assert.deepEqual(signer.keys, ["private/secret-p21.webp"]);
    assert.doesNotMatch(
        JSON.stringify(result),
        /SECRET|accepted_full_responses|private_object_key|private\/secret-p21/
    );
});

test("P22 只保留挖空句型、核准圖片與停頓整句短效網址", async () => {
    const signer = createOpaqueSigner();
    const result = await buildPublicSpeakingQuestion({
        question: { ...secretQuestion, id: 2201 },
        interactionType: "picture_gap_sentence",
        progressStatus: "completed",
        pictureInteraction: {
            interaction_type: "picture_gap_sentence",
            prompt_text: "The ____ is in the tree.",
            answer_text: "The apple is in the tree.",
            accepted_full_responses: ["The apple is in the tree"]
        },
        visualAsset: {
            status: "ready",
            private_object_key: "private/secret-p22.webp",
            alt_zh: "樹上的蘋果"
        },
        promptAsset: { status: "ready", private_object_key: "private/p22-sentence.wav" },
        signPrivateObject: signer.sign
    });

    assert.equal(result.picture_interaction.sentence_pattern, "The ____ is in the tree.");
    assert.equal("word_audio" in result.picture_interaction, false);
    assert.equal(result.picture_interaction.sentence_audio_status, "ready");
    assert.equal(result.picture_interaction.sentence_audio_url, "https://signed.test/2");
    assert.equal(result.visual_aid.image_url, "https://signed.test/1");
    assert.equal(result.progress_status, "completed");
    assert.equal(result.model_answer, "");
    assert.equal(result.simple_answer, "");
    assert.doesNotMatch(
        JSON.stringify(result),
        /SECRET|The apple is in the tree|accepted_full_responses|private_object_key|private\/secret-p22/
    );
});

test("逐頁 mixed 題庫仍依每題核准 interaction 顯示看圖補句", async () => {
    const signer = createOpaqueSigner();
    const result = await buildPublicSpeakingQuestion({
        question: { ...secretQuestion, id: 3701 },
        interactionType: "mixed",
        pictureInteraction: {
            interaction_type: "picture_gap_sentence",
            prompt_text: "It is ____.",
            answer_text: "It is an eye."
        },
        visualAsset: {
            status: "ready",
            private_object_key: "private/p4-eye.webp",
            alt_zh: "眼睛"
        },
        promptAsset: { status: "ready", private_object_key: "private/p4-eye-sentence.wav" },
        signPrivateObject: signer.sign
    });

    assert.equal(result.interaction_type, "picture_gap_sentence");
    assert.equal(result.picture_interaction.type, "picture_gap_sentence");
    assert.equal(result.picture_interaction.sentence_pattern, "It is ____.");
    assert.equal(result.visual_aid.image_url, "https://signed.test/1");
    assert.equal(result.picture_interaction.sentence_audio_url, "https://signed.test/2");
    assert.equal(result.question_audio_status, "hidden");
    assert.deepEqual(signer.keys, ["private/p4-eye.webp", "private/p4-eye-sentence.wav"]);
});

test("P21 圖片未 ready 與 P22 整句音檔未完成時拒絕輸出", async () => {
    await assert.rejects(
        buildPublicSpeakingQuestion({
            question: secretQuestion,
            interactionType: "picture_qa",
            pictureInteraction: { interaction_type: "picture_qa" },
            visualAsset: { status: "processing", private_object_key: "private/p21.webp" },
            signPrivateObject: async () => "https://signed.test/image"
        }),
        error => error.status === 409 && error.code === "picture_content_incomplete"
    );

    await assert.rejects(
        buildPublicSpeakingQuestion({
            question: secretQuestion,
            interactionType: "picture_gap_sentence",
            pictureInteraction: {
                interaction_type: "picture_gap_sentence",
                prompt_text: "The ____ is in the tree."
            },
            visualAsset: { status: "ready", private_object_key: "private/p22.webp" },
            signPrivateObject: async () => "https://signed.test/audio"
        }),
        error => error.status === 409 && error.code === "picture_audio_incomplete"
    );
});

test("字母、拼讀與一般口說維持原本答案及音檔顯示邊界", async () => {
    const hiddenSigner = createOpaqueSigner();
    const alphabet = await buildPublicSpeakingQuestion({
        question: { ...secretQuestion, question_text: "A", model_answer: "A" },
        interactionType: "alphabet_round",
        modelAsset: { status: "ready", private_object_key: "private/a-model.mp3" },
        promptAsset: { status: "ready", private_object_key: "private/a-prompt.mp3" },
        signPrivateObject: hiddenSigner.sign
    });
    assert.equal(alphabet.question_text, "A");
    assert.equal(alphabet.model_answer, "");
    assert.equal(alphabet.question_audio_status, "hidden");
    assert.equal(alphabet.model_audio_status, "hidden");
    assert.equal(alphabet.question_audio_url, null);
    assert.equal(alphabet.model_audio_url, null);
    assert.deepEqual(hiddenSigner.keys, []);

    const spellingSigner = createOpaqueSigner();
    const spelling = await buildPublicSpeakingQuestion({
        question: { ...secretQuestion, question_text: "apple", model_answer: "A P P L E" },
        interactionType: "letter_spelling",
        modelAsset: { status: "ready", private_object_key: "private/apple-model.mp3" },
        promptAsset: { status: "ready", private_object_key: "private/apple-prompt.mp3" },
        signPrivateObject: spellingSigner.sign
    });
    assert.equal(spelling.question_text, "apple");
    assert.equal(spelling.model_answer, "");
    assert.equal(spelling.question_audio_status, "hidden");
    assert.equal(spelling.model_audio_status, "hidden");
    assert.deepEqual(spellingSigner.keys, []);

    const regularSigner = createOpaqueSigner();
    const regular = await buildPublicSpeakingQuestion({
        question: { ...secretQuestion, id: 9001 },
        interactionType: "",
        progressStatus: "opened",
        modelAsset: { status: "ready", private_object_key: "private/model.mp3" },
        promptAsset: { status: "ready", private_object_key: "private/prompt.mp3" },
        signPrivateObject: regularSigner.sign
    });
    assert.equal(regular.model_answer, "SECRET MODEL ANSWER");
    assert.equal(regular.question_audio_url, "https://signed.test/1");
    assert.equal(regular.model_audio_url, "https://signed.test/2");
    assert.deepEqual(regularSigner.keys, ["private/prompt.mp3", "private/model.mp3"]);
});

test("無圖片文字問答以文字問句呈現，不要求圖片互動資料", async () => {
    const signer = createOpaqueSigner();
    const result = await buildPublicSpeakingQuestion({
        question: {
            id: 4201, sort_order: 0, question_text: "What is seven minus two?",
            hint_zh: "請用完整句回答。", simple_answer: "Seven minus two is five.",
            model_answer: "Seven minus two is five."
        },
        interactionType: "text_qa",
        progressStatus: "opened",
        modelAsset: { status: "ready", private_object_key: "private/math-answer.wav" },
        promptAsset: null,
        pictureInteraction: null,
        visualAsset: null,
        signPrivateObject: signer.sign
    });
    assert.equal(result.interaction_type, "text_qa");
    assert.equal(result.question_text, "What is seven minus two?");
    assert.equal(result.picture_interaction, undefined);
    assert.equal(result.visual_aid, undefined);
    assert.equal(result.model_audio_status, "ready");
    assert.deepEqual(signer.keys, ["private/math-answer.wav"]);
});
