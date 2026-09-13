import { createClient } from "npm:@supabase/supabase-js@2";
import { assertBookEntitled, relationOne } from "../_shared/book-entitlement.ts";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { readAzureWordAssessment, selectAzureAssessmentResult } from "../_shared/azure-pronunciation.ts";
import {
    buildSpeakingReferenceText,
    hasSpeakingAnswerSlots,
    matchesSpeakingAnswerTemplate,
    speakingAnswerPrompt
} from "../_shared/speaking-pronunciation-reference.ts";
import {
    foundationRetryFeedback,
    matchesFoundationAnswer,
    readFoundationInteractionType
} from "../_shared/speaking-foundation-answer.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
});

const MAX_AUDIO_BYTES = 1024 * 1024;
const MIN_AUDIO_SECONDS = 0.35;
const MAX_AUDIO_SECONDS = 20;

const normalizeWord = (value: unknown) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z']/g, "");

const numberScore = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
};

const statusForScore = (score: number) => score >= 80 ? "good" : score >= 60 ? "practice" : "retry";

const readAscii = (view: DataView, offset: number, length: number) => Array.from(
    { length },
    (_, index) => String.fromCharCode(view.getUint8(offset + index))
).join("");

const inspectPcm16Wav = (buffer: ArrayBuffer) => {
    if (buffer.byteLength < 44) return null;
    const view = new DataView(buffer);
    if (
        readAscii(view, 0, 4) !== "RIFF"
        || readAscii(view, 8, 4) !== "WAVE"
        || readAscii(view, 12, 4) !== "fmt "
        || readAscii(view, 36, 4) !== "data"
    ) return null;

    const audioFormat = view.getUint16(20, true);
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    const dataBytes = view.getUint32(40, true);
    const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
    if (
        audioFormat !== 1
        || channels !== 1
        || sampleRate !== 16000
        || bitsPerSample !== 16
        || dataBytes <= 0
        || 44 + dataBytes > buffer.byteLength
        || !Number.isFinite(bytesPerSecond)
        || bytesPerSecond <= 0
    ) return null;

    const sampleCount = Math.floor(dataBytes / 2);
    let peak = 0;
    let sumSquares = 0;
    let activeSamples = 0;
    for (let index = 0; index < sampleCount; index += 1) {
        const amplitude = Math.abs(view.getInt16(44 + index * 2, true)) / 0x8000;
        peak = Math.max(peak, amplitude);
        sumSquares += amplitude * amplitude;
        if (amplitude >= 0.01) activeSamples += 1;
    }

    return {
        durationSeconds: dataBytes / bytesPerSecond,
        peak,
        rms: sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0,
        activeRatio: sampleCount > 0 ? activeSamples / sampleCount : 0
    };
};

const speechRecognitionError = (providerResult: any, wavInfo: ReturnType<typeof inspectPcm16Wav>) => {
    const status = String(providerResult?.RecognitionStatus || "");
    console.warn("Azure speech was not assessable", {
        recognitionStatus: status || "missing",
        audioSeconds: Number(wavInfo?.durationSeconds || 0).toFixed(2),
        peak: Number(wavInfo?.peak || 0).toFixed(4),
        rms: Number(wavInfo?.rms || 0).toFixed(4),
        activeRatio: Number(wavInfo?.activeRatio || 0).toFixed(4)
    });
    if (status === "InitialSilenceTimeout") {
        return { error: "錄音開頭太久沒有聲音，按下錄音後請立刻開始朗讀", code: "initial_silence" };
    }
    if (status === "BabbleTimeout") {
        return { error: "背景聲音太多，請到安靜一點的地方重新錄音", code: "background_noise" };
    }
    if (status === "NoMatch") {
        return { error: "有收到聲音，但沒有辨識到清楚的英文，請跟著示範句慢慢朗讀", code: "speech_no_match" };
    }
    if (status === "Success") {
        return { error: "已辨識到英文，但評分服務暫時沒有回傳分數；這不是你的錄音問題，請稍後再試", code: "provider_assessment_unavailable" };
    }
    return { error: "暫時無法辨識這次錄音，請重新錄音再試一次", code: "speech_not_recognized" };
};

