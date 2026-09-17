import { callEdgeFunction } from "./edgeFunctionClient";
import { getGamificationSummary } from "./gamificationService";

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
