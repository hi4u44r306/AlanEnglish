import { callEdgeFunction } from "./edgeFunctionClient";
import { WORD_CHALLENGE_TIMEOUT_MS, getWordChallengeSummary, finishWordChallengeRound } from "./wordChallengeService";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

beforeEach(() => {
    callEdgeFunction.mockReset();
    jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test("calls the word-challenge function with the right action and student", async () => {
    callEdgeFunction.mockResolvedValue({ mode: "server" });
    await expect(getWordChallengeSummary({ uid: "u1" })).resolves.toEqual({ mode: "server" });
    expect(callEdgeFunction).toHaveBeenCalledWith("word-challenge", { uid: "u1" }, { action: "summary" });
    await finishWordChallengeRound({ uid: "u1" }, "round-1");
    expect(callEdgeFunction).toHaveBeenLastCalledWith("word-challenge", { uid: "u1" }, { action: "finish", round_id: "round-1" });
});

test("a call that never answers fails with code timeout instead of waiting forever", async () => {
    callEdgeFunction.mockReturnValue(new Promise(() => {}));
    const pending = getWordChallengeSummary({ uid: "u1" });
    const outcome = pending.then(() => "resolved", error => error.code);
    jest.advanceTimersByTime(WORD_CHALLENGE_TIMEOUT_MS + 1);
    await expect(outcome).resolves.toBe("timeout");
});

test("errors from the server pass through unchanged", async () => {
    const failure = Object.assign(new Error("過期"), { status: 409, code: "round_expired" });
    callEdgeFunction.mockRejectedValue(failure);
    await expect(finishWordChallengeRound({ uid: "u1" }, "r")).rejects.toBe(failure);
});
