import { callEdgeFunction } from "./edgeFunctionClient";
import { invalidateStudentPageCache } from "./studentPageCache";

const callChallenge = async (firebaseUser, action, payload = {}) => {
    const result = await callEdgeFunction("speaking-challenge", firebaseUser, { action, ...payload });
    if (["complete_question", "complete_alphabet_intro_listen"].includes(action)) invalidateStudentPageCache(firebaseUser?.uid);
    return result;
};

export const getSpeakingChallengeCatalog = firebaseUser => callChallenge(firebaseUser, "catalog");
export const getSpeakingAlphabetCostUsage = firebaseUser => callChallenge(firebaseUser, "alphabet_cost_usage");
// 關卡摘要打開時先在背景讀題目，學生按下等級時通常已經讀好，可以立刻進入關卡。
// 只讀不寫；60 秒內、同一位學生、同一關同一等級才使用，用過一次就丟掉。
const PREFETCH_TTL_MS = 60 * 1000;
const prefetchedSets = new Map();
const prefetchKey = (firebaseUser, questionSetId, mode) => `${firebaseUser?.uid || ""}:${Number(questionSetId)}:${mode === "challenge" ? "challenge" : "easy"}`;
const fetchChallengeSet = (firebaseUser, questionSetId, mode) => callChallenge(firebaseUser, "question_set", { question_set_id: questionSetId, mode });

export const prefetchSpeakingChallengeSet = (firebaseUser, questionSetId, mode = "easy") => {
    if (!firebaseUser?.uid || !questionSetId) return;
    const key = prefetchKey(firebaseUser, questionSetId, mode);
    const cached = prefetchedSets.get(key);
    if (cached && Date.now() - cached.at < PREFETCH_TTL_MS) return;
    const promise = fetchChallengeSet(firebaseUser, questionSetId, mode);
    promise.catch(() => prefetchedSets.delete(key));
    prefetchedSets.set(key, { at: Date.now(), promise });
};

export const getSpeakingChallengeSet = (firebaseUser, questionSetId, mode = "easy") => {
    const key = prefetchKey(firebaseUser, questionSetId, mode);
    const cached = prefetchedSets.get(key);
    prefetchedSets.delete(key);
    return cached && Date.now() - cached.at < PREFETCH_TTL_MS ? cached.promise : fetchChallengeSet(firebaseUser, questionSetId, mode);
};
export const revealSpeakingChallengeHint = (firebaseUser, questionSetId, questionId, challengeSessionId, mode = "challenge") => callChallenge(firebaseUser, "reveal_hint", {
    question_set_id: questionSetId, question_id: questionId, challenge_session_id: challengeSessionId, mode
});
export const startSpeakingFoundationRound = (firebaseUser, questionSetId) => callChallenge(firebaseUser, "start_foundation_round", { question_set_id: questionSetId, mode: "challenge" });
export const startAlphabetIntroListen = (firebaseUser, questionSetId) => callChallenge(firebaseUser, "start_alphabet_intro_listen", { question_set_id: questionSetId });
export const completeAlphabetIntroListen = (firebaseUser, questionSetId, listenSessionId) => callChallenge(firebaseUser, "complete_alphabet_intro_listen", {
    question_set_id: questionSetId,
    listen_session_id: listenSessionId
});
export const completeSpeakingChallengeQuestion = (firebaseUser, questionSetId, questionId, mode = "easy", challengeSessionId = "") => callChallenge(firebaseUser, "complete_question", {
    question_set_id: questionSetId, question_id: questionId, mode, challenge_session_id: challengeSessionId
});
