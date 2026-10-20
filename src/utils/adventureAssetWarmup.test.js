import { canWarmAdventureAssets, resetAdventureAssetWarmupForTests, warmAdventureAssets } from "./adventureAssetWarmup";

const setConnection = value => Object.defineProperty(navigator, "connection", { value, configurable: true });

describe("adventure asset warm-up", () => {
    afterEach(() => { setConnection(undefined); resetAdventureAssetWarmupForTests(); delete window.requestIdleCallback; });

    it("is allowed on a normal connection and on browsers without the Network Information API", () => {
        setConnection(undefined);
        expect(canWarmAdventureAssets()).toBe(true);
        setConnection({ effectiveType: "4g", saveData: false });
        expect(canWarmAdventureAssets()).toBe(true);
    });

    it("never runs on data saver or a slow connection", () => {
        setConnection({ effectiveType: "4g", saveData: true });
        expect(canWarmAdventureAssets()).toBe(false);
        setConnection({ effectiveType: "3g", saveData: false });
        expect(canWarmAdventureAssets()).toBe(false);
    });

    it("schedules the work only once and does nothing when it is not allowed", () => {
        const idle = jest.fn();
        window.requestIdleCallback = idle;
        setConnection({ effectiveType: "2g" });
        warmAdventureAssets();
        expect(idle).not.toHaveBeenCalled();

        setConnection({ effectiveType: "4g" });
        warmAdventureAssets();
        warmAdventureAssets();
        expect(idle).toHaveBeenCalledTimes(1);
    });
});
