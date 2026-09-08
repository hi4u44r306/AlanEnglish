import { createClient } from "npm:@supabase/supabase-js@2";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";
import { verifyFirebaseRequest } from "../_shared/firebase-auth.ts";
import { readAzureWordAssessment, selectAzureAssessmentResult } from "../_shared/azure-pronunciation.ts";
import { createR2PresignedUrl, fetchR2, normalizeObjectKey } from "../_shared/r2.ts";
import {
    buildSpeakingReferenceText,
    hasSpeakingAnswerSlots,
    matchesSpeakingAnswerTemplate,
    speakingAnswerPrompt
} from "../_shared/speaking-pronunciation-reference.ts";

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
const HISTORY_PAGE_SIZE = 24;

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

const assertPublishedQuestionAccess = async (admin: any, questionId: number) => {
    const { data, error } = await admin.from("speaking_questions")
        .select("id,question_set_id,model_answer,pronunciation_notes_zh,speaking_question_sets!inner(id,status)")
        .eq("id", questionId).eq("speaking_question_sets.status", "published").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("找不到已發布的口說題目"), { status: 404 });
    const answerTemplate = String(data.model_answer || "").replace(/\s+/g, " ").trim();
    const isStructuredAnswer = hasSpeakingAnswerSlots(answerTemplate);
    const referenceText = isStructuredAnswer ? "" : buildSpeakingReferenceText(answerTemplate, {});
    if (!answerTemplate || answerTemplate.length > 500) {
        throw Object.assign(new Error("這題尚未設定可朗讀的完整示範回答"), { status: 422 });
    }
    return {
        questionId: Number(data.id),
        questionSetId: Number(data.question_set_id),
        answerTemplate,
        answerPrompt: speakingAnswerPrompt(answerTemplate),
        isStructuredAnswer,
        referenceText,
        feedback: String(data.pronunciation_notes_zh || "")
    };
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

const englishWords = (value: unknown) => String(value || "")
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?/g) || [];

const loadLearningSummary = async (admin: any, studentId: number) => {
    const [{ data: progress, error: progressError }, { count: savedRecordings, error: recordingError }] = await Promise.all([
        admin.from("speaking_challenge_question_progress")
            .select("question_id").eq("student_id", studentId).eq("status", "completed"),
        admin.from("speaking_pronunciation_attempts")
            .select("id", { count: "exact", head: true }).eq("student_id", studentId)
            .not("audio_object_key", "is", null).is("audio_deleted_at", null)
    ]);
    if (progressError) throw progressError;
    if (recordingError) throw recordingError;
    const questionIds = [...new Set((progress || []).map((row: any) => Number(row.question_id)).filter(Number.isInteger))];
    if (!questionIds.length) return { learned_sentences: 0, learned_words: 0, saved_recordings: savedRecordings || 0 };

    const { data: attempts, error: attemptError } = await admin.from("speaking_pronunciation_attempts")
        .select("question_id,recognized_text,created_at,id")
        .eq("student_id", studentId).in("question_id", questionIds)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(2000);
    if (attemptError) throw attemptError;

    const latestTextByQuestion = new Map<number, string>();
    for (const row of attempts || []) {
        const questionId = Number(row.question_id);
        if (!latestTextByQuestion.has(questionId) && String(row.recognized_text || "").trim()) {
            latestTextByQuestion.set(questionId, String(row.recognized_text));
        }
    }
    const missingQuestionIds = questionIds.filter(id => !latestTextByQuestion.has(id));
    if (missingQuestionIds.length) {
        const { data: questions, error: questionError } = await admin.from("speaking_questions")
            .select("id,model_answer").in("id", missingQuestionIds);
        if (questionError) throw questionError;
        for (const question of questions || []) latestTextByQuestion.set(Number(question.id), String(question.model_answer || ""));
    }
    const words = new Set<string>();
    for (const questionId of questionIds) {
        englishWords(latestTextByQuestion.get(questionId)).forEach(word => words.add(word));
    }
    return {
        learned_sentences: questionIds.length,
        learned_words: words.size,
        saved_recordings: savedRecordings || 0
    };
};

