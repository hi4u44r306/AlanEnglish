const SCORE_KEYS = ["PronScore", "AccuracyScore", "FluencyScore", "CompletenessScore", "ProsodyScore"] as const;

const objectValue = (value: unknown): Record<string, unknown> | null => (
    value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
);

const firstDefined = (...values: unknown[]) => values.find(value => value !== undefined && value !== null);

const hasAssessmentScore = (value: Record<string, unknown> | null) => Boolean(
    value && SCORE_KEYS.some(key => {
        const score = value[key];
        return score !== undefined && score !== null && score !== "" && Number.isFinite(Number(score));
    })
);

export const selectAzureAssessmentResult = (data: unknown) => {
    const payload = objectValue(data);
    const candidates = Array.isArray(payload?.NBest) ? payload.NBest : [];

    for (const candidate of candidates) {
        const best = objectValue(candidate);
        if (!best) continue;
        const nested = objectValue(best.PronunciationAssessment)
            || objectValue(best.pronunciationAssessment);
        if (!hasAssessmentScore(best) && !hasAssessmentScore(nested)) continue;

        return {
            best,
            assessment: Object.fromEntries(SCORE_KEYS.map(key => [key, firstDefined(nested?.[key], best[key])]))
        };
    }

    return null;
};

export const readAzureWordAssessment = (value: unknown) => {
    const word = objectValue(value);
    const nested = objectValue(word?.PronunciationAssessment)
        || objectValue(word?.pronunciationAssessment);
    return {
        accuracyScore: firstDefined(nested?.AccuracyScore, word?.AccuracyScore),
        errorType: firstDefined(nested?.ErrorType, word?.ErrorType)
    };
};
