import { callEdgeFunction } from "./edgeFunctionClient";
import { getSpeakingChallengeSet, prefetchSpeakingChallengeSet } from "./speakingChallengeService";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));
jest.mock("./studentPageCache", () => ({ invalidateStudentPageCache: jest.fn() }));

const user = { uid: "s1" };
afterEach(() => { jest.clearAllMocks(); jest.restoreAllMocks(); });

test("關卡摘要先讀好的題目，進入關卡時直接使用且只用一次", async () => {
    callEdgeFunction.mockResolvedValueOnce({ challenge: { id: 7 } }).mockResolvedValueOnce({ challenge: { id: 7, fresh: true } });
    prefetchSpeakingChallengeSet(user, 7, "easy");
    prefetchSpeakingChallengeSet(user, 7, "easy");
    expect(callEdgeFunction).toHaveBeenCalledTimes(1);
    expect(await getSpeakingChallengeSet(user, 7, "easy")).toEqual({ challenge: { id: 7 } });
    expect(await getSpeakingChallengeSet(user, 7, "easy")).toEqual({ challenge: { id: 7, fresh: true } });
    expect(callEdgeFunction).toHaveBeenCalledTimes(2);
});

test("不同等級、不同學生或超過 60 秒都重新讀取", async () => {
    callEdgeFunction.mockResolvedValue({ challenge: { id: 8 } });
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    prefetchSpeakingChallengeSet(user, 8, "easy");
    await getSpeakingChallengeSet(user, 8, "challenge");
    await getSpeakingChallengeSet({ uid: "s2" }, 8, "easy");
    now.mockReturnValue(1000 + 61000);
    await getSpeakingChallengeSet(user, 8, "easy");
    expect(callEdgeFunction).toHaveBeenCalledTimes(4);
});
