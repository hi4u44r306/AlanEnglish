import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

export const submitAlphabetPronunciationAttempt = async ({ firebaseUser, questionId, audio, foundationRoundId = "", challengeSessionId = "" }) => {
    if (!firebaseUser || !(audio instanceof Blob) || !Number.isInteger(Number(questionId)) || Number(questionId) <= 0) throw new Error("字母錄音資料不完整");
    const form = new FormData();
    form.append("assessment_kind", "azure_alphabet_v1"); form.append("question_id", String(questionId));
    form.append("foundation_round_id", foundationRoundId); form.append("challenge_session_id", challengeSessionId);
    form.append("challenge_mode", "easy"); form.append("audio", audio, "alphabet.wav");
    const response = await fetch(`${supabaseUrl}/functions/v1/pronunciation-coach`, { method: "POST",
        headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}`, apikey: supabaseKey }, body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || "字母評分暫時無法完成"), { code: result.code, status: response.status });
    return result;
};

export const submitPronunciationAttempt = async ({ firebaseUser, lessonId, audio }) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");
    if (!lessonId || !(audio instanceof Blob)) throw new Error("錄音資料不完整，請重新錄音");

    const firebaseToken = await firebaseUser.getIdToken();
    const form = new FormData();
    form.append("lesson_id", lessonId);
    form.append("audio", audio, `${lessonId}.wav`);

    const response = await fetch(`${supabaseUrl}/functions/v1/pronunciation-coach`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${firebaseToken}`,
            apikey: supabaseKey
        },
        body: form
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result?.error || "發音評分服務暫時無法使用");
        error.status = response.status;
        error.code = result?.code || null;
        throw error;
    }
    return result;
};

// Local ASR supplies text, never a score/reference answer. The server recalculates
// completeness and checks approved answers; text remains client-reported evidence.
export const submitSpeakingPronunciationAttempt = async ({ firebaseUser, questionId, recognizedText, audioSeconds, foundationRoundId = "", challengeSessionId = "", challengeMode = "easy" }) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");
    if (!Number.isInteger(Number(questionId)) || Number(questionId) <= 0 || !recognizedText?.trim() || !Number.isFinite(audioSeconds)) {
        throw new Error("錄音資料不完整，請重新錄音");
    }

    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/pronunciation-coach`, {
        method: "POST",
        headers: { Authorization: `Bearer ${firebaseToken}`, apikey: supabaseKey, "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: Number(questionId), recognized_text: recognizedText,
            audio_seconds: audioSeconds, assessment_kind: "local_completeness_v1",
            foundation_round_id: foundationRoundId, challenge_session_id: challengeSessionId, challenge_mode: challengeMode })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result?.error || "發音評分服務暫時無法使用");
        error.status = response.status;
        error.code = result?.code || null;
        throw error;
    }
    return result;
};
