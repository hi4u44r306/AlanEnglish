export type SpeakingVoiceGender = "female" | "male";

export type SpeakingVoiceChoice = {
    gender: SpeakingVoiceGender;
    voiceId: string;
};

export const DEFAULT_FEMALE_VOICE_ID = "en-US-Chirp3-HD-Autonoe";
export const DEFAULT_MALE_VOICE_ID = "en-US-Chirp3-HD-Puck";

const normalizedInteger = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.abs(Math.trunc(parsed)) : 0;
};

export const voiceGenderForQuestion = (questionSetId: unknown, sortOrder: unknown): SpeakingVoiceGender => (
    (normalizedInteger(questionSetId) + normalizedInteger(sortOrder)) % 2 === 0 ? "female" : "male"
);

export const chooseSpeakingVoice = (
    questionSetId: unknown,
    sortOrder: unknown,
    voices: { female: string; male: string }
): SpeakingVoiceChoice => {
    const gender = voiceGenderForQuestion(questionSetId, sortOrder);
    return { gender, voiceId: gender === "female" ? voices.female : voices.male };
};
