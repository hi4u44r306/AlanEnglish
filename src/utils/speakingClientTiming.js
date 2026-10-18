// 口說評分各步驟實際花多久，用來決定要不要換更快的辨識模型。只記秒數與粗略的裝置類型，
// 不含姓名、錄音或辨識文字。送評分與再確認的往返時間要等回應才知道，所以附在下一次送評分時一起送。
const previous = { submitMs: null, recheckMs: null };

const whole = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.round(Number(value)) : null;

export const recordSpeakingRoundTrip = (kind, ms) => {
    if (kind === "submit") previous.submitMs = whole(ms);
    if (kind === "recheck") previous.recheckMs = whole(ms);
};

const platform = () => {
    const agent = typeof navigator === "undefined" ? "" : String(navigator.userAgent || "");
    if (/iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/i.test(agent)) return "android";
    return /Windows|Macintosh|Linux|CrOS/i.test(agent) ? "desktop" : "other";
};

export const buildSpeakingClientTiming = ({ transcribeMs, inferenceMs, model, audioSeconds }) => {
    const timing = {
        v: 1,
        transcribe_ms: whole(transcribeMs),
        inference_ms: whole(inferenceMs),
        model: ["tiny", "base"].includes(model) ? model : null,
        audio_ms: whole(Number(audioSeconds) * 1000),
        platform: platform(),
        cores: typeof navigator === "undefined" ? null : whole(navigator.hardwareConcurrency),
        memory_gb: typeof navigator === "undefined" ? null : Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null,
        network: typeof navigator === "undefined" ? null : navigator.connection?.effectiveType || null,
        previous_submit_ms: previous.submitMs,
        previous_recheck_ms: previous.recheckMs
    };
    previous.recheckMs = null;
    return timing;
};