const buildAzureSpeechEndpoint = (region: string) => {
    const normalizedRegion = region.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,32}$/.test(normalizedRegion)) return "";
    const url = new URL(`https://${normalizedRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("format", "detailed");
    return url.toString();
};

const assertPublishedQuestionAccess = async (admin: any, questionId: number, user: any, effectiveAccess: any) => {
    const { data, error } = await admin.from("speaking_questions")
        .select("id,question_set_id,speaking_question_sets!inner(id,book_id,status,generation_metadata,books(id,name,code,content_scope,enabled,archived_at))")
        .eq("id", questionId).eq("speaking_question_sets.status", "published").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("找不到已發布的口說題目"), { status: 404 });
    const questionSet = Array.isArray(data.speaking_question_sets)
        ? data.speaking_question_sets[0] : data.speaking_question_sets;
    const book = relationOne(questionSet?.books);
    await assertBookEntitled(admin, user, effectiveAccess, book);
    const { data: answerData, error: answerError } = await admin.from("speaking_questions")
        .select("model_answer,pronunciation_notes_zh").eq("id", questionId).maybeSingle();
    if (answerError) throw answerError;
    if (!answerData) throw Object.assign(new Error("找不到已發布的口說題目"), { status: 404 });
    const interactionType = readFoundationInteractionType(questionSet?.generation_metadata);
    const pictureMode = interactionType === "picture_qa" || interactionType === "picture_gap_sentence";
    const { data: pictureInteraction, error: pictureError } = pictureMode
        ? await admin.from("speaking_question_interactions")
            .select("interaction_type,prompt_text,answer_text,accepted_full_responses")
            .eq("question_id", Number(data.id)).maybeSingle()
        : { data: null, error: null };
    if (pictureError) throw pictureError;
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
        : [];
    const isStructuredAnswer = interactionType === "picture_qa" || hasSpeakingAnswerSlots(answerTemplate);
    const referenceText = isStructuredAnswer ? "" : buildSpeakingReferenceText(answerTemplate, {});
    if (!answerTemplate || answerTemplate.length > 500) {
        throw Object.assign(new Error("這題尚未設定可朗讀的完整示範回答"), { status: 422 });
    }
    return {
        questionId: Number(data.id),
        questionSetId: Number(data.question_set_id),
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

const reserveProviderRequest = async (admin: any, studentId: number, question: any) => {
    const { data, error } = await admin.rpc("reserve_speaking_pronunciation_request", {
        p_student_id: studentId,
        p_question_set_id: question.questionSetId,
        p_question_id: question.questionId,
        p_interaction_type: question.interactionType || null
    });
    if (error) throw error;
    if (data?.allowed !== true || !data?.request_id) {
        throw Object.assign(new Error("短時間練習次數較多，請休息一下再繼續"), { status: 429, code: "rate_limited" });
    }
    return String(data.request_id);
};

const finishProviderRequest = async (admin: any, requestId: string, status: string, errorCode: string | null = null) => {
    const { data, error } = await admin.from("speaking_pronunciation_requests").update({
        status,
        error_code: errorCode,
        completed_at: new Date().toISOString()
    }).eq("id", requestId).eq("status", "reserved").select("id").maybeSingle();
    if (error) throw error;
    if (!data?.id) {
        throw Object.assign(new Error("發音評分請求狀態無法完成"), {
            status: 500,
            code: "provider_request_finalize_failed"
        });
    }
};

const normalizeAzureResult = (data: any, question: Awaited<ReturnType<typeof assertPublishedQuestionAccess>>) => {
    const selected = selectAzureAssessmentResult(data);
    if (!selected) throw Object.assign(new Error("發音評分服務沒有回傳完整分數"), { status: 502, code: "provider_assessment_unavailable" });
    const { best, assessment } = selected;
    const azureWords = Array.isArray(best?.Words) ? best.Words : [];
    const recognizedText = String(best?.Display || best?.Lexical || data?.DisplayText || "").trim();
    const indexedWords = new Map<string, any[]>();
    for (const item of azureWords) {
        const key = normalizeWord(item?.Word);
        if (!key) continue;
        indexedWords.set(key, [...(indexedWords.get(key) || []), item]);
    }
    const words = question.isStructuredAnswer
        ? azureWords.map(item => {
            const text = String(item?.Word || "").trim();
            const wordAssessment = readAzureWordAssessment(item);
            const score = numberScore(wordAssessment.accuracyScore);
            const errorType = String(wordAssessment.errorType || "None");
            return { text, score, status: errorType === "None" ? statusForScore(score) : "retry", error_type: errorType };
        }).filter(item => Boolean(normalizeWord(item.text)))
        : question.referenceText.split(/\s+/).map(text => {
            const key = normalizeWord(text);
            const candidates = indexedWords.get(key) || [];
            const item = candidates.shift();
            indexedWords.set(key, candidates);
            const wordAssessment = readAzureWordAssessment(item);
            const score = item ? numberScore(wordAssessment.accuracyScore) : 0;
            const errorType = String(wordAssessment.errorType || (item ? "None" : "Omission"));
            return { text, score, status: errorType === "None" ? statusForScore(score) : "retry", error_type: errorType };
        });
    const answerMatch = question.interactionType
        ? matchesFoundationAnswer(question.interactionType, question.answerTemplate, recognizedText, question.acceptedAnswers)
        : question.isStructuredAnswer
            ? matchesSpeakingAnswerTemplate(question.answerTemplate, recognizedText)
            : true;
    const needsPractice = words.filter(word => word.status !== "good").slice(0, 3).map(word => word.text.replace(/[.,!?]/g, ""));
    const componentScores = [assessment?.AccuracyScore, assessment?.FluencyScore, assessment?.ProsodyScore]
        .map(value => Number(value))
        .filter(value => Number.isFinite(value));
    const providerPronunciation = Number(assessment?.PronScore);
    const pronunciation = Number.isFinite(providerPronunciation)
        ? numberScore(providerPronunciation)
        : numberScore(componentScores.reduce((sum, value) => sum + value, 0) / Math.max(componentScores.length, 1));

    return {
        answer_mode: question.interactionType || (question.isStructuredAnswer ? "structured_voice" : "scripted_voice"),
        answer_match: answerMatch,
        answer_prompt: question.interactionType ? null : question.answerPrompt,
        interaction_type: question.interactionType || null,
        recognized_text: recognizedText,
        scores: {
            pronunciation,
            accuracy: numberScore(assessment?.AccuracyScore),
            fluency: numberScore(assessment?.FluencyScore),
            completeness: numberScore(assessment?.CompletenessScore),
            prosody: numberScore(assessment?.ProsodyScore)
        },
        words,
        feedback: !answerMatch
            ? (question.interactionType
                ? foundationRetryFeedback(question.interactionType)
                : `請用「${question.answerPrompt}」的完整句型再回答一次。`)
            : needsPractice.length > 0
                ? `先集中練習：${needsPractice.join("、")}。${question.feedback}`
                : `每個字都很清楚！${question.feedback}`
    };
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    let admin: any = null;
    let providerRequestId: string | null = null;
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });
        admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const user = await verifyFirebaseRequest(req, admin);
        const effectiveAccess = await loadEffectiveAccess(admin, Number(user.id));
        if (user.role !== "student") return json(403, { error: "只有學生可以送出發音評分" });
        if (!effectiveAccess.is_active || !effectiveAccess.features.pronunciation) {
            return json(403, { error: "目前帳號不包含 AI 發音練習", code: "pronunciation_access_required" });
        }
        const form = await req.formData().catch(() => null);
        const questionId = Number(form?.get("question_id"));
        const audio = form?.get("audio");
        if (!Number.isInteger(questionId) || questionId <= 0) return json(400, { error: "找不到這個口說題目" });
        const question = await assertPublishedQuestionAccess(admin, questionId, user, effectiveAccess);
        if (!(audio instanceof File)) return json(400, { error: "缺少錄音資料" });
        if (audio.type !== "audio/wav") return json(415, { error: "錄音格式不正確，請重新錄音" });
        if (audio.size < 1000 || audio.size > MAX_AUDIO_BYTES) {
            return json(413, { error: "錄音太短或太長，請在 20 秒內完成朗讀" });
        }

        const audioBuffer = await audio.arrayBuffer();
        const wavInfo = inspectPcm16Wav(audioBuffer);
        if (!wavInfo) {
            return json(415, { error: "錄音必須是 16 kHz、單聲道的 PCM WAV，請重新錄音" });
        }
        if (wavInfo.durationSeconds < MIN_AUDIO_SECONDS || wavInfo.durationSeconds > MAX_AUDIO_SECONDS) {
            return json(413, { error: "錄音太短或太長，請在 20 秒內完成朗讀" });
        }
        if (wavInfo.peak < 0.002 || wavInfo.rms < 0.0002) {
            return json(422, {
                error: "送評音檔的音量太低，請靠近麥克風並重新錄音",
                code: "audio_too_quiet"
            });
        }

        const speechKey = Deno.env.get("AZURE_SPEECH_KEY");
        const speechRegion = String(Deno.env.get("AZURE_SPEECH_REGION") || "").trim();
        const endpoint = buildAzureSpeechEndpoint(speechRegion);
        if (!speechKey || !endpoint) {
            return json(503, { error: "發音評分測試服務尚未設定", code: "service_not_configured" });
        }
        providerRequestId = await reserveProviderRequest(admin, Number(user.id), question);

        const assessmentConfig: Record<string, unknown> = {
            GradingSystem: "HundredMark",
            Granularity: "Phoneme",
            Dimension: "Comprehensive",
            EnableMiscue: !question.isStructuredAnswer,
            EnableProsodyAssessment: true,
            PhonemeAlphabet: "IPA"
        };
        // A personalized answer is assessed as unscripted speech so the child can
        // say their real name without typing it first. Fixed textbook answers stay
        // scripted and keep omission/insertion checking.
        if (!question.isStructuredAnswer) assessmentConfig.ReferenceText = question.referenceText;
        const assessmentHeader = btoa(JSON.stringify(assessmentConfig));
        let providerResponse: Response;
        try {
            providerResponse = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
                    "Ocp-Apim-Subscription-Key": speechKey,
                    "Pronunciation-Assessment": assessmentHeader
                },
                body: audioBuffer
            });
        } catch {
            await finishProviderRequest(admin, providerRequestId, "provider_failed", "network_error");
            return json(502, { error: "發音評分暫時無法連線，請稍後再試", code: "provider_failed" });
        }
        const providerResult = await providerResponse.json().catch(() => ({}));
        if (!providerResponse.ok) {
            await finishProviderRequest(admin, providerRequestId, "provider_failed", `http_${providerResponse.status}`);
            console.error("Azure pronunciation assessment failed", providerResponse.status, providerResult?.RecognitionStatus || "unknown");
            return json(502, { error: "發音評分暫時無法完成，請稍後再試", code: "provider_failed" });
        }
        if (!selectAzureAssessmentResult(providerResult)) {
            await finishProviderRequest(admin, providerRequestId, "unassessable", String(providerResult?.RecognitionStatus || "missing").slice(0, 120));
            return json(providerResult?.RecognitionStatus === "Success" ? 502 : 422, speechRecognitionError(providerResult, wavInfo));
        }

        const normalized = normalizeAzureResult(providerResult, question);
        const { error: saveError } = await admin.from("speaking_pronunciation_attempts").insert({
            student_id: user.id, question_set_id: question.questionSetId, question_id: question.questionId,
            pronunciation_score: normalized.scores.pronunciation, accuracy_score: normalized.scores.accuracy,
            fluency_score: normalized.scores.fluency, completeness_score: normalized.scores.completeness,
            prosody_score: normalized.scores.prosody, recognized_text: normalized.recognized_text,
            word_results: normalized.words
        });
        if (saveError) throw saveError;
        await finishProviderRequest(admin, providerRequestId, "completed");

        return json(200, {
            success: true,
            question_id: question.questionId,
            reference_text: question.interactionType ? null : (question.referenceText || null),
            ...normalized
        });
    } catch (error) {
        if (admin && providerRequestId) {
            try {
                await finishProviderRequest(
                    admin,
                    providerRequestId,
                    "internal_failed",
                    String((error as any)?.code || "internal_error").slice(0, 120)
                );
            } catch {
                console.error("Pronunciation request ledger finalization failed");
            }
        }
        const status = Number((error as any)?.status || 500);
        return json(status, {
            error: status < 500 ? String((error as any)?.message || "請求失敗") : "發音評分服務發生錯誤",
            code: String((error as any)?.code || "") || null
        });
    }
});
