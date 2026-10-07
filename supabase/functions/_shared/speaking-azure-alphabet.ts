import { selectAzureAssessmentResult, readAzureWordAssessment } from "./azure-pronunciation.ts";
import { matchesFoundationAnswer, evaluateLetterSpellingAssessment } from "./speaking-foundation-answer.ts";

const score = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
export async function assessAzureAlphabet(audio: ArrayBuffer, answer: string, key: string, region: string, interactionType = "alphabet_round") {
    if (!key || !/^[a-z0-9-]{2,32}$/.test(region)) throw Object.assign(new Error("A–Z 評分服務尚未設定"), { status: 503, code: "service_not_configured" });
    const endpoint = new URL(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`);
    endpoint.searchParams.set("language", "en-US"); endpoint.searchParams.set("format", "detailed");
    // Preserve the existing scripted letter assessment, without the prosody add-on.
    const reference = interactionType === "letter_spelling" ? answer.toUpperCase().replace(/[^A-Z]/g, "").split("").join(" ") : answer;
    const config = { ReferenceText: reference, GradingSystem: "HundredMark", Granularity: "Phoneme", Dimension: "Comprehensive", EnableMiscue: true, EnableProsodyAssessment: false, PhonemeAlphabet: "IPA" };
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 75000);
    let response: Response;
    try {
        response = await fetch(endpoint, { method: "POST", signal: controller.signal, headers: {
            Accept: "application/json", "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            "Ocp-Apim-Subscription-Key": key, "Pronunciation-Assessment": btoa(JSON.stringify(config))
        }, body: audio });
    } catch {
        throw Object.assign(new Error("A–Z 評分暫時無法連線，錄音仍保留，請重試"), { status: 502, code: "provider_failed" });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw Object.assign(new Error(response.status === 429 ? "A–Z 評分忙碌，請稍候再試" : "A–Z 評分暫時無法完成，請重試"), { status: 502, code: "provider_failed" });
    const selected = selectAzureAssessmentResult(await response.json().catch(() => ({})));
    if (!selected) throw Object.assign(new Error("沒有聽清楚字母，請重錄"), { status: 422, code: "speech_no_match" });
    const { best, assessment } = selected;
    if ([assessment.PronScore ?? assessment.AccuracyScore, assessment.AccuracyScore, assessment.FluencyScore]
        .some(value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)))) {
        throw Object.assign(new Error("A–Z 評分服務沒有回傳完整分數，請稍候重試"), { status: 502, code: "provider_failed" });
    }
    const text = String(best.Display || best.Lexical || "").trim();
    if (!text) throw Object.assign(new Error("沒有聽清楚字母，請重錄"), { status: 422, code: "speech_no_match" });
    const spelling = interactionType === "letter_spelling" ? evaluateLetterSpellingAssessment(answer, text, best.Words) : null;
    const matched = (spelling ? spelling.answerMatch : matchesFoundationAnswer("alphabet_round", answer, text, [])) && score(assessment.PronScore ?? assessment.AccuracyScore) >= 70;
    return { assessment_kind: "azure_pronunciation", assessment_status: spelling?.uncertain ? "uncertain" : "assessed", answer_match: matched, recognized_text: text,
        scores: { pronunciation: score(assessment.PronScore ?? assessment.AccuracyScore), accuracy: score(assessment.AccuracyScore),
            fluency: score(assessment.FluencyScore), completeness: matched ? 100 : 0, prosody: null },
        words: (Array.isArray(best.Words) ? best.Words : []).map((word: any) => ({ text: String(word.Word || ""),
            score: score(readAzureWordAssessment(word).accuracyScore), status: matched ? "good" : "practice" })),
        feedback: matched ? "字母回答正確！" : "再聽一次示範，把字母說清楚；辨識也可能聽錯。" };
}