const loadRecordingHistory = async (admin: any, studentId: number, beforeId?: number) => {
    let query = admin.from("speaking_pronunciation_attempts")
        .select("id,question_id,pronunciation_score,recognized_text,audio_duration_ms,created_at,speaking_questions(question_text),speaking_question_sets(title,books(name))")
        .eq("student_id", studentId).not("audio_object_key", "is", null).is("audio_deleted_at", null)
        .order("id", { ascending: false }).limit(HISTORY_PAGE_SIZE);
    if (Number.isInteger(beforeId) && Number(beforeId) > 0) query = query.lt("id", Number(beforeId));
    const { data, error } = await query;
    if (error) throw error;
    const recordings = (data || []).map((row: any) => ({
        id: row.id,
        question_id: row.question_id,
        pronunciation_score: numberScore(row.pronunciation_score),
        recognized_text: row.recognized_text,
        audio_duration_ms: row.audio_duration_ms,
        created_at: row.created_at,
        question_text: row.speaking_questions?.question_text || "口說練習",
        challenge_title: row.speaking_question_sets?.title || "口說大挑戰",
        book_name: row.speaking_question_sets?.books?.name || "教材"
    }));
    return {
        recordings,
        next_before_id: recordings.length === HISTORY_PAGE_SIZE ? recordings.at(-1)?.id || null : null
    };
};

