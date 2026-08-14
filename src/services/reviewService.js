import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callReviewFunction = async (firebaseUser, body = {}) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");

    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/review-center`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseToken}`,
            apikey: supabaseKey
        },
        body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(result?.error || "智慧複習服務暫時無法使用");
        error.status = response.status;
        throw error;
    }

    return result;
};

export const getReviewDashboard = firebaseUser => (
    callReviewFunction(firebaseUser, { action: "bootstrap" })
);

export const submitReviewAnswer = (firebaseUser, itemId, selectedAnswer) => (
    callReviewFunction(firebaseUser, {
        action: "submit",
        item_id: itemId,
        selected_answer: selectedAnswer
    })
);
