import { readAzureWordAssessment, selectAzureAssessmentResult } from "./azure-pronunciation.ts";
import { OPTIONAL_GRAMMAR_WORDS, POLARITY_WORDS } from "./speaking-foundation-answer.ts";
import { MEANING_SWAP_WORDS } from "./speaking-completeness.ts";

// 句子「再確認」：本機判沒過但只差一點時，用同一段錄音請 Azure 依參考句逐字評分。
// 參考句只在伺服器；回給「自己說」的內容不含答案字。
// 通過要整句發音 ≥ 60（擁有者 2026-10-22 決定）：complete_question 認 pronunciation_score（或 completeness_score）≥ 60 的那一筆。
export const SENTENCE_RECHECK_PASS_SCORE = 60;
const CORE_WORD_MIN_ACCURACY = 60;
const MEANING_WORD_MIN_ACCURACY = 80;
const TIMEOUT_MS = 15000;

const score = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
const normalized = (word: unknown) => String(word || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, "");
const isCore = (word: string) => !OPTIONAL_GRAMMAR_WORDS.has(word) && !POLARITY_WORDS.has(word);

export async function requestAzureSentenceAssessment(audio: ArrayBuffer, referenceText: string, key: string, region: string) {
    if (!key || !/^[a-z0-9-]{2,32}$/.test(region)) throw Object.assign(new Error("再確認服務尚未設定"), { status: 503, code: "service_not_configured" });
    const endpoint = new URL(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`);
    endpoint.searchParams.set("language", "en-US");
    endpoint.searchParams.set("format", "detailed");
    const config = { ReferenceText: referenceText, GradingSystem: "HundredMark", Granularity: "Word", Dimension: "Comprehensive", EnableMiscue: true, EnableProsodyAssessment: false };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch(endpoint, { method: "POST", signal: controller.signal, headers: {
            Accept: "application/json", "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            "Ocp-Apim-Subscription-Key": key, "Pronunciation-Assessment": btoa(JSON.stringify(config))
        }, body: audio });
    } catch {
        throw Object.assign(new Error("再確認暫時無法連線"), { status: 502, code: "provider_failed" });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw Object.assign(new Error("再確認暫時無法完成"), { status: 502, code: "provider_failed" });
    return await response.json().catch(() => ({}));
}

// 純函式：把 Azure 回應變成和本機評分同樣格式的結果（存進 speaking_pronunciation_attempts）。
export function evaluateAzureSentenceAssessment(payload: unknown) {
    const selected = selectAzureAssessmentResult(payload);
    if (!selected) {
        return { assessment_kind: "azure_pronunciation", assessment_status: "uncertain", evidence_source: "azure_recheck",
            answer_match: false, recognized_text: "", scores: { pronunciation: 0, accuracy: 0, fluency: 0, completeness: 0, prosody: null },
            words: [], feedback: "這次沒有聽清楚，不算你答錯，請再試一次。" };
    }
    const { best, assessment } = selected;
    const words = (Array.isArray(best.Words) ? best.Words : []).map((item: any) => {
        const detail = readAzureWordAssessment(item);
        const text = String(item?.Word || "");
        const errorType = String(detail.errorType || "None").toLowerCase();
        const accuracy = score(detail.accuracyScore);
        const word = normalized(text);
        const minimum = MEANING_SWAP_WORDS.has(word) ? MEANING_WORD_MIN_ACCURACY : isCore(word) ? CORE_WORD_MIN_ACCURACY : 0;
        const status = errorType === "omission" ? "missing" : errorType === "insertion" ? "extra" : minimum && accuracy < minimum ? "retry" : "good";
        return { text, score: accuracy, status, word };
    });
    const pronunciation = score(assessment.PronScore ?? assessment.AccuracyScore);
    const blocking = words.filter(item =>
        (item.status === "missing" && isCore(item.word))
        || (item.status === "retry")
        || (item.status === "extra" && POLARITY_WORDS.has(item.word)));
    const answerMatch = blocking.length === 0 && pronunciation >= SENTENCE_RECHECK_PASS_SCORE;
    const practice = words.filter(item => item.status === "retry" || item.status === "missing").map(item => item.text);
    return {
        assessment_kind: "azure_pronunciation", assessment_status: "assessed", evidence_source: "azure_recheck",
        answer_match: answerMatch, recognized_text: String(best.Display || best.Lexical || "").trim(),
        scores: { pronunciation, accuracy: score(assessment.AccuracyScore), fluency: score(assessment.FluencyScore), completeness: score(assessment.CompletenessScore), prosody: null },
        words: words.map(({ text, score: wordScore, status }) => ({ text, score: wordScore, status })),
        feedback: answerMatch
            ? practice.length ? `再確認後通過了！${practice.join("、")} 可以再念清楚一點。` : "再確認後通過了！"
            : practice.length ? `再確認後還差一點：${practice.join("、")} 要再念清楚。` : "再確認後還差一點，請再念一次。"
    };
}

// 回給手機的版本：「自己說」沒過時不能露出答案字（參考句裡的字、Azure 的辨識文字都可能就是答案）。
export function publicRecheckResult(result: ReturnType<typeof evaluateAzureSentenceAssessment>, challengeMode: string, localText: string) {
    if (challengeMode !== "challenge" || result.answer_match) return result;
    const count = result.words.filter(item => item.status === "retry" || item.status === "missing").length;
    return { ...result, recognized_text: localText, words: [],
        feedback: count ? `再確認後還差一點：有 ${count} 個字要再念清楚。` : "再確認後還差一點，請再念一次。" };
}
