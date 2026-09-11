import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callSpiralReview = async (firebaseUser, body = {}) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");
    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/spiral-review`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseToken}`,
            apikey: supabaseKey
        },
        body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || "螺旋複習服務暫時無法使用");
    return result;
};

export const getSpiralTeacherBootstrap = firebaseUser => callSpiralReview(firebaseUser, { action: "teacher_bootstrap" });
export const previewSpiralReviewCards = (firebaseUser, payload) => callSpiralReview(firebaseUser, { action: "preview_cards", ...payload });
export const createSpiralReview = (firebaseUser, payload) => callSpiralReview(firebaseUser, { action: "create_review", ...payload });
export const getStudentSpiralQueue = firebaseUser => callSpiralReview(firebaseUser, { action: "student_queue" });
export const submitSpiralAnswer = (firebaseUser, payload) => callSpiralReview(firebaseUser, { action: "submit_answer", ...payload });
