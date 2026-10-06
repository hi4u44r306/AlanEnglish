import { createClient } from "npm:@supabase/supabase-js@2";
import { assertBookEntitled, relationOne } from "../_shared/book-entitlement.ts";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { assessReadingCompleteness } from "../_shared/speaking-completeness.ts";
import {
    buildSpeakingReferenceText,
    hasSpeakingAnswerSlots,
    speakingAnswerPrompt
} from "../_shared/speaking-pronunciation-reference.ts";
import {
    readQuestionSetInteractionType,
    resolveQuestionInteractionType,
    usesUnscriptedFoundationAssessment
} from "../_shared/speaking-foundation-answer.ts";
import { runSpeakingPronunciationFlow } from "../_shared/speaking-pronunciation-flow.ts";
import { authorizeSpeakingPronunciation } from "../_shared/speaking-pronunciation-access.ts";
import { pageQuestionMode } from "../_shared/speaking-page-question-mode.ts";
import { speakingRecordingSeconds, validSpeakingAudioDuration } from "../_shared/speaking-recording-policy.ts";


const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});

const assertPublishedQuestionAccess = async (admin: any, questionId: number, user: any, effectiveAccess: any) => {
    const { data, error } = await admin.from("speaking_questions")
        .select("id,sort_order,question_set_id,speaking_question_sets!inner(id,book_id,status,version,generation_metadata,books(id,name,code,content_scope,enabled,archived_at))")
        .eq("id", questionId).eq("speaking_question_sets.status", "published").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("找不到已發布的口說題目"), { status: 404 });
    const questionSet = Array.isArray(data.speaking_question_sets)
        ? data.speaking_question_sets[0] : data.speaking_question_sets;
    const book = relationOne(questionSet?.books);
    await assertBookEntitled(admin, user, effectiveAccess, book);
    const { data: answerData, error: answerError } = await admin.from("speaking_questions")
        .select("model_answer,pronunciation_notes_zh,accepted_intents").eq("id", questionId).maybeSingle();
    if (answerError) throw answerError;
    if (!answerData) throw Object.assign(new Error("找不到已發布的口說題目"), { status: 404 });
    const questionSetInteractionType = readQuestionSetInteractionType(questionSet?.generation_metadata);
    const shouldLoadPictureInteraction = questionSetInteractionType === "mixed"
        || questionSetInteractionType === "picture_qa"
        || questionSetInteractionType === "picture_gap_sentence";
    const { data: pictureInteraction, error: pictureError } = shouldLoadPictureInteraction
        ? await admin.from("speaking_question_interactions")
            .select("interaction_type,prompt_text,answer_text,accepted_full_responses")
            .eq("question_id", Number(data.id)).maybeSingle()
        : { data: null, error: null };
    if (pictureError) throw pictureError;
    const interactionType = Array.isArray(questionSet?.generation_metadata?.question_modes)
        ? pageQuestionMode(questionSet.generation_metadata, data, pictureInteraction).interactionType
        : resolveQuestionInteractionType(questionSetInteractionType, pictureInteraction);
    const pictureMode = interactionType === "picture_qa" || interactionType === "picture_gap_sentence";
    if (pictureMode && pictureInteraction?.interaction_type !== interactionType) {
        throw Object.assign(new Error("這題的圖片口說內容尚未完成核准"), { status: 409, code: "picture_interaction_missing" });
    }
    const answerTemplate = String(pictureMode
        ? interactionType === "picture_qa"
            ? `${pictureInteraction.prompt_text} ${pictureInteraction.answer_text}`
            : pictureInteraction.answer_text
        : answerData.model_answer || "").replace(/\s+/g, " ").trim();
    const acceptedAnswers = pictureMode && Array.isArray(pictureInteraction?.accepted_full_responses)
        ? pictureInteraction.accepted_full_responses.map((value: unknown) => String(value || "").trim()).filter(Boolean).slice(0, 12)
        : interactionType === "text_qa" && Array.isArray(answerData.accepted_intents)
            ? answerData.accepted_intents.map((value: unknown) => String(value || "").trim()).filter(Boolean).slice(0, 12)
            : [];
    const isStructuredAnswer = usesUnscriptedFoundationAssessment(interactionType)
        || hasSpeakingAnswerSlots(answerTemplate);
    const referenceText = isStructuredAnswer ? "" : buildSpeakingReferenceText(answerTemplate, {});
    if (!answerTemplate || answerTemplate.length > 500) {
        throw Object.assign(new Error("這題尚未設定可朗讀的完整示範回答"), { status: 422 });
    }
    return {
        questionId: Number(data.id),
        questionSetId: Number(data.question_set_id),
        questionSetVersion: Number(questionSet?.version),
        book,
        answerTemplate,
        answerPrompt: speakingAnswerPrompt(answerTemplate),
        acceptedAnswers,
        interactionType,
        isStructuredAnswer,
        referenceText,
        feedback: String(answerData.pronunciation_notes_zh || "")
    };
};

