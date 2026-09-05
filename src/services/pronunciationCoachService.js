import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

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

// The browser sends the question id and optional slot values, never a complete
// reference sentence. The Edge Function loads the published template and
// validates every placeholder before building the scoring reference.
export const submitSpeakingPronunciationAttempt = async ({ firebaseUser, questionId, slotValues = {}, audio }) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");
    if (!Number.isInteger(Number(questionId)) || !(audio instanceof Blob)) {
        throw new Error("錄音資料不完整，請重新錄音");
    }

    const firebaseToken = await firebaseUser.getIdToken();
    const form = new FormData();
    form.append("question_id", String(questionId));
    if (Object.keys(slotValues).length > 0) form.append("slot_values", JSON.stringify(slotValues));
    form.append("audio", audio, `speaking-question-${questionId}.wav`);

    const response = await fetch(`${supabaseUrl}/functions/v1/pronunciation-coach`, {
        method: "POST",
        headers: { Authorization: `Bearer ${firebaseToken}`, apikey: supabaseKey },
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
