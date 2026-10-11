import { getTrackVideoUrl } from "./workbookVideoChapters";

test("links a workbook track to its page inside the lesson video", () => {
    expect(getTrackVideoUrl("Workbook_1", "P22")).toBe("https://www.youtube.com/watch?v=IgMCnPvCHyI&t=233s");
    expect(getTrackVideoUrl("Workbook_2", "P8 Question")).toBe(getTrackVideoUrl("Workbook_2", "p8question"));
    expect(getTrackVideoUrl("Workbook_4", "P21-2")).toMatch(/v=Dr2G4S_0Htw&t=\d+s$/);
});

test("gives no link when the video has no chapter for that page or book", () => {
    expect(getTrackVideoUrl("Workbook_1", "P23")).toBeNull();
    expect(getTrackVideoUrl("Workbook_5", "P2")).toBeNull();
    expect(getTrackVideoUrl("BasicReading_400_1", "Track 1")).toBeNull();
    expect(getTrackVideoUrl("Workbook_1", "")).toBeNull();
});
