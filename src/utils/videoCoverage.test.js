import { createVideoCoverage } from "./videoCoverage";
import { getTrackVideoSegment } from "../constants/workbookVideoChapters";

describe("createVideoCoverage", () => {
    it("only counts time that was actually played", () => {
        const coverage = createVideoCoverage(100, 200);
        for (let second = 100; second < 150; second += 1) coverage.step(second, second + 1);
        expect(coverage.ratio()).toBeCloseTo(0.5);
        coverage.step(150, 195); // 拖曳跳過，不算
        expect(coverage.ratio()).toBeCloseTo(0.5);
        for (let second = 120; second < 140; second += 1) coverage.step(second, second + 1); // 重看，不重複算
        expect(coverage.ratio()).toBeCloseTo(0.5);
        coverage.step(140, 130); // 倒退，不算
        for (let second = 150; second < 182; second += 1) coverage.step(second, second + 1);
        expect(coverage.ratio()).toBeGreaterThanOrEqual(0.8);
    });

    it("ignores time outside the page's part of the video", () => {
        const coverage = createVideoCoverage(100, 110);
        coverage.step(98, 100);
        coverage.step(110, 112);
        expect(coverage.watchedSeconds()).toBe(0);
    });
});

describe("getTrackVideoSegment", () => {
    it("runs from this page's chapter to the next chapter", () => {
        expect(getTrackVideoSegment("Workbook_3", "P4")).toEqual({ videoId: "zqgkmTWoTYc", start: 0, end: 112 });
        expect(getTrackVideoSegment("Workbook_3", "P106")).toEqual({ videoId: "zqgkmTWoTYc", start: 6542, end: null });
        expect(getTrackVideoSegment("Workbook_3", "P999")).toBeNull();
        expect(getTrackVideoSegment("Unknown", "P4")).toBeNull();
    });
});
