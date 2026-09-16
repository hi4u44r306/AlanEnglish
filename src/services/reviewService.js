import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const REVIEW_DASHBOARD_CACHE_MS = 45 * 1000;
const reviewDashboardCache = new Map();

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

export const getReviewDashboard = firebaseUser => {
    const cacheKey = firebaseUser?.uid;
    if (!cacheKey) return callReviewFunction(firebaseUser, { action: "bootstrap" });

    const cached = reviewDashboardCache.get(cacheKey);
    if (cached?.value && Date.now() - cached.cachedAt < REVIEW_DASHBOARD_CACHE_MS) {
        return Promise.resolve(cached.value);
    }
    if (cached?.promise) return cached.promise;

    const promise = callReviewFunction(firebaseUser, { action: "bootstrap" })
        .then(value => {
            reviewDashboardCache.set(cacheKey, {
                cachedAt: Date.now(),
                value
            });
            return value;
        })
        .catch(error => {
            if (reviewDashboardCache.get(cacheKey)?.promise === promise) {
                reviewDashboardCache.delete(cacheKey);
            }
            throw error;
        });

    reviewDashboardCache.set(cacheKey, { promise });
    return promise;
};

export const prefetchReviewDashboard = firebaseUser => (
    getReviewDashboard(firebaseUser).catch(() => null)
);

export const invalidateReviewDashboard = firebaseUser => {
    if (firebaseUser?.uid) reviewDashboardCache.delete(firebaseUser.uid);
};

export const submitReviewAnswer = async (firebaseUser, itemId, selectedAnswer) => {
    const result = await callReviewFunction(firebaseUser, {
        action: "submit",
        item_id: itemId,
        selected_answer: selectedAnswer
    });
    invalidateReviewDashboard(firebaseUser);
    return result;
};
