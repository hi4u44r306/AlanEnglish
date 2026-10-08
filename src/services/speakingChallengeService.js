import { callEdgeFunction } from "./edgeFunctionClient";
import { invalidateStudentPageCache } from "./studentPageCache";

const callChallenge = async (firebaseUser, action, payload = {}) => {
    const result = await callEdgeFunction("speaking-challenge", firebaseUser, { action, ...payload });
    if (["complete_question", "complete_alphabet_intro_listen"].includes(action)) invalidateStudentPageCache(firebaseUser?.uid);
    return result;
};

export const getSpeakingChallengeCatalog = firebaseUser => callChallenge(firebaseUser, "catalog");
export const getSpeakingAlphabetCostUsage = firebaseUser => callChallenge(firebaseUser, "alphabet_cost_usage");
export const getSpeakingChallengeSet = (firebaseUser, questionSetId, mode = "easy") => callChallenge(firebaseUser, "question_set", { question_set_id: questionSetId, mode });
export const revealSpeakingChallengeHint = (firebaseUser, questionSetId, questionId, challengeSessionId) => callChallenge(firebaseUser, "reveal_hint", {
    question_set_id: questionSetId, question_id: questionId, challenge_session_id: challengeSessionId, mode: "challenge"
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
