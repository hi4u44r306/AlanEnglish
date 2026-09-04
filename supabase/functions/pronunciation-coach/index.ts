import { createClient } from "npm:@supabase/supabase-js@2";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";

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
const RATE_WINDOW_MINUTES = 10;
const RATE_REQUEST_LIMIT = 12;

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

    return { durationSeconds: dataBytes / bytesPerSecond };
};

const buildAzureSpeechEndpoint = (region: string) => {
    const normalizedRegion = region.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,32}$/.test(normalizedRegion)) return "";
    const url = new URL(`https://${normalizedRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("format", "detailed");
    return url.toString();
};

const normalizeReferenceText = (value: unknown) => String(value || "")
    .replace(/[\[［][^\]］]{1,80}[\]］]/g, "")
    .replace(/\s+/g, " ").trim();

const assertPublishedQuestionAccess = async (admin: any, questionId: number) => {
    const { data, error } = await admin.from("speaking_questions")
        .select("id,question_set_id,model_answer,pronunciation_notes_zh,speaking_question_sets!inner(id,status)")
        .eq("id", questionId).eq("speaking_question_sets.status", "published").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("找不到已發布的口說題目"), { status: 404 });
    const referenceText = normalizeReferenceText(data.model_answer);
    if (!referenceText || referenceText.length > 500) {
        throw Object.assign(new Error("這題尚未設定可朗讀的完整示範回答"), { status: 422 });
    }
    return { questionId: Number(data.id), questionSetId: Number(data.question_set_id), referenceText, feedback: String(data.pronunciation_notes_zh || "") };
};

const assertRateLimit = async (admin: any, studentId: number) => {
    const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error } = await admin.from("speaking_pronunciation_attempts")
        .select("id", { count: "exact", head: true }).eq("student_id", studentId).gte("created_at", since);
    if (error) throw error;
    if ((count || 0) >= RATE_REQUEST_LIMIT) {
        throw Object.assign(new Error("短時間練習次數較多，請休息一下再繼續"), { status: 429, code: "rate_limited" });
    }
};

const normalizeAzureResult = (data: any, referenceText: string, defaultFeedback: string) => {
    const best = Array.isArray(data?.NBest) ? data.NBest[0] : null;
    const assessment = best?.PronunciationAssessment || {};
    const azureWords = Array.isArray(best?.Words) ? best.Words : [];
    const indexedWords = new Map<string, any[]>();
    for (const item of azureWords) {
        const key = normalizeWord(item?.Word);
        if (!key) continue;
        indexedWords.set(key, [...(indexedWords.get(key) || []), item]);
    }

    const words = referenceText.split(/\s+/).map(text => {
        const key = normalizeWord(text);
        const candidates = indexedWords.get(key) || [];
        const item = candidates.shift();
        indexedWords.set(key, candidates);
        const score = item ? numberScore(item?.PronunciationAssessment?.AccuracyScore) : 0;
        const errorType = String(item?.PronunciationAssessment?.ErrorType || (item ? "None" : "Omission"));
        return { text, score, status: errorType === "None" ? statusForScore(score) : "retry", error_type: errorType };
    });
    const needsPractice = words.filter(word => word.status !== "good").slice(0, 3).map(word => word.text.replace(/[.,!?]/g, ""));

    return {
        recognized_text: String(best?.Display || data?.DisplayText || ""),
        scores: {
            pronunciation: numberScore(assessment?.PronScore),
            accuracy: numberScore(assessment?.AccuracyScore),
            fluency: numberScore(assessment?.FluencyScore),
            completeness: numberScore(assessment?.CompletenessScore),
            prosody: numberScore(assessment?.ProsodyScore)
        },
        words,
        feedback: needsPractice.length > 0
            ? `先集中練習：${needsPractice.join("、")}。${defaultFeedback}`
            : `每個字都很清楚！${defaultFeedback}`
    };
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Supabase 伺服器設定不完整" });
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
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
        const question = await assertPublishedQuestionAccess(admin, questionId);
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

        const speechKey = Deno.env.get("AZURE_SPEECH_KEY");
        const speechRegion = String(Deno.env.get("AZURE_SPEECH_REGION") || "").trim();
        const endpoint = buildAzureSpeechEndpoint(speechRegion);
        if (!speechKey || !endpoint) {
            return json(503, { error: "發音評分測試服務尚未設定", code: "service_not_configured" });
        }
        await assertRateLimit(admin, Number(user.id));

        const assessmentHeader = btoa(JSON.stringify({
            ReferenceText: question.referenceText,
            GradingSystem: "HundredMark",
            Granularity: "Phoneme",
            Dimension: "Comprehensive",
            EnableMiscue: true,
            EnableProsodyAssessment: true,
            PhonemeAlphabet: "IPA"
        }));
        const providerResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
                "Ocp-Apim-Subscription-Key": speechKey,
                "Pronunciation-Assessment": assessmentHeader
            },
            body: audioBuffer
        });
        const providerResult = await providerResponse.json().catch(() => ({}));
        if (!providerResponse.ok) {
            console.error("Azure pronunciation assessment failed", providerResponse.status, providerResult?.RecognitionStatus || "unknown");
            return json(502, { error: "發音評分暫時無法完成，請稍後再試", code: "provider_failed" });
        }
        if (!providerResult?.NBest?.[0]?.PronunciationAssessment) {
            return json(422, { error: "沒有收到清楚的朗讀內容，請靠近麥克風再試一次", code: "speech_not_recognized" });
        }

        const normalized = normalizeAzureResult(providerResult, question.referenceText, question.feedback);
        const { error: saveError } = await admin.from("speaking_pronunciation_attempts").insert({
            student_id: user.id, question_set_id: question.questionSetId, question_id: question.questionId,
            pronunciation_score: normalized.scores.pronunciation, accuracy_score: normalized.scores.accuracy,
            fluency_score: normalized.scores.fluency, completeness_score: normalized.scores.completeness,
            prosody_score: normalized.scores.prosody, recognized_text: normalized.recognized_text,
            word_results: normalized.words
        });
        if (saveError) throw saveError;

        return json(200, {
            success: true,
            question_id: question.questionId,
            reference_text: question.referenceText,
            ...normalized
        });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        return json(status, { error: status < 500 ? String((error as any)?.message || "請求失敗") : "發音評分服務發生錯誤" });
    }
});
