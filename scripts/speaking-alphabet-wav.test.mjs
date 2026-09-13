import test from "node:test";
import assert from "node:assert/strict";
import {
    ALPHABET_SEQUENCE_ASSEMBLER_VERSION,
    alphabetAudioSequenceValid,
    alphabetSourceFingerprint,
    assembleAlphabetAudioSequence,
    parseLinear16MonoWav
} from "../supabase/functions/_shared/alphabet-audio-sequence.ts";

const writeAscii = (bytes, offset, value) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
};

const wav = ({ sampleRate = 24000, samples = 2400, channels = 1, bitsPerSample = 16 } = {}) => {
    const blockAlign = channels * bitsPerSample / 8;
    const pcm = new Uint8Array(samples * blockAlign);
    const output = new Uint8Array(44 + pcm.length);
    const view = new DataView(output.buffer);
    writeAscii(output, 0, "RIFF");
    view.setUint32(4, output.length - 8, true);
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

const sources = (override = {}) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, index) => ({
    questionId: index + 1,
    letter,
    assetId: `asset-${letter}`,
    contentHash: letter.repeat(64).slice(0, 64),
    byteSize: wav().length,
    bytes: wav(),
    ...override
}));

test("26 個 mono LINEAR16 WAV 會組成一個含 800ms 間隔的主音檔", async () => {
    const assembled = assembleAlphabetAudioSequence(sources(), 800);
    const parsed = parseLinear16MonoWav(assembled.bytes);
    assert.equal(parsed.sampleRate, 24000);
    assert.equal(assembled.segments.length, 26);
    assert.equal(assembled.segments[0].start_ms, 0);
    assert.equal(assembled.segments[0].end_ms, 100);
    assert.equal(assembled.segments[1].start_ms, 900);
    assert.equal(assembled.durationMs, 22600);
    const questions = sources().map((source, index) => ({
        id: source.questionId, sort_order: index, model_answer: source.letter
    }));
    assert.equal(alphabetAudioSequenceValid(questions, {
        status: "ready",
        private_object_key: "speaking-tts/derived/alphabet/master.wav",
        byte_size: assembled.bytes.length,
        duration_ms: assembled.durationMs,
        segments: assembled.segments
    }), true);
    const fingerprint = await alphabetSourceFingerprint(sources().map(({ bytes, ...source }) => source), 800);
    assert.match(fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(ALPHABET_SEQUENCE_ASSEMBLER_VERSION, "alphabet-pcm-sequence-v1");
});

test("缺字母、順序錯誤或取樣格式不一致時 fail closed", () => {
    assert.throws(() => assembleAlphabetAudioSequence(sources().slice(0, 25), 800), /完整 26 個字母/);
    const wrongOrder = sources();
    wrongOrder[1] = { ...wrongOrder[1], letter: "C" };
    assert.throws(() => assembleAlphabetAudioSequence(wrongOrder, 800), /來源字母或順序不正確/);
    const mismatched = sources();
    mismatched[25] = { ...mismatched[25], bytes: wav({ sampleRate: 16000 }), byteSize: wav({ sampleRate: 16000 }).length };
    assert.throws(() => assembleAlphabetAudioSequence(mismatched, 800), /取樣格式不一致/);
    assert.throws(() => parseLinear16MonoWav(wav({ channels: 2 })), /單聲道 16-bit PCM/);
});

test("manifest 的題目、字母、順序或時間越界時不可對學生公開", () => {
    const assembled = assembleAlphabetAudioSequence(sources(), 800);
    const questions = sources().map((source, index) => ({
        id: source.questionId, sort_order: index, model_answer: source.letter
    }));
    const base = {
        status: "ready",
        private_object_key: "speaking-tts/derived/alphabet/master.wav",
        byte_size: assembled.bytes.length,
        duration_ms: assembled.durationMs,
        segments: assembled.segments
    };
    assert.equal(alphabetAudioSequenceValid(questions, { ...base, segments: assembled.segments.slice(0, 25) }), false);
    assert.equal(alphabetAudioSequenceValid(questions, {
        ...base,
        segments: assembled.segments.map((segment, index) => index === 2 ? { ...segment, question_id: 999 } : segment)
    }), false);
    assert.equal(alphabetAudioSequenceValid(questions, {
        ...base,
        segments: assembled.segments.map((segment, index) => index === 25 ? { ...segment, end_ms: assembled.durationMs + 1 } : segment)
    }), false);
});
