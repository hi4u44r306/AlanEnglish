import {
    groupSelectedTracks,
    mergeTrackIds,
    removeTrackIds
} from "./assignmentTrackSelection";

describe("assignment track selection", () => {
    const workbook = { id: 1, name: "Workbook 1" };
    const reader = { id: 2, name: "Super Easy Reading 1" };
    const tracks = [
        { id: 11, page: "P22", book: workbook },
        { id: 12, page: "P23", book: workbook },
        { id: 21, page: "Unit 1", book: reader },
        { id: 22, page: "Unit 2", book: reader }
    ];

    test("切換教材後會累加音檔且不重複", () => {
        expect(mergeTrackIds([11, 12], [12, 21, 22])).toEqual([11, 12, 21, 22]);
    });

    test("已選音檔依教材分組", () => {
        const groups = groupSelectedTracks(tracks, [11, 12, 21, 22]);

        expect(groups).toHaveLength(2);
        expect(groups[0].book.name).toBe("Workbook 1");
        expect(groups[0].tracks.map(track => track.page)).toEqual(["P22", "P23"]);
        expect(groups[1].book.name).toBe("Super Easy Reading 1");
        expect(groups[1].tracks.map(track => track.page)).toEqual(["Unit 1", "Unit 2"]);
    });

    test("只清除目前教材時保留其他教材音檔", () => {
        expect(removeTrackIds([11, 12, 21, 22], [11, 12])).toEqual([21, 22]);
    });
});
