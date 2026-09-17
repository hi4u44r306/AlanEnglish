import { callEdgeFunction } from "./edgeFunctionClient";
import { getGamificationLeaderboard, getGamificationSummary } from "./gamificationService";

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
