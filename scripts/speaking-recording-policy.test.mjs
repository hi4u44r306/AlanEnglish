import { test } from "node:test";
import assert from "node:assert/strict";
import { speakingRecordingSeconds, validSpeakingAudioDuration } from "../supabase/functions/_shared/speaking-recording-policy.ts";
import { inspectPcm16Wav } from "../supabase/functions/_shared/speaking-pcm-wav.ts";
import { speakingRecordingSeconds as browserLimit } from "../src/utils/speakingRecordingPolicy.js";

const wav = seconds => {
    const buffer = new ArrayBuffer(44 + Math.round(seconds * 32000));
    const view = new DataView(buffer);
    for (const [offset, value] of [[0, "RIFF"], [8, "WAVE"], [12, "fmt "], [36, "data"]])
        [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)));
    view.setUint32(4, buffer.byteLength - 8, true);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(40, buffer.byteLength - 44, true);
    view.setInt16(44, 10000, true);
    return buffer;
};

test("所有已知題型的前後端時限一致；字母 12 秒，句子問答 25 秒", () => {
    for (const type of ["alphabet_round", "letter_spelling", "standard_sentence", "text_qa", "picture_qa", "picture_gap_sentence", "", undefined]) {
        assert.equal(speakingRecordingSeconds(type), browserLimit(type));
        assert.equal(validSpeakingAudioDuration(speakingRecordingSeconds(type), type), true);
        assert.equal(validSpeakingAudioDuration(speakingRecordingSeconds(type) + 0.001, type), false);
    }
    assert.equal(validSpeakingAudioDuration(25, "text_qa"), true);
    assert.equal(validSpeakingAudioDuration(25, "alphabet_round"), false);
    for (const duration of [NaN, Infinity, -1, 0, 0.349]) assert.equal(validSpeakingAudioDuration(duration, "text_qa"), false);
});
test("25 秒 PCM 實際長度可被後端檢查，且小於 1 MiB", () => {
    const buffer = wav(25);
    assert.ok(buffer.byteLength < 1024 * 1024);
    assert.equal(inspectPcm16Wav(buffer).durationSeconds, 25);
});
test("拒絕以假標頭、附加資料或不完整樣本規避時長", () => {
    for (const [offset, value] of [[4, 100], [40, 100], [40, 32001], [28, 16000], [16, 18], [32, 4]]) {
        const buffer = wav(1);
        new DataView(buffer).setUint32(offset, value, true);
        assert.equal(inspectPcm16Wav(buffer), null);
    }
    assert.equal(inspectPcm16Wav(new ArrayBuffer(43)), null);
});
