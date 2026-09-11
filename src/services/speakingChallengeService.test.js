import { callEdgeFunction } from "./edgeFunctionClient";
import { clearSpeakingChallengeCatalogCache, completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, prefetchSpeakingChallengeCatalog } from "./speakingChallengeService";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("speakingChallengeService catalog cache", () => {
    const firebaseUser = { uid: "student-1" };

    beforeEach(() => {
        clearSpeakingChallengeCatalogCache();
        callEdgeFunction.mockReset();
    });

    it("shares the login prefetch with the page request", async () => {
        const result = { challenges: [{ id: 1 }] };
        callEdgeFunction.mockResolvedValue(result);

        const prefetched = prefetchSpeakingChallengeCatalog(firebaseUser);
        const pageRequest = getSpeakingChallengeCatalog(firebaseUser);

        await expect(prefetched).resolves.toEqual(result);
        await expect(pageRequest).resolves.toEqual(result);
        expect(callEdgeFunction).toHaveBeenCalledTimes(1);
    });

    it("keeps failed prefetches out of the cache so the page can retry", async () => {
        callEdgeFunction.mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce({ challenges: [] });

        await expect(prefetchSpeakingChallengeCatalog(firebaseUser)).resolves.toBeNull();
        await expect(getSpeakingChallengeCatalog(firebaseUser)).resolves.toEqual({ challenges: [] });
        expect(callEdgeFunction).toHaveBeenCalledTimes(2);
    });

    it("refreshes catalog progress after a question is completed", async () => {
        const completion = {
            completed: true,
            challenge_complete: true,
            reward_granted: true,
            xp_awarded: 30,
            ae_points_awarded: 3,
        };
        callEdgeFunction
            .mockResolvedValueOnce({ challenges: [{ id: 1, completed_count: 0 }] })
            .mockResolvedValueOnce(completion)
            .mockResolvedValueOnce({ challenges: [{ id: 1, completed_count: 1 }] });

        await getSpeakingChallengeCatalog(firebaseUser);
        await expect(completeSpeakingChallengeQuestion(firebaseUser, 1, 10)).resolves.toEqual(completion);
        await expect(getSpeakingChallengeCatalog(firebaseUser)).resolves.toEqual({ challenges: [{ id: 1, completed_count: 1 }] });
        expect(callEdgeFunction).toHaveBeenCalledTimes(3);
    });
});
