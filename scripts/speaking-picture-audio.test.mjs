import assert from "node:assert/strict";
import test from "node:test";
import {
    assemblePictureGapSentenceWav,
    googleSpeechInputForText,
    pictureGapSentenceParts,
    PICTURE_SENTENCE_GAP_MS
} from "../supabase/functions/_shared/speaking-picture-audio.ts";
import { parseLinear16MonoWav } from "../supabase/functions/_shared/alphabet-audio-sequence.ts";

const wav = (durationMs, sampleRate = 24000) => {
    const pcm = new Uint8Array(Math.round(sampleRate * durationMs / 1000) * 2);
    const output = new Uint8Array(44 + pcm.length);
    const view = new DataView(output.buffer);
    const write = (offset, value) => [...value].forEach((character, index) => { output[offset + index] = character.charCodeAt(0); });
    write(0, "RIFF");
    view.setUint32(4, 36 + pcm.length, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, pcm.length, true);
    output.set(pcm, 44);
    return output;
};

test("the 使用固定 IPA 弱讀音，避免引擎自行猜音", () => {
    assert.deepEqual(googleSpeechInputForText("tree"), { text: "tree" });
    assert.deepEqual(googleSpeechInputForText("The horse is in the race."), {
        ssml: "<speak><phoneme alphabet=\"ipa\" ph=\"ðə\">The</phoneme> horse is in <phoneme alphabet=\"ipa\" ph=\"ðə\">the</phoneme> race.</speak>"
    });
});

test("整句只使用可見句型並在唯一空格切成前後兩段", () => {
    assert.deepEqual(pictureGapSentenceParts("The ____ is in the race."), {
        before: "The",
        after: "is in the race."
    });
    assert.throws(() => pictureGapSentenceParts("The horse is in the race."), /只有一個空格/);
    assert.throws(() => pictureGapSentenceParts("____"), /空格前後/);
});

test("整句 WAV 會嵌入精準 2 秒靜音", () => {
    const assembled = assemblePictureGapSentenceWav(wav(500), wav(750));
    const parsed = parseLinear16MonoWav(assembled.bytes);
    assert.equal(PICTURE_SENTENCE_GAP_MS, 2000);
    assert.equal(assembled.durationMs, 3250);
    assert.equal(Math.round(parsed.data.length / parsed.byteRate * 1000), 3250);
});

test("前後 WAV 規格不同時停止合成", () => {
    assert.throws(
        () => assemblePictureGapSentenceWav(wav(500, 24000), wav(500, 22050)),
        /取樣格式不一致/
    );
});
