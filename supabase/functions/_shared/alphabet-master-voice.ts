export const ALPHABET_CANDIDATE_REVISION = "alphabet-neural2-f-sequence-v1";
export const ALPHABET_CANDIDATE_ASSEMBLER = "alphabet-single-sequence-v1";
export const ALPHABET_CANDIDATE_VOICE = "en-US-Neural2-F";
export const ALPHABET_CANDIDATE_SETTINGS = Object.freeze({
    audioEncoding: "LINEAR16", speakingRate: 0.82, pitch: 1.5, volumeGainDb: 2
});

export const buildAlphabetMasterSsml = (gapMs = 800) => {
    if (!Number.isInteger(gapMs) || gapMs < 300 || gapMs > 2000) throw new Error("A–Z 間隔不正確");
    return `<speak>${
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, index) => (
            `<mark name="${letter}"/><say-as interpret-as="characters">${letter}</say-as>${index < 25 ? `<break time="${gapMs}ms"/>` : ""}`
        )).join("")
    }</speak>`;
};

export const buildAlphabetCandidateSegments = (questions: any[], timepoints: any[], durationMs: number) => {
    const ordered = [...questions].sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    if (ordered.length !== 26 || !Number.isFinite(durationMs) || durationMs <= 0) throw new Error("A–Z 候選音檔資料不完整");
    const normalizedPoints = (Array.isArray(timepoints) ? timepoints : [])
        .map(point => ({
            markName: String(point?.markName || ""),
            timeSeconds: typeof point?.timeSeconds === "number" ? point.timeSeconds : Number.NaN
        }));
    if (normalizedPoints.length !== 26
        || new Set(normalizedPoints.map(point => point.markName)).size !== 26
        || normalizedPoints.some(point => !letters.includes(point.markName)
            || !Number.isFinite(point.timeSeconds) || point.timeSeconds < 0)) {
        throw new Error("A–Z 候選音檔缺少完整字母時間碼");
    }
    const pointByLetter = new Map(normalizedPoints.map(point => [point.markName, point.timeSeconds]));
    if (letters.some(letter => !Number.isFinite(pointByLetter.get(letter)))) throw new Error("A–Z 候選音檔缺少完整字母時間碼");
    const starts = letters.map(letter => Math.max(0, Math.round(Number(pointByLetter.get(letter)) * 1000)));
    if (starts.some((start, index) => index > 0 && start <= starts[index - 1]) || durationMs <= starts[25]) {
        throw new Error("A–Z 候選音檔時間碼順序不正確");
    }
    return ordered.map((question, index) => {
        const letter = String(question?.model_answer || "").trim().toUpperCase();
        if (letter !== letters[index]) throw new Error("A–Z 題目順序不正確");
        return {
            question_id: Number(question.id), letter,
            start_ms: starts[index], end_ms: index < 25 ? starts[index + 1] : durationMs,
            voice_id: ALPHABET_CANDIDATE_VOICE
        };
    });
};
