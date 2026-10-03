export const speakingRecordingSeconds = (interactionType: string | null | undefined): number =>
    ["alphabet_round", "letter_spelling"].includes(String(interactionType || "")) ? 12 : 25;

export const validSpeakingAudioDuration = (seconds: number, interactionType: string | null | undefined): boolean =>
    Number.isFinite(seconds) && seconds >= 0.35 && seconds <= speakingRecordingSeconds(interactionType);
