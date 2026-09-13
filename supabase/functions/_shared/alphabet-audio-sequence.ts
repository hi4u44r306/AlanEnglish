const ascii = (bytes: Uint8Array, offset: number, length: number) => String.fromCharCode(
    ...bytes.slice(offset, offset + length)
);

export const ALPHABET_SEQUENCE_GAP_MS = 800;
export const ALPHABET_SEQUENCE_ASSEMBLER_VERSION = "alphabet-pcm-sequence-v1";

export type AlphabetAudioSource = {
    questionId: number;
    letter: string;
    assetId: string;
    contentHash: string;
    byteSize: number;
    bytes: Uint8Array;
};

export type AlphabetAudioSegment = {
    question_id: number;
    letter: string;
    start_ms: number;
    end_ms: number;
};

type ParsedPcmWav = {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    byteRate: number;
    blockAlign: number;
    bitsPerSample: number;
    data: Uint8Array;
};

const sha256 = async (value: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
};

export const parseLinear16MonoWav = (bytes: Uint8Array): ParsedPcmWav => {
    if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") {
        throw new Error("A–Z 來源音檔不是有效 WAV");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12;
    let format: Omit<ParsedPcmWav, "data"> | null = null;
    let data: Uint8Array | null = null;
    while (offset + 8 <= bytes.length) {
        const chunkId = ascii(bytes, offset, 4);
        const chunkSize = view.getUint32(offset + 4, true);
        const dataOffset = offset + 8;
        if (chunkSize > bytes.length - dataOffset) throw new Error("A–Z 來源 WAV chunk 已截斷");
        if (chunkId === "fmt ") {
            if (chunkSize < 16) throw new Error("A–Z 來源 WAV fmt chunk 不完整");
            format = {
                audioFormat: view.getUint16(dataOffset, true),
                channels: view.getUint16(dataOffset + 2, true),
                sampleRate: view.getUint32(dataOffset + 4, true),
                byteRate: view.getUint32(dataOffset + 8, true),
                blockAlign: view.getUint16(dataOffset + 12, true),
                bitsPerSample: view.getUint16(dataOffset + 14, true)
            };
        } else if (chunkId === "data") {
            if (data) throw new Error("A–Z 來源 WAV 包含多個 data chunk");
            data = bytes.slice(dataOffset, dataOffset + chunkSize);
        }
        offset = dataOffset + chunkSize + (chunkSize % 2);
    }
    if (!format || !data?.length) throw new Error("A–Z 來源 WAV 缺少聲音資料");
    if (format.audioFormat !== 1 || format.channels !== 1 || format.bitsPerSample !== 16) {
        throw new Error("A–Z 來源音檔必須是單聲道 16-bit PCM WAV");
    }
    if (!format.sampleRate || format.blockAlign !== 2 || format.byteRate !== format.sampleRate * format.blockAlign) {
        throw new Error("A–Z 來源 WAV 格式不一致");
    }
    if (data.length % format.blockAlign !== 0) throw new Error("A–Z 來源 WAV data 未對齊完整取樣");
    return { ...format, data };
};

const writeAscii = (bytes: Uint8Array, offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
};

const buildPcmWav = (pcm: Uint8Array, sampleRate: number, channels: number, bitsPerSample: number) => {
    const blockAlign = channels * bitsPerSample / 8;
    const output = new Uint8Array(44 + pcm.length);
    const view = new DataView(output.buffer);
    writeAscii(output, 0, "RIFF");
    view.setUint32(4, 36 + pcm.length, true);
    writeAscii(output, 8, "WAVE");
    writeAscii(output, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeAscii(output, 36, "data");
    view.setUint32(40, pcm.length, true);
    output.set(pcm, 44);
    return output;
};

export const alphabetSourceFingerprint = async (sources: Omit<AlphabetAudioSource, "bytes">[], gapMs: number) => sha256(JSON.stringify({
    assembler_version: ALPHABET_SEQUENCE_ASSEMBLER_VERSION,
    gap_ms: gapMs,
    sources: sources.map(source => ({
        question_id: Number(source.questionId),
        letter: String(source.letter),
        asset_id: String(source.assetId),
        content_hash: String(source.contentHash),
        byte_size: Number(source.byteSize)
    }))
}));

export const assembleAlphabetAudioSequence = (sources: AlphabetAudioSource[], gapMs = 800) => {
    if (sources.length !== 26 || !Number.isInteger(gapMs) || gapMs < 300 || gapMs > 2000) {
        throw new Error("A–Z 主音檔需要完整 26 個字母與適合兒童的固定間隔");
    }
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const parsed = sources.map((source, index) => {
        if (source.letter !== letters[index]) throw new Error("A–Z 來源字母或順序不正確");
        return parseLinear16MonoWav(source.bytes);
    });
    const first = parsed[0];
    if (parsed.some(item => item.sampleRate !== first.sampleRate
        || item.channels !== first.channels
        || item.bitsPerSample !== first.bitsPerSample
        || item.blockAlign !== first.blockAlign)) {
        throw new Error("A–Z 的 26 個 WAV 取樣格式不一致，已停止合成");
    }
    const gapFrames = Math.round(first.sampleRate * gapMs / 1000);
    const gapBytes = gapFrames * first.blockAlign;
    const totalBytes = parsed.reduce((sum, item) => sum + item.data.length, 0) + gapBytes * 25;
    if (totalBytes <= 0 || totalBytes + 44 > 20 * 1024 * 1024) throw new Error("A–Z 主音檔大小超過安全上限");
    const pcm = new Uint8Array(totalBytes);
    const segments: AlphabetAudioSegment[] = [];
    let byteOffset = 0;
    parsed.forEach((item, index) => {
        const startFrame = byteOffset / first.blockAlign;
        pcm.set(item.data, byteOffset);
        byteOffset += item.data.length;
        const endFrame = byteOffset / first.blockAlign;
        segments.push({
            question_id: Number(sources[index].questionId),
            letter: sources[index].letter,
            start_ms: Math.round(startFrame * 1000 / first.sampleRate),
            end_ms: Math.round(endFrame * 1000 / first.sampleRate)
        });
        if (index < parsed.length - 1) byteOffset += gapBytes;
    });
    return {
        bytes: buildPcmWav(pcm, first.sampleRate, first.channels, first.bitsPerSample),
        durationMs: Math.round((pcm.length / first.blockAlign) * 1000 / first.sampleRate),
        segments
    };
};

export const alphabetAudioSequenceValid = (questions: any[], sequence: any) => {
    if (!Array.isArray(questions) || questions.length !== 26
        || sequence?.status !== "ready"
        || !sequence?.private_object_key
        || Number(sequence?.byte_size || 0) <= 44
        || Number(sequence?.duration_ms || 0) <= 0
        || !Array.isArray(sequence?.segments)
        || sequence.segments.length !== 26) return false;
    const orderedQuestions = [...questions].sort((left, right) => Number(left.sort_order) - Number(right.sort_order));
    let previousEnd = 0;
    return sequence.segments.every((segment: any, index: number) => {
        const question = orderedQuestions[index];
        const start = Number(segment?.start_ms);
        const end = Number(segment?.end_ms);
        const valid = Number(segment?.question_id) === Number(question?.id)
            && String(segment?.letter || "") === String(question?.model_answer || "").trim().toUpperCase()
            && Number.isFinite(start) && Number.isFinite(end)
            && start >= previousEnd && end > start
            && end <= Number(sequence.duration_ms);
        previousEnd = end;
        return valid;
    });
};
