import { visibleSentenceWords } from "./speaking-foundation-answer.ts";

export const authorizeSpeakingChallenge = async (
    user: any,
    loadAccess: (studentId: number) => Promise<any>
) => {
    if (user?.role === "teacher" || user?.role === "admin") {
        return { demoMode: true, effectiveAccess: null };
    }
    if (user?.role !== "student") {
        throw Object.assign(new Error("目前帳號不能開啟口說大挑戰"), { status: 403 });
    }

    const effectiveAccess = await loadAccess(Number(user.id));
    if (!effectiveAccess?.is_active || !effectiveAccess?.features?.pronunciation) {
        throw Object.assign(new Error("目前方案不包含 AI 發音練習"), {
            status: 403,
            code: "pronunciation_access_required"
        });
    }
    return { demoMode: false, effectiveAccess };
};

export const buildPublicSpeakingQuestion = async ({
    question,
    interactionType,
    progressStatus,
    modelAsset,
    promptAsset,
    pictureInteraction,
    visualAsset,
    wordAudioRows = [],
    signPrivateObject
}: any) => {
    const pictureMode = interactionType === "picture_qa" || interactionType === "picture_gap_sentence";
    const hideChallengeAnswerAudio = interactionType === "letter_spelling" || pictureMode;
    const modelReady = modelAsset?.status === "ready" && modelAsset?.private_object_key;
    const promptReady = promptAsset?.status === "ready" && promptAsset?.private_object_key;

    if (pictureMode && (
        pictureInteraction?.interaction_type !== interactionType
        || visualAsset?.status !== "ready"
        || !visualAsset?.private_object_key
    )) {
        throw Object.assign(new Error("圖片口說題目尚未完成安全發布"), {
            status: 409,
            code: "picture_content_incomplete"
        });
    }

    const wordAudio = [];
    for (const row of wordAudioRows) {
        if (row.asset?.status !== "ready" || !row.asset?.private_object_key) continue;
        wordAudio.push({
            token_index: Number(row.token_index),
            word: String(row.word),
            audio_url: await signPrivateObject(row.asset.private_object_key)
        });
    }

    if (interactionType === "picture_gap_sentence") {
        const expectedWords = visibleSentenceWords(pictureInteraction.prompt_text);
        const completeWordAudio = expectedWords.length === wordAudio.length
            && expectedWords.every(expected => wordAudio.some(item => (
                item.token_index === expected.tokenIndex
                && item.word.toLowerCase() === expected.text.toLowerCase()
            )));
        if (!completeWordAudio) {
            throw Object.assign(new Error("P22 的可見單字發音尚未完整"), {
                status: 409,
                code: "word_audio_incomplete"
            });
        }
    }

    const foundationAnswerHidden = interactionType === "alphabet_round" || interactionType === "letter_spelling";
    const safeQuestion = pictureMode ? {
        id: question.id,
        question_text: "",
        hint_zh: "",
        keywords: [],
        simple_answer: "",
        model_answer: "",
        follow_up_question: null,
        pronunciation_notes_zh: "",
        visual_aid: {
            kind: "private-image",
            image_url: await signPrivateObject(visualAsset.private_object_key),
            alt_zh: visualAsset.alt_zh
        },
        picture_interaction: {
            type: interactionType,
            sentence_pattern: interactionType === "picture_gap_sentence" ? pictureInteraction.prompt_text : null,
            word_audio: interactionType === "picture_gap_sentence" ? wordAudio : []
        },
        sort_order: question.sort_order
    } : foundationAnswerHidden ? {
        ...question,
        hint_zh: "",
        keywords: [],
        simple_answer: "",
        model_answer: ""
    } : question;

    return {
        ...safeQuestion,
        progress_status: progressStatus || "opened",
        question_audio_status: hideChallengeAnswerAudio ? "hidden" : (promptReady ? "ready" : (promptAsset?.status || "missing")),
        question_audio_url: !hideChallengeAnswerAudio && promptReady
            ? await signPrivateObject(promptAsset.private_object_key)
            : null,
        model_audio_status: hideChallengeAnswerAudio ? "hidden" : (modelReady ? "ready" : (modelAsset?.status || "missing")),
        model_audio_url: !hideChallengeAnswerAudio && modelReady
            ? await signPrivateObject(modelAsset.private_object_key)
            : null
    };
};
