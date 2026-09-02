import {
    getCoveredSeconds,
    isNaturalListeningInterval,
    mergeCoverageRange
} from "./listeningCoverage";

test("延遲十秒才回報仍會計入正常連續播放", () => {
    expect(isNaturalListeningInterval({
        start: 20,
        end: 30,
        elapsedSeconds: 10.1,
        playbackRate: 1,
        isSeeking: false,
        isVisible: true,
        attentionBlocked: false
    })).toBe(true);
});

test("短時間跳轉大量秒數會被視為拖曳", () => {
    expect(isNaturalListeningInterval({
        start: 20,
        end: 55,
        elapsedSeconds: 1,
        playbackRate: 1,
        isSeeking: false,
        isVisible: true,
        attentionBlocked: false
    })).toBe(false);
});

test("背景、拖曳、加速及注意力阻擋都不會計入", () => {
    const baseline = {
        start: 20,
        end: 21,
        elapsedSeconds: 1,
        playbackRate: 1,
        isSeeking: false,
        isVisible: true,
        attentionBlocked: false
    };

    expect(isNaturalListeningInterval({ ...baseline, isVisible: false })).toBe(false);
    expect(isNaturalListeningInterval({ ...baseline, isSeeking: true })).toBe(false);
    expect(isNaturalListeningInterval({ ...baseline, playbackRate: 1.25 })).toBe(false);
    expect(isNaturalListeningInterval({ ...baseline, attentionBlocked: true })).toBe(false);
});

test("重疊區段合併後不會重複增加覆蓋秒數", () => {
    const ranges = mergeCoverageRange([[0, 30]], [20, 45]);
    expect(ranges).toEqual([[0, 45]]);
    expect(getCoveredSeconds(ranges)).toBe(45);
});

