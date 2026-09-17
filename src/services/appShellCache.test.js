import {
    clearAppShellCache,
    readAppShellCache,
    readAppShellCacheEntry,
    writeAppShellCache
} from "./appShellCache";

describe("appShellCache", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("returns a user-scoped entry while it is fresh", () => {
        writeAppShellCache("student-a", "catalog", [{ id: "workbook-1" }]);

        expect(readAppShellCache("student-a", "catalog", 60_000)).toEqual([{ id: "workbook-1" }]);
        expect(readAppShellCache("student-b", "catalog", 60_000)).toBeNull();
    });

    it("does not return expired entries", () => {
        writeAppShellCache("student-a", "notifications", [{ id: 1 }]);
        Date.now.mockReturnValue(1_060_001);

        expect(readAppShellCache("student-a", "notifications", 60_000)).toBeNull();
    });

    it("can reuse stale display data while a background refresh starts", () => {
        writeAppShellCache("student-a", "gamification", { level: 2 });
        Date.now.mockReturnValue(1_120_000);

        expect(readAppShellCacheEntry("student-a", "gamification", {
            freshForMs: 60_000,
            keepForMs: 24 * 60 * 60 * 1000
        })).toMatchObject({
            value: { level: 2 },
            isStale: true
        });
    });

    it("clears only the signed-out user's app shell entries", () => {
        writeAppShellCache("student-a", "catalog", [{ id: "workbook-1" }]);
        writeAppShellCache("student-b", "catalog", [{ id: "workbook-2" }]);

        clearAppShellCache("student-a");

        expect(readAppShellCache("student-a", "catalog", 60_000)).toBeNull();
        expect(readAppShellCache("student-b", "catalog", 60_000)).toEqual([{ id: "workbook-2" }]);
    });
});
