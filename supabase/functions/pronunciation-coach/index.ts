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

const LESSONS: Record<string, { referenceText: string; feedback: string }> = {
    "greeting-good-morning": {
        referenceText: "Good morning. How are you?",
        feedback: "Good 和 morning 要說清楚，再注意問句最後的語調。"
    },
    "greeting-introduction": {
        referenceText: "Hello. My name is Amy.",
        feedback: "試著把 My name is 自然地連在一起說。"
    },
    "greeting-feeling": {
        referenceText: "I am great today. Thank you.",
        feedback: "great 的 r 音可以慢一點，Thank 的 th 音要讓舌尖輕碰牙齒。"
    },
    "greeting-new-friend": {
        referenceText: "It is nice to meet you.",
        feedback: "nice 和 meet 是重點字，句尾可以自然放慢。"
    }
};

const MAX_AUDIO_BYTES = 700 * 1024;
const MIN_AUDIO_SECONDS = 0.35;
const MAX_AUDIO_SECONDS = 15;
const PILOT_WINDOW_MS = 10 * 60 * 1000;
const PILOT_REQUEST_LIMIT = 12;
const requestWindows = new Map<number, number[]>();

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

const checkPilotRateLimit = (studentId: number) => {
    const now = Date.now();
    const active = (requestWindows.get(studentId) || []).filter(timestamp => now - timestamp < PILOT_WINDOW_MS);
    if (active.length >= PILOT_REQUEST_LIMIT) return false;
    active.push(now);
    requestWindows.set(studentId, active);
    return true;
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
        const isStaff = user.role === "teacher" || user.role === "admin";
        if (!isStaff && (!effectiveAccess.is_active || !effectiveAccess.features.pronunciation)) {
            return json(403, { error: "目前帳號不包含 AI 發音教練", code: "pronunciation_access_required" });
        }
        const form = await req.formData().catch(() => null);
        const lessonId = String(form?.get("lesson_id") || "").trim();
        const lesson = LESSONS[lessonId];
        const audio = form?.get("audio");
        if (!lesson) return json(400, { error: "找不到這個發音關卡" });
        if (!(audio instanceof File)) return json(400, { error: "缺少錄音資料" });
        if (audio.type !== "audio/wav") return json(415, { error: "錄音格式不正確，請重新錄音" });
        if (audio.size < 1000 || audio.size > MAX_AUDIO_BYTES) {
            return json(413, { error: "錄音太短或太長，請在 12 秒內完成朗讀" });
        }

        const audioBuffer = await audio.arrayBuffer();
        const wavInfo = inspectPcm16Wav(audioBuffer);
        if (!wavInfo) {
            return json(415, { error: "錄音必須是 16 kHz、單聲道的 PCM WAV，請重新錄音" });
        }
        if (wavInfo.durationSeconds < MIN_AUDIO_SECONDS || wavInfo.durationSeconds > MAX_AUDIO_SECONDS) {
            return json(413, { error: "錄音太短或太長，請在 12 秒內完成朗讀" });
        }

        const speechKey = Deno.env.get("AZURE_SPEECH_KEY");
        const speechRegion = String(Deno.env.get("AZURE_SPEECH_REGION") || "").trim();
        const endpoint = buildAzureSpeechEndpoint(speechRegion);
        if (!speechKey || !endpoint) {
            return json(503, { error: "發音評分測試服務尚未設定", code: "service_not_configured" });
        }
        if (!checkPilotRateLimit(Number(user.id))) {
            return json(429, { error: "短時間練習次數較多，請休息一下再繼續", code: "pilot_rate_limited" });
        }

        const assessmentHeader = btoa(JSON.stringify({
            ReferenceText: lesson.referenceText,
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

        return json(200, {
            success: true,
            lesson_id: lessonId,
            reference_text: lesson.referenceText,
            ...normalizeAzureResult(providerResult, lesson.referenceText, lesson.feedback)
        });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        return json(status, { error: status < 500 ? String((error as any)?.message || "請求失敗") : "發音評分服務發生錯誤" });
    }
});