const loadOwnedRecording = async (admin: any, studentId: number, attemptId: number) => {
    const { data, error } = await admin.from("speaking_pronunciation_attempts")
        .select("id,audio_object_key").eq("id", attemptId).eq("student_id", studentId)
        .not("audio_object_key", "is", null).is("audio_deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("找不到這筆私人錄音"), { status: 404 });
    return data;
};

const deleteRecording = async (admin: any, studentId: number, attemptId: number) => {
    const recording = await loadOwnedRecording(admin, studentId, attemptId);
    const objectKey = normalizeObjectKey(recording.audio_object_key);
    const deleted = await fetchR2(objectKey, { method: "DELETE" });
    if (!deleted.ok && deleted.status !== 404) throw Object.assign(new Error("私人錄音暫時無法刪除"), { status: 502 });
    const { error } = await admin.from("speaking_pronunciation_attempts").update({
        audio_object_key: null,
        audio_mime_type: null,
        audio_byte_size: null,
        audio_duration_ms: null,
        audio_saved_at: null,
        audio_deleted_at: new Date().toISOString()
    }).eq("id", attemptId).eq("student_id", studentId);
    if (error) throw error;
};

const pruneQuestionRecordings = async (admin: any, studentId: number, questionId: number) => {
    const { data, error } = await admin.from("speaking_pronunciation_attempts")
        .select("id,pronunciation_score,audio_object_key,created_at")
        .eq("student_id", studentId).eq("question_id", questionId)
        .not("audio_object_key", "is", null).is("audio_deleted_at", null)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (error) throw error;
    if ((data || []).length <= 2) return;
    const latest = data[0];
    const best = [...data].sort((left: any, right: any) => (
        Number(right.pronunciation_score || 0) - Number(left.pronunciation_score || 0)
        || Date.parse(right.created_at) - Date.parse(left.created_at)
    ))[0];
    const keep = new Set([Number(latest.id), Number(best.id)]);
    for (const row of data.filter((item: any) => !keep.has(Number(item.id)))) {
        const objectKey = normalizeObjectKey(row.audio_object_key);
        const deleted = await fetchR2(objectKey, { method: "DELETE" });
        if (!deleted.ok && deleted.status !== 404) continue;
        await admin.from("speaking_pronunciation_attempts").update({
            audio_object_key: null, audio_mime_type: null, audio_byte_size: null,
            audio_duration_ms: null, audio_saved_at: null, audio_deleted_at: new Date().toISOString()
        }).eq("id", row.id).eq("student_id", studentId);
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
    const answerMatch = question.isStructuredAnswer
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
        answer_mode: question.isStructuredAnswer ? "structured_voice" : "scripted_voice",
        answer_match: answerMatch,
        answer_prompt: question.answerPrompt,
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
            ? `請用「${question.answerPrompt}」的完整句型再回答一次。`
            : needsPractice.length > 0
                ? `先集中練習：${needsPractice.join("、")}。${question.feedback}`
                : `每個字都很清楚！${question.feedback}`
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
        if (user.role !== "student") return json(403, { error: "只有學生可以送出發音評分" });
        if (String(req.headers.get("content-type") || "").includes("application/json")) {
            const body = await req.json().catch(() => ({}));
            const action = String(body?.action || "").trim();
            if (action === "learning_summary") {
                return json(200, { success: true, summary: await loadLearningSummary(admin, Number(user.id)) });
            }
            if (action === "recording_history") {
                const beforeId = Number(body?.before_id);
                if (body?.before_id != null && (!Number.isInteger(beforeId) || beforeId <= 0)) {
                    return json(400, { error: "錄音歷程游標不正確" });
                }
                return json(200, { success: true, ...await loadRecordingHistory(admin, Number(user.id), beforeId) });
            }
            const attemptId = Number(body?.attempt_id);
            if (!Number.isInteger(attemptId) || attemptId <= 0) return json(400, { error: "錄音資料不完整" });
            if (action === "recording_url") {
                const recording = await loadOwnedRecording(admin, Number(user.id), attemptId);
                return json(200, { success: true, audio_url: await createR2PresignedUrl(recording.audio_object_key, "GET", 10 * 60) });
            }
            if (action === "delete_recording") {
                await deleteRecording(admin, Number(user.id), attemptId);
                return json(200, { success: true });
            }
            return json(400, { error: "不支援的口說學習歷程操作" });
        }
        const effectiveAccess = await loadEffectiveAccess(admin, Number(user.id));
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
        await assertRateLimit(admin, Number(user.id));

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
        if (!selectAzureAssessmentResult(providerResult)) {
            return json(providerResult?.RecognitionStatus === "Success" ? 502 : 422, speechRecognitionError(providerResult, wavInfo));
        }

        const normalized = normalizeAzureResult(providerResult, question);
        const { data: savedAttempt, error: saveError } = await admin.from("speaking_pronunciation_attempts").insert({
            student_id: user.id, question_set_id: question.questionSetId, question_id: question.questionId,
            pronunciation_score: normalized.scores.pronunciation, accuracy_score: normalized.scores.accuracy,
            fluency_score: normalized.scores.fluency, completeness_score: normalized.scores.completeness,
            prosody_score: normalized.scores.prosody, recognized_text: normalized.recognized_text,
            word_results: normalized.words
        }).select("id").single();
        if (saveError) throw saveError;

        let recordingSaved = false;
        try {
            const objectKey = normalizeObjectKey(`speaking-recordings/${user.id}/${question.questionId}/${crypto.randomUUID()}.wav`);
            const stored = await fetchR2(objectKey, {
                method: "PUT",
                headers: { "Content-Type": "audio/wav" },
                body: new Uint8Array(audioBuffer)
            });
            if (!stored.ok) throw new Error(`R2 HTTP ${stored.status}`);
            const now = new Date().toISOString();
            const { error: audioUpdateError } = await admin.from("speaking_pronunciation_attempts").update({
                audio_object_key: objectKey,
                audio_mime_type: "audio/wav",
                audio_byte_size: audio.size,
                audio_duration_ms: Math.round(wavInfo.durationSeconds * 1000),
                audio_saved_at: now,
                audio_deleted_at: null
            }).eq("id", savedAttempt.id).eq("student_id", user.id);
            if (audioUpdateError) {
                await fetchR2(objectKey, { method: "DELETE" }).catch(() => null);
                throw audioUpdateError;
            }
            recordingSaved = true;
            await pruneQuestionRecordings(admin, Number(user.id), question.questionId);
        } catch (recordingError) {
            console.error("Private speaking recording was not saved", String((recordingError as any)?.message || "unknown"));
        }

        return json(200, {
            success: true,
            attempt_id: savedAttempt.id,
            recording_saved: recordingSaved,
            question_id: question.questionId,
            reference_text: question.referenceText || null,
            ...normalized
        });
    } catch (error) {
        const status = Number((error as any)?.status || 500);
        return json(status, { error: status < 500 ? String((error as any)?.message || "請求失敗") : "發音評分服務發生錯誤" });
    }
});
