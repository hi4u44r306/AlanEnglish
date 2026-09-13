export const ALPHABET_CANDIDATE_ASSEMBLER = "alphabet-chirp3-silence-sequence-v1";
export const ALPHABET_LEGACY_CANDIDATE_ASSEMBLER = "alphabet-single-sequence-v1";
export const ALPHABET_LEGACY_CANDIDATE_REVISION = "alphabet-neural2-f-sequence-v1";
export const ALPHABET_LEGACY_CANDIDATE_VOICE = "en-US-Neural2-F";
export const ALPHABET_CANDIDATE_SETTINGS = Object.freeze({ audioEncoding: "LINEAR16", speakingRate: 0.92 });

export const ALPHABET_CANDIDATE_PROFILES = Object.freeze([
    Object.freeze({ id: "leda", label: "Leda", revision: "alphabet-chirp3-hd-leda-sequence-v1", voiceId: "en-US-Chirp3-HD-Leda" }),
    Object.freeze({ id: "aoede", label: "Aoede", revision: "alphabet-chirp3-hd-aoede-sequence-v1", voiceId: "en-US-Chirp3-HD-Aoede" }),
    Object.freeze({ id: "zephyr", label: "Zephyr", revision: "alphabet-chirp3-hd-zephyr-sequence-v1", voiceId: "en-US-Chirp3-HD-Zephyr" })
]);

export const alphabetCandidateProfileForRecord = (candidate: any) => ALPHABET_CANDIDATE_PROFILES.find(profile => (
    profile.revision === candidate?.revision && profile.voiceId === candidate?.voice_id
)) || null;

export const alphabetCandidateVoiceAllowed = (voiceId: unknown) => ALPHABET_CANDIDATE_PROFILES.some(
    profile => profile.voiceId === String(voiceId || "")
);

export const alphabetActiveCandidateAllowed = (candidate: any) => Boolean(alphabetCandidateProfileForRecord(candidate)) || (
    candidate?.assembler_version === ALPHABET_LEGACY_CANDIDATE_ASSEMBLER
    && candidate?.revision === ALPHABET_LEGACY_CANDIDATE_REVISION
    && candidate?.voice_id === ALPHABET_LEGACY_CANDIDATE_VOICE
);

export const alphabetCandidateSequenceAllowed = (assembler: unknown, segments: any[]) => (
    assembler === ALPHABET_CANDIDATE_ASSEMBLER
        ? segments?.every((segment: any) => alphabetCandidateVoiceAllowed(segment?.voice_id))
        : assembler === ALPHABET_LEGACY_CANDIDATE_ASSEMBLER
            && segments?.every((segment: any) => segment?.voice_id === ALPHABET_LEGACY_CANDIDATE_VOICE)
);

export const buildAlphabetMasterSsml = (gapMs = 800) => {
    if (!Number.isInteger(gapMs) || gapMs < 500 || gapMs > 2000) throw new Error("A–Z 間隔不正確");
    return `<speak>${
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, index) => {
            const spoken = letter === "Z"
                ? '<phoneme alphabet="ipa" ph="ziː">Z</phoneme>'
                : `<say-as interpret-as="characters">${letter}</say-as>`;
            return `${spoken}${index < 25 ? `<break time="${gapMs}ms"/>` : ""}`;
        }).join("")
    }</speak>`;
};

const pcmPeaksByFrame = (pcm: Uint8Array, sampleRate: number, frameMs = 10) => {
    if (!(pcm instanceof Uint8Array) || pcm.length < 2 || pcm.length % 2 !== 0
        || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) {
        throw new Error("A–Z 候選音檔 PCM 格式不正確");
    }
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const samplesPerFrame = Math.max(1, Math.round(sampleRate * frameMs / 1000));
    const frameCount = Math.ceil((pcm.length / 2) / samplesPerFrame);
    return Array.from({ length: frameCount }, (_, frameIndex) => {
        const start = frameIndex * samplesPerFrame;
        const end = Math.min(pcm.length / 2, start + samplesPerFrame);
        let peak = 0;
        for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
            peak = Math.max(peak, Math.abs(view.getInt16(sampleIndex * 2, true)));
        }
        return peak;
    });
};

export const detectAlphabetSpeechBoundaries = (pcm: Uint8Array, sampleRate: number) => {
    const frameMs = 10;
    const peaks = pcmPeaksByFrame(pcm, sampleRate, frameMs);
    const sorted = [...peaks].sort((left, right) => left - right);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.2)] || 0;
    const maxPeak = sorted[sorted.length - 1] || 0;
    if (maxPeak < 300) throw new Error("A–Z 候選音檔沒有可辨識的語音");
    const threshold = Math.max(180, noiseFloor * 4, maxPeak * 0.018);
    const active = peaks.map(peak => peak >= threshold);
    const firstActive = active.indexOf(true);
    const lastActive = active.lastIndexOf(true);
    if (firstActive < 0 || lastActive <= firstActive) throw new Error("A–Z 候選音檔沒有完整語音");

    const silenceRuns: { start: number; end: number; length: number }[] = [];
    let runStart = -1;
    for (let index = firstActive + 1; index < lastActive; index += 1) {
        if (!active[index] && runStart < 0) runStart = index;
        if (active[index] && runStart >= 0) {
            const length = index - runStart;
            if (length * frameMs >= 350) silenceRuns.push({ start: runStart, end: index, length });
            runStart = -1;
        }
    }
    if (silenceRuns.length < 25) throw new Error("A–Z 候選音檔缺少 25 個清楚停頓");
    const separators = [...silenceRuns]
        .sort((left, right) => right.length - left.length)
        .slice(0, 25)
        .sort((left, right) => left.start - right.start)
        .map(run => Math.round(((run.start + run.end) / 2) * frameMs));
    const durationMs = Math.round((pcm.length / 2) * 1000 / sampleRate);
    const boundaries = [0, ...separators, durationMs];
    if (boundaries.some((boundary, index) => index > 0 && boundary - boundaries[index - 1] < 120)) {
        throw new Error("A–Z 候選音檔停頓順序不正確");
    }
    return boundaries;
};

export const buildAlphabetCandidateSegments = (
    questions: any[], pcm: Uint8Array, sampleRate: number, voiceId: string
) => {
    if (!alphabetCandidateVoiceAllowed(voiceId)) throw new Error("A–Z 候選 voice 不在允許清單");
    const ordered = [...questions].sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    if (ordered.length !== 26) throw new Error("A–Z 候選音檔資料不完整");
    const boundaries = detectAlphabetSpeechBoundaries(pcm, sampleRate);
    return ordered.map((question, index) => {
        const letter = String(question?.model_answer || "").trim().toUpperCase();
        if (letter !== letters[index]) throw new Error("A–Z 題目順序不正確");
        return {
            question_id: Number(question.id), letter,
            start_ms: boundaries[index], end_ms: boundaries[index + 1], voice_id: voiceId
        };
    });
};
