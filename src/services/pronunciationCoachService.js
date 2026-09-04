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

// The question id is the only client-supplied reference.  The Edge Function
// loads the published model answer itself, so a browser cannot substitute an
// easier sentence for scoring.
export const submitSpeakingPronunciationAttempt = async ({ firebaseUser, questionId, audio }) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");
    if (!Number.isInteger(Number(questionId)) || !(audio instanceof Blob)) {
        throw new Error("錄音資料不完整，請重新錄音");
    }

    const firebaseToken = await firebaseUser.getIdToken();
    const form = new FormData();
    form.append("question_id", String(questionId));
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