const reserveProviderRequest = async (admin: any, studentId: number, question: any, clientSessionId: string | null) => {
 const { data, error } = await admin.rpc("reserve_speaking_local_request_v1", {
 p_student_id: studentId, p_question_set_id: question.questionSetId, p_question_id: question.questionId,
 p_interaction_type: question.interactionType || null, p_client_session_id: clientSessionId });
 if (error) throw error;
 if (data?.allowed !== true || !data?.request_id) throw Object.assign(new Error(data?.code === "speaking_daily_limit_reached"
 ? "今天已開始 10 次口說大挑戰，明天再繼續吧！" : "短時間練習次數較多，請休息一下再繼續。"), {status:429,code:data?.code || "rate_limited"});
 return {requestId:String(data.request_id),challengeUsage:data.challenge_usage || null};
};
const finishProviderRequest = async (admin: any, requestId: string, status: string, errorCode: string | null = null) => {
    let lastError: any = null;
    for (let tryIndex = 0; tryIndex < 2; tryIndex += 1) {
        const { data, error } = await admin.from("speaking_local_reading_requests").update({
            status,
            error_code: errorCode,
            completed_at: new Date().toISOString()
        }).eq("id", requestId).eq("status", "reserved").select("id").maybeSingle();
        if (data?.id) return;
        lastError = error;
        if (!error) {
            const { data: existing, error: readError } = await admin.from("speaking_local_reading_requests")
                .select("status,error_code,completed_at").eq("id", requestId).maybeSingle();
            if (!readError
                && existing?.status === status
                && String(existing?.error_code || "") === String(errorCode || "")
                && Boolean(existing?.completed_at)) return;
            lastError = readError;
        }
    }
    throw lastError || Object.assign(new Error("發音評分請求狀態無法完成"), {
        status: 500,
        code: "provider_request_finalize_failed"
    });
};

