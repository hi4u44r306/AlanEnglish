import { callEdgeFunction } from "./edgeFunctionClient";
import { getBirthdayRewardSettings, saveBirthdayRewardSettings, getGamificationLeaderboard, getGamificationSummary } from "./gamificationService";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("getGamificationSummary", () => {
    beforeEach(() => jest.clearAllMocks());

    it("shares one in-flight summary request between the persistent navbar and page", async () => {
        let resolveSummary;
        callEdgeFunction.mockReturnValueOnce(new Promise(resolve => {
            resolveSummary = resolve;
        }));
        const firebaseUser = { uid: "student-1" };

        const navbarRequest = getGamificationSummary(firebaseUser);
        const pageRequest = getGamificationSummary(firebaseUser);

        expect(callEdgeFunction).toHaveBeenCalledTimes(1);
        resolveSummary({ balance: { level: 3 } });
        await expect(Promise.all([navbarRequest, pageRequest])).resolves.toEqual([
            { balance: { level: 3 } },
            { balance: { level: 3 } }
        ]);
    });
});

test("排行榜會將班級或綜合範圍交給驗證後端", async () => {
    callEdgeFunction.mockResolvedValue({ leaderboard: [] });
    const firebaseUser = { uid: "student-1" };

    await getGamificationLeaderboard(firebaseUser, "month", null, "overall");

    expect(callEdgeFunction).toHaveBeenCalledWith("gamification", firebaseUser, {
        action: "leaderboard",
        period: "month",
        class_code: null,
        scope: "overall"
    });
});

test("birthday admin settings use only authenticated settings actions", async () => {
    jest.clearAllMocks(); callEdgeFunction.mockResolvedValue({ settings: {} });
    const user = { uid: "admin-1" };
    await getBirthdayRewardSettings(user);
    await saveBirthdayRewardSettings(user, { gift_points: 100, enabled: true, version: 1 });
    expect(callEdgeFunction).toHaveBeenNthCalledWith(1, "gamification", user, { action: "admin_birthday_settings" });
    expect(callEdgeFunction).toHaveBeenNthCalledWith(2, "gamification", user, { action: "admin_save_birthday_settings", settings: { gift_points: 100, enabled: true, version: 1 } });
});
