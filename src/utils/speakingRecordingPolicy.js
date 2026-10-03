// The server independently resolves the published question type.
export const speakingRecordingSeconds = interactionType =>
    ["alphabet_round", "letter_spelling"].includes(interactionType) ? 12 : 25;

export const SPEAKING_BUDGET_ERROR_CODES = new Set([
    "student_audio_budget_exhausted", "global_audio_budget_exhausted", "audio_budget_not_configured"
]);
