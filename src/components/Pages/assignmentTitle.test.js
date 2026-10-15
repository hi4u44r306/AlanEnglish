import { buildAssignmentTitle, formatTitleDate, trackRangeLabel } from "./assignmentTitle";

describe("assignment title", () => {
    it("formats the date without leading zeros", () => {
        expect(formatTitleDate("2026-10-05")).toBe("10/5");
        expect(formatTitleDate("")).toBe("");
    });

    it("shows a page range from first to last track", () => {
        expect(trackRangeLabel([{ page: "P32" }, { page: "P22" }, { page: "P25" }])).toBe("P22～P32");
        expect(trackRangeLabel([{ page: "P22" }])).toBe("P22");
        expect(trackRangeLabel([{}])).toBe("");
    });

    it("builds date, class and homework", () => {
        const groups = [{ book: { name: "Workbook 1" }, tracks: [{ page: "P22" }, { page: "P32" }] }];
        expect(buildAssignmentTitle({ assignedDate: "2026-10-15", classCode: "E1", groups })).toBe("10/15 E1 Workbook 1 P22～P32");
    });

    it("lists several books", () => {
        const groups = [
            { book: { name: "Workbook 1" }, tracks: [{ page: "P22" }] },
            { book: { name: "Basic Reading" }, tracks: [{ page: "Track 3" }, { page: "Track 5" }] }
        ];
        expect(buildAssignmentTitle({ assignedDate: "2026-10-15", classCode: "E3", groups })).toBe("10/15 E3 Workbook 1 P22 Basic Reading Track 3～Track 5");
    });

    it("stays empty until a class is chosen", () => {
        expect(buildAssignmentTitle({ assignedDate: "2026-10-15", classCode: "", groups: [] })).toBe("");
    });

    it("works with only date and class", () => {
        expect(buildAssignmentTitle({ assignedDate: "2026-10-15", classCode: "E1", groups: [] })).toBe("10/15 E1");
    });
});
