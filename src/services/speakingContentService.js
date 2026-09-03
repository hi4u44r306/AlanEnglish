import { callEdgeFunction } from "./edgeFunctionClient";

const callSpeakingContent = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("speaking-content-manager", firebaseUser, { action, ...payload })
);

export const getSpeakingContentBootstrap = firebaseUser => callSpeakingContent(firebaseUser, "bootstrap");
export const saveReviewedSpeakingSource = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "save_reviewed_source", payload);
export const generateSpeakingQuestionSet = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "generate_question_set", payload);
export const updateDraftSpeakingQuestion = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "update_draft_question", payload);
export const publishSpeakingQuestionSet = (firebaseUser, questionSetId) => callSpeakingContent(firebaseUser, "publish_question_set", { question_set_id: questionSetId });
