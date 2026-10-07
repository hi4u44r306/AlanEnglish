import { callEdgeFunction } from "./edgeFunctionClient";

const callChallenge = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("speaking-challenge", firebaseUser, { action, ...payload })
);

export const getSpeakingChallengeCatalog = firebaseUser => callChallenge(firebaseUser, "catalog");
export const getSpeakingAlphabetCostUsage = firebaseUser => callChallenge(firebaseUser, "alphabet_cost_usage");
export const getSpeakingChallengeSet = (firebaseUser, questionSetId, mode = "easy") => callChallenge(firebaseUser, "question_set", { question_set_id: questionSetId, mode });
export const revealSpeakingChallengeHint = (firebaseUser, questionSetId, questionId, challengeSessionId) => callChallenge(firebaseUser, "reveal_hint", {
    question_set_id: questionSetId, question_id: questionId, challenge_session_id: challengeSessionId, mode: "challenge"
});
export const startSpeakingFoundationRound = (firebaseUser, questionSetId) => callChallenge(firebaseUser, "start_foundation_round", { question_set_id: questionSetId });
export const startAlphabetIntroListen = (firebaseUser, questionSetId) => callChallenge(firebaseUser, "start_alphabet_intro_listen", { question_set_id: questionSetId });
export const completeAlphabetIntroListen = (firebaseUser, questionSetId, listenSessionId) => callChallenge(firebaseUser, "complete_alphabet_intro_listen", {
    question_set_id: questionSetId,
    listen_session_id: listenSessionId
});
export const completeSpeakingChallengeQuestion = (firebaseUser, questionSetId, questionId, mode = "easy", challengeSessionId = "") => callChallenge(firebaseUser, "complete_question", {
    question_set_id: questionSetId, question_id: questionId, mode, challenge_session_id: challengeSessionId
});