const releaseFoundationRoundClaim = async (admin: any, studentId: number, roundId: string, claimToken: string) => {
    const { data, error } = await admin.rpc("release_speaking_foundation_round_claim_v1", {
        p_student_id: studentId,
        p_round_id: roundId,
        p_claim_token: claimToken
    });
    if (error) throw error;
    return data === true;
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    let admin: any = null;
    let foundationRoundId: string | null = null;
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });
        admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const user = await verifyFirebaseRequest(req, admin);
        const { adminDemo, effectiveAccess } = await authorizeSpeakingPronunciation(
            user,
            studentId => loadEffectiveAccess(admin, studentId)
        );
        if (!req.headers.get("content-type")?.includes("application/json")) return json(409, {error:"口說已改用本機辨識，請重新整理頁面。",code:"local_client_required"});
        const rawBody = await req.text();
        if (rawBody.length > 6000) return json(413, {error:"辨識資料過長"});
        let body: any;
        try { body = JSON.parse(rawBody); } catch { return json(400, {error:"辨識資料格式不正確"}); }
        if (body?.assessment_kind !== "local_completeness_v1") return json(400, {error:"辨識版本不符，請重新整理頁面"});
        const questionId = Number(body.question_id);
        const requestedRoundId = String(body.foundation_round_id || "").trim();
        const challengeSessionId = String(body.challenge_session_id || "").trim();
        const challengeMode = String(body.challenge_mode || "easy").trim();
        if (!["easy", "challenge"].includes(challengeMode)) return json(400, { error: "口說挑戰模式無效" });
        if (!Number.isInteger(questionId) || questionId <= 0) return json(400, { error: "找不到這個口說題目" });
        if (!adminDemo && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challengeSessionId)) {
            return json(400, { error: "口說挑戰回合無效，請重新進入關卡", code: "challenge_session_required" });
        }
        const question = await assertPublishedQuestionAccess(admin, questionId, user, effectiveAccess);
        const maxAudioSeconds = speakingRecordingSeconds(question.interactionType);
        if (challengeMode === "challenge" && ["alphabet_round", "letter_spelling"].includes(question.interactionType)) {
            return json(400, { error: "A–Z 不使用挑戰模式" });
        }
        if (question.interactionType === "alphabet_round" && !adminDemo) {
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedRoundId)) {
                return json(409, { error: "請重新開始這一輪 A–Z 挑戰", code: "foundation_round_required" });
            }
            const { data: round, error: roundError } = await admin.from("speaking_foundation_rounds")
                .select("id,student_id,question_set_id,question_set_version,question_order,next_index,status,expires_at")
                .eq("id", requestedRoundId).maybeSingle();
            if (roundError) throw roundError;
            const questionOrder = Array.isArray(round?.question_order) ? round.question_order.map(Number) : [];
            const expectedQuestionId = questionOrder[Number(round?.next_index)];
            const expiresAt = Date.parse(String(round?.expires_at || ""));
            if (!round || Number(round.student_id) !== Number(user.id)
                || Number(round.question_set_id) !== question.questionSetId
                || Number(round.question_set_version) !== question.questionSetVersion
                || round.status !== "open" || !Number.isFinite(expiresAt) || expiresAt <= Date.now()
                || expectedQuestionId !== question.questionId) {
                return json(409, { error: "這一輪已失效，請從第一題重新開始", code: "foundation_round_invalid" });
            }
            foundationRoundId = String(round.id);
        } else if (requestedRoundId && !adminDemo) {
            return json(400, { error: "這個題型不接受 A–Z 挑戰回合", code: "foundation_round_not_supported" });
        }
        if (!Number.isFinite(body.audio_seconds) || !validSpeakingAudioDuration(body.audio_seconds, question.interactionType)) {
            return json(413, {error:"錄音長度須在 " + maxAudioSeconds + " 秒內",code:"audio_duration_invalid"});
        }
        // Recalculate from approved answers. Client text cannot attest real speech.
        const localResult = assessReadingCompleteness(question, body.recognized_text);
        let challengeUsage: any = null;
        const { data: revealedHint, error: hintError } = challengeMode === "challenge" && !adminDemo
            ? await admin.from("speaking_challenge_hint_reveals").select("question_id")
                .eq("student_id", Number(user.id)).eq("question_id", question.questionId)
                .eq("client_session_id", challengeSessionId).maybeSingle()
            : { data: null, error: null };
        if (hintError) throw hintError;
        const hintUsed = Boolean(revealedHint);
        const flow = await runSpeakingPronunciationFlow({
            foundationRound: !adminDemo && Boolean(foundationRoundId),
            claim: foundationRoundId ? async () => {
                const { data: claim, error: claimError } = await admin.rpc("claim_speaking_foundation_round_question_v1", {
                    p_student_id: Number(user.id),
                    p_round_id: foundationRoundId,
                    p_question_id: question.questionId
                });
                if (claimError) throw claimError;
                if (claim?.status === "busy") {
                    return { status: "busy" as const, retryAfterSeconds: Number(claim.retry_after_seconds || 1) };
                }
                if (claim?.status !== "claimed" || !claim?.claim_token) return { status: "invalid" as const };
                return { status: "claimed" as const, claimToken: String(claim.claim_token) };
            } : undefined,
            reserve: async () => {
                const reserved = await reserveProviderRequest(admin, Number(user.id), question,
                    adminDemo ? null : challengeSessionId);
                challengeUsage = reserved.challengeUsage;
                return reserved.requestId;
            },
            assess: async () => ({ ok: true as const, value: localResult }),
            saveAttempt: adminDemo ? async () => null : !foundationRoundId ? async normalized => {
                const { data: attempt, error: saveError } = await admin.from("speaking_pronunciation_attempts").insert({
                    student_id: user.id, question_set_id: question.questionSetId, question_id: question.questionId,
                    pronunciation_score: normalized.scores.pronunciation, accuracy_score: normalized.scores.accuracy,
                    fluency_score: normalized.scores.fluency, completeness_score: normalized.scores.completeness,
                    prosody_score: normalized.scores.prosody, recognized_text: normalized.recognized_text,
                    word_results: normalized.words, answer_match: normalized.answer_match,
                    challenge_mode: challengeMode,
                    client_session_id: challengeSessionId || null,
                    hint_used: hintUsed
                }).select("id").single();
                if (saveError || !attempt?.id) throw saveError || new Error("發音評分紀錄無法建立");
                return Number(attempt.id);
            } : undefined,
            saveAndRecordRound: foundationRoundId ? async (normalized, claimToken) => {
                let foundationAssessment = null;
                let roundError = null;
                for (let tryIndex = 0; tryIndex < 2; tryIndex += 1) {
                    const result = await admin.rpc("record_speaking_foundation_assessment_v2", {
                        p_student_id: Number(user.id),
                        p_round_id: foundationRoundId,
                        p_question_id: question.questionId,
                        p_claim_token: claimToken,
                        p_pronunciation_score: normalized.scores.pronunciation,
                        p_accuracy_score: normalized.scores.accuracy,
                        p_fluency_score: normalized.scores.fluency,
                        p_completeness_score: normalized.scores.completeness,
                        p_prosody_score: normalized.scores.prosody,
                        p_recognized_text: normalized.recognized_text,
                        p_word_results: normalized.words,
                        p_answer_match: normalized.answer_match
                    });
                    foundationAssessment = result.data;
                    roundError = result.error;
                    if (!roundError) break;
                }
                if (roundError) {
                    const message = String(roundError.message || "");
                    if (/FOUNDATION_(?:ROUND|SET|ASSESSMENT_REPLAY_MISMATCH)/.test(message)) {
                        throw Object.assign(new Error("這一輪已失效，請從第一題重新開始"), {
                            status: 409,
                            code: "foundation_round_invalid"
                        });
                    }
                    throw roundError;
                }
                const attemptId = Number(foundationAssessment?.attempt_id);
                if (!Number.isInteger(attemptId) || attemptId <= 0) throw new Error("發音評分紀錄無法建立");
                return { attempt: attemptId, round: foundationAssessment };
            } : undefined,
            finishRequest: (requestId, status, errorCode) => finishProviderRequest(admin, requestId, status, errorCode),
            releaseClaim: foundationRoundId
                ? claimToken => releaseFoundationRoundClaim(admin, Number(user.id), foundationRoundId!, claimToken)
                : undefined,
            warn: message => console.warn(message)
        });

        if (flow.status === "busy") {
            return json(409, {
                error: "這一題正在評分，請稍候再試",
                code: "foundation_round_busy",
                retry_after_seconds: flow.retryAfterSeconds
            });
        }
        if (flow.status === "invalid") {
            return json(409, { error: "這一輪已失效，請從第一題重新開始", code: "foundation_round_invalid" });
        }
        if (flow.status === "provider_failure") return json(500, { error: "本機朗讀結果無法處理，請稍後重試" });

        return json(200, {
            success: true,
            question_id: question.questionId,
            demo_mode: adminDemo,
            challenge_usage: challengeUsage,
            challenge_mode: challengeMode,
            hint_used: hintUsed,
            reference_text: question.interactionType ? null : (question.referenceText || null),
            foundation_round: flow.round,
            ...flow.value
        });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        return json(status, {
            error: status < 500 ? String((error as any)?.message || "請求失敗") : "朗讀結果暫時無法儲存，請稍後再試",
            code: String((error as any)?.code || "") || null
        });
    }
});
