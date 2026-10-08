import { submitAssignment, submitAssignmentV2Ai } from "./assignmentService";
import { completeSpeakingChallengeQuestion } from "./speakingChallengeService";
import { callEdgeFunction } from "./edgeFunctionClient";
import { clearStudentPageCache, fetchStudentPageCache, readStudentPageCache } from "./studentPageCache";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));
jest.mock("../components/Pages/supabase-config", () => ({ supabaseKey: "public-test", supabaseUrl: "https://test.invalid" }));
const user = { uid: "cache-writer", getIdToken: jest.fn().mockResolvedValue("test-only") };
const scope = "cache-writer|student|1";
beforeEach(async () => {
    clearStudentPageCache();
    localStorage.clear();
    await Promise.all(["assignments:v1", "assignments:v2", "speaking:catalog", "weekly:1:self", "summary"].map(key => fetchStudentPageCache(scope, key, () => ({ count: 1 }))));
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ progress: { completed: true } }) });
    callEdgeFunction.mockResolvedValue({ challenge_completed: true });
});
afterEach(() => { delete global.fetch; });

test.each([() => submitAssignment(user, 1, ["a"]), () => submitAssignmentV2Ai(user, 1, 2, ["a"]), () => completeSpeakingChallengeQuestion(user, 1, 2)])("a confirmed mutation refreshes dependent page snapshots", async mutate => {
    await mutate();
    expect(readStudentPageCache(scope, "assignments:v1").stale).toBe(true);
    expect(readStudentPageCache(scope, "speaking:catalog").stale).toBe(true);
    expect(readStudentPageCache(scope, "weekly:1:self").stale).toBe(true);
    expect(Object.keys(localStorage)).toHaveLength(0);
});

test("a failed submission does not count as success or invalidate confirmed data", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "denied" }) });
    await expect(submitAssignment(user, 1, ["a"])).rejects.toMatchObject({ status: 403 });
    expect(readStudentPageCache(scope, "assignments:v1").stale).toBe(false);
});
