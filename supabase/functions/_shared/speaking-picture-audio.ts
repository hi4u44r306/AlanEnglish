import { parseLinear16MonoWav } from "./alphabet-audio-sequence.ts";

export const PICTURE_SENTENCE_GAP_MS = 2000;
export const PICTURE_SENTENCE_AUDIO_VERSION = "picture-gap-leda-v2";
export const VISIBLE_WORD_AUDIO_VERSION = "visible-word-leda-v2";
export const PICTURE_GAP_THE_CANDIDATE_VERSION = "picture-gap-the-context-v2";

export const PICTURE_GAP_THE_CANDIDATE_PROFILES = Object.freeze([
    Object.freeze({ id: "context-natural", label: "自然弱讀（連句語境）", theRate: "100%" }),
    Object.freeze({ id: "context-clear", label: "清楚弱讀（The 稍慢）", theRate: "88%" })
]);

export type GoogleSpeechInput = { text: string } | { ssml: string };

const xmlEscape = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const withoutTerminalFullStops = (value: unknown) => String(value || "")
    .trim()
    .replace(/[.\u3002\uff0e\u2026]+$/u, "")
    .trim();

const googleSsmlFragmentForText = (text: string) => xmlEscape(withoutTerminalFullStops(text)).replace(
    /\bthe\b/gi,
    matched => `<phoneme alphabet="ipa" ph="ðə">${matched}</phoneme>`
);

export const pictureGapSentenceParts = (pattern: unknown) => {
    const normalized = String(pattern || "").trim();
    const matches = [...normalized.matchAll(/_+/g)];
    if (matches.length !== 1) throw new Error("看圖補句必須只有一個空格");
    const match = matches[0];
    const start = Number(match.index);
    const before = normalized.slice(0, start).trim();
    const after = normalized.slice(start + match[0].length).trim();
    if (!before || !after) throw new Error("看圖補句的空格前後都必須有可朗讀文字");
    return { before, after };
};

export const googleSpeechInputForText = (value: unknown): GoogleSpeechInput => {
    const text = withoutTerminalFullStops(value);
    if (!text) throw new Error("語音文字不可為空白");
    if (!/\bthe\b/i.test(text)) return { text };
    const escaped = googleSsmlFragmentForText(text);
    return { ssml: `<speak>${escaped}</speak>` };
};

export const pictureGapTheCandidateInput = (pattern: unknown, profileId: unknown): GoogleSpeechInput => {
    const profile = PICTURE_GAP_THE_CANDIDATE_PROFILES.find(candidate => candidate.id === String(profileId || ""));
    if (!profile) throw new Error("The 弱讀候選版本不正確");
    const { before, after } = pictureGapSentenceParts(pattern);
    if (!/^the$/i.test(before)) throw new Error("這個候選試聽只適用於以 The 開始的看圖補句");
    const spokenThe = `<phoneme alphabet="ipa" ph="ðə">${xmlEscape(before)}</phoneme>`;
    const contextualThe = profile.theRate === "100%"
        ? spokenThe
        : `<prosody rate="${profile.theRate}">${spokenThe}</prosody>`;
    return {
        ssml: `<speak>${contextualThe}<break time="${PICTURE_SENTENCE_GAP_MS}ms"/>${googleSsmlFragmentForText(after)}</speak>`
    };
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

export const assemblePictureGapSentenceWav = (
    beforeBytes: Uint8Array,
    afterBytes: Uint8Array,
    gapMs = PICTURE_SENTENCE_GAP_MS
) => {
    if (!Number.isInteger(gapMs) || gapMs !== PICTURE_SENTENCE_GAP_MS) {
        throw new Error("看圖補句整句音檔必須保留 2 秒空格");
    }
    const before = parseLinear16MonoWav(beforeBytes);
    const after = parseLinear16MonoWav(afterBytes);
    if (before.sampleRate !== after.sampleRate
        || before.channels !== after.channels
        || before.bitsPerSample !== after.bitsPerSample
        || before.blockAlign !== after.blockAlign) {
        throw new Error("看圖補句前後語音的 WAV 取樣格式不一致");
    }
    const silenceFrames = Math.round(before.sampleRate * gapMs / 1000);
    const silenceBytes = silenceFrames * before.blockAlign;
    const pcm = new Uint8Array(before.data.length + silenceBytes + after.data.length);
    pcm.set(before.data, 0);
    pcm.set(after.data, before.data.length + silenceBytes);
    const durationMs = Math.round((pcm.length / before.blockAlign) * 1000 / before.sampleRate);
    return {
        bytes: buildPcmWav(pcm, before.sampleRate, before.channels, before.bitsPerSample),
        durationMs
    };
};
