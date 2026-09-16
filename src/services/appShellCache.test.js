import { readAppShellCache, writeAppShellCache } from "./appShellCache";

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
});
