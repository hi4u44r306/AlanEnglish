import { isReadAloudType } from "./speaking-practice-mode.ts";

const studentSpeakingGamesEnabled = () => false;

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
    if (!studentSpeakingGamesEnabled()) {
        throw Object.assign(new Error("口說遊戲正在調整中，完成測試後會重新開放"), {
            status: 423,
            code: "student_speaking_games_paused"
        });
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
    questionInteractionType,
    promptMode,
    answerAudioEnabled = false,
    staffAudioPreview = false,
    readingAudioEnabled = true,
    showEasyAnswer = false,
    progressStatus,
    modelAsset,
    promptAsset,
    pictureInteraction,
    visualAsset,
    signPrivateObject
}: any) => {
    const effectiveInteractionType = interactionType === "mixed"
        ? String(questionInteractionType || pictureInteraction?.interaction_type || "standard_sentence")
        : interactionType;
    const pictureMode = effectiveInteractionType === "picture_qa" || effectiveInteractionType === "picture_gap_sentence";
    const declaredType = interactionType === "mixed" ? questionInteractionType || pictureInteraction?.interaction_type : interactionType;
    const readingAudio = readingAudioEnabled && isReadAloudType(declaredType) && declaredType !== "alphabet_round";
    const hideChallengeAnswerAudio = (!staffAudioPreview && !readingAudio) || (effectiveInteractionType === "text_qa" && !answerAudioEnabled)
        || interactionType === "alphabet_round"
        || pictureMode;
    const modelReady = modelAsset?.status === "ready" && modelAsset?.private_object_key;
    const promptReady = promptAsset?.status === "ready" && promptAsset?.private_object_key;

    if (pictureMode && (
        pictureInteraction?.interaction_type !== effectiveInteractionType
        || visualAsset?.status !== "ready"
        || !visualAsset?.private_object_key
    )) {
        throw Object.assign(new Error("圖片口說題目尚未完成安全發布"), {
            status: 409,
            code: "picture_content_incomplete"
        });
    }

    if (effectiveInteractionType === "picture_gap_sentence" && !promptReady) {
        throw Object.assign(new Error("看圖補句的整句女聲發音尚未完成"), {
            status: 409,
            code: "picture_audio_incomplete"
        });
    }

    const foundationAnswerHidden = interactionType === "alphabet_round" || interactionType === "letter_spelling";
    const safeQuestion = pictureMode ? {
        id: question.id,
        question_text: "",
        hint_zh: showEasyAnswer ? question.hint_zh : "",
        keywords: [],
        simple_answer: showEasyAnswer ? question.simple_answer : "",
        model_answer: showEasyAnswer ? question.model_answer : "",
        follow_up_question: null,
        pronunciation_notes_zh: "",
        visual_aid: {
            kind: "private-image",
            image_url: await signPrivateObject(visualAsset.private_object_key),
            alt_zh: visualAsset.alt_zh
        },
        picture_interaction: {
            type: effectiveInteractionType,
            sentence_pattern: effectiveInteractionType === "picture_gap_sentence" ? pictureInteraction.prompt_text : null,
            ...(effectiveInteractionType === "picture_gap_sentence" ? {
                sentence_audio_status: staffAudioPreview ? "ready" : "hidden",
                sentence_audio_url: staffAudioPreview ? await signPrivateObject(promptAsset.private_object_key) : null
            } : {})
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
        interaction_type: effectiveInteractionType,
        ...(effectiveInteractionType === "text_qa" ? { prompt_mode: promptMode || "english_qa" } : {}),
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
