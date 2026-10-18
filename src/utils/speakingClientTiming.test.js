import { buildSpeakingClientTiming, recordSpeakingRoundTrip } from "./speakingClientTiming";

describe("speakingClientTiming", () => {
    it("只記數字與固定選項，往返時間附在下一次", () => {
        recordSpeakingRoundTrip("submit", 812.4);
        recordSpeakingRoundTrip("recheck", 2400);
        const timing = buildSpeakingClientTiming({ transcribeMs: 3210.6, inferenceMs: 2900, model: "base", audioSeconds: 2.5 });
        expect(timing).toMatchObject({ v: 1, transcribe_ms: 3211, inference_ms: 2900, model: "base", audio_ms: 2500,
            previous_submit_ms: 812, previous_recheck_ms: 2400 });
        expect(["ios", "android", "desktop", "other"]).toContain(timing.platform);
        expect(buildSpeakingClientTiming({ model: "huge" })).toMatchObject({ model: null, transcribe_ms: null, previous_recheck_ms: null });
    });
});
