export type SpeakingVoiceGender = "female" | "male";

export type SpeakingVoiceChoice = {
    gender: SpeakingVoiceGender;
    voiceId: string;
};

export const DEFAULT_FEMALE_VOICE_ID = "en-US-Chirp3-HD-Leda";
export const DEFAULT_MALE_VOICE_ID = "en-US-Chirp3-HD-Puck";

export const voiceGenderForQuestion = (_questionSetId: unknown, _sortOrder: unknown): SpeakingVoiceGender => "female";

export const chooseSpeakingVoice = (
    questionSetId: unknown,
    sortOrder: unknown,
    voices: { female: string; male: string }
): SpeakingVoiceChoice => {
    const gender = voiceGenderForQuestion(questionSetId, sortOrder);
    return { gender, voiceId: voices.female };
};
