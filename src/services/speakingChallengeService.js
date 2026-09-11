import { callEdgeFunction } from "./edgeFunctionClient";

const callChallenge = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("speaking-challenge", firebaseUser, { action, ...payload })
);

const CATALOG_CACHE_TTL_MS = 60 * 1000;
const catalogCache = new Map();
const catalogRequests = new Map();

const getCatalogCacheKey = firebaseUser => firebaseUser?.uid || "anonymous";

export const getSpeakingChallengeCatalog = (firebaseUser, { force = false } = {}) => {
    const cacheKey = getCatalogCacheKey(firebaseUser);
    const cached = catalogCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.savedAt < CATALOG_CACHE_TTL_MS) {
        return Promise.resolve(cached.result);
    }
    if (!force && catalogRequests.has(cacheKey)) return catalogRequests.get(cacheKey);

    const request = callChallenge(firebaseUser, "catalog")
        .then(result => {
            catalogCache.set(cacheKey, { result, savedAt: Date.now() });
            return result;
        })
        .finally(() => catalogRequests.delete(cacheKey));
    catalogRequests.set(cacheKey, request);
    return request;
};

export const prefetchSpeakingChallengeCatalog = firebaseUser => (
    getSpeakingChallengeCatalog(firebaseUser).catch(() => null)
);

export const clearSpeakingChallengeCatalogCache = firebaseUser => {
    if (firebaseUser?.uid) {
        catalogCache.delete(getCatalogCacheKey(firebaseUser));
        catalogRequests.delete(getCatalogCacheKey(firebaseUser));
        return;
    }
    catalogCache.clear();
    catalogRequests.clear();
};

export const getSpeakingChallengeSet = (firebaseUser, questionSetId) => callChallenge(firebaseUser, "question_set", { question_set_id: questionSetId });
export const completeSpeakingChallengeQuestion = async (firebaseUser, questionSetId, questionId) => {
    const result = await callChallenge(firebaseUser, "complete_question", { question_set_id: questionSetId, question_id: questionId });
    clearSpeakingChallengeCatalogCache(firebaseUser);
    return result;
};
