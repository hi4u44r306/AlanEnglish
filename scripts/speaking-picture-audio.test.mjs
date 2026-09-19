import assert from "node:assert/strict";
import test from "node:test";
import {
    assemblePictureGapSentenceWav,
    assemblePictureGapSentenceSegmentsWav,
    googleSpeechInputForText,
    pictureGapTheCandidateInput,
    pictureGapSentenceParts,
    pictureGapSentenceSegments,
    PICTURE_SENTENCE_GAP_MS,
    ttsTextWithoutTerminalFullStops
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
    assert.deepEqual(googleSpeechInputForText("It's red."), { text: "It's red" });
    assert.deepEqual(googleSpeechInputForText("What color is the apple? It's red."), {
        ssml: "<speak>What color is <phoneme alphabet=\"ipa\" ph=\"ðə\">the</phoneme> apple? It&apos;s red</speak>"
    });
    assert.deepEqual(googleSpeechInputForText("The horse is in the race."), {
        ssml: "<speak><phoneme alphabet=\"ipa\" ph=\"ðə\">The</phoneme> horse is in <phoneme alphabet=\"ipa\" ph=\"ðə\">the</phoneme> race</speak>"
    });
});

test("The 候選在同一次合成保留連句語境與 2 秒空格", () => {
    assert.deepEqual(pictureGapTheCandidateInput("The ____ are in the classroom.", "context-natural"), {
        ssml: "<speak><phoneme alphabet=\"ipa\" ph=\"ðə\">The</phoneme><break time=\"2000ms\"/>are in <phoneme alphabet=\"ipa\" ph=\"ðə\">the</phoneme> classroom</speak>"
    });
    assert.deepEqual(pictureGapTheCandidateInput("The ____ is not in Taipei.", "context-clear"), {
        ssml: "<speak><prosody rate=\"88%\"><phoneme alphabet=\"ipa\" ph=\"ðə\">The</phoneme></prosody><break time=\"2000ms\"/>is not in Taipei</speak>"
    });
    assert.throws(() => pictureGapTheCandidateInput("We ____ are ready.", "context-natural"), /以 The 開始/);
    assert.throws(() => pictureGapTheCandidateInput("The ____ are ready.", "missing"), /候選版本/);
});

test("整句只使用可見句型並在唯一空格切成前後兩段", () => {
    assert.deepEqual(pictureGapSentenceParts("The ____ is in the race."), {
        before: "The",
        after: "is in the race."
    });
    assert.deepEqual(pictureGapSentenceParts("What color is the apple? It's ____."), {
        before: "What color is the apple? It's",
        after: "."
    });
    assert.equal(ttsTextWithoutTerminalFullStops("."), "");
    assert.throws(() => pictureGapSentenceParts("The horse is in the race."), /只有一個空格/);
    assert.throws(() => pictureGapSentenceParts("____"), /空格前/);
});

test("多個挖空會依管理員輸入拆成多段可見文字", () => {
    assert.deepEqual(pictureGapSentenceSegments("They ____ her ____."), ["They", "her", "."]);
    assert.deepEqual(pictureGapSentenceSegments("____ are her ____."), ["", "are her", "."]);
    assert.throws(() => pictureGapSentenceSegments("They ____ ____ eyes."), /相鄰挖空/);
});

test("整句 WAV 會嵌入精準 2 秒靜音", () => {
    const assembled = assemblePictureGapSentenceWav(wav(500), wav(750));
    const parsed = parseLinear16MonoWav(assembled.bytes);
    assert.equal(PICTURE_SENTENCE_GAP_MS, 2000);
    assert.equal(assembled.durationMs, 3250);
    assert.equal(Math.round(parsed.data.length / parsed.byteRate * 1000), 3250);
});

test("空格位於句尾時保留 2 秒停頓且不要求右側語音", () => {
    const assembled = assemblePictureGapSentenceWav(wav(500), null);
    const parsed = parseLinear16MonoWav(assembled.bytes);
    assert.equal(assembled.durationMs, 2500);
    assert.equal(Math.round(parsed.data.length / parsed.byteRate * 1000), 2500);
});

test("多個挖空各自嵌入精準 2 秒靜音", () => {
    const assembled = assemblePictureGapSentenceSegmentsWav([wav(500), wav(250), null]);
    const parsed = parseLinear16MonoWav(assembled.bytes);
    assert.equal(assembled.durationMs, 4750);
    assert.equal(Math.round(parsed.data.length / parsed.byteRate * 1000), 4750);
});

test("前後 WAV 規格不同時停止合成", () => {
    assert.throws(
        () => assemblePictureGapSentenceWav(wav(500, 24000), wav(500, 22050)),
        /取樣格式不一致/
    );
});
