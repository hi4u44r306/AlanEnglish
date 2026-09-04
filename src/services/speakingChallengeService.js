import { callEdgeFunction } from "./edgeFunctionClient";

const callChallenge = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("speaking-challenge", firebaseUser, { action, ...payload })
);

export const getSpeakingChallengeCatalog = firebaseUser => callChallenge(firebaseUser, "catalog");
export const getSpeakingChallengeSet = (firebaseUser, questionSetId) => callChallenge(firebaseUser, "question_set", { question_set_id: questionSetId });
export const completeSpeakingChallengeQuestion = (firebaseUser, questionSetId, questionId) => callChallenge(firebaseUser, "complete_question", { question_set_id: questionSetId, question_id: questionId });
