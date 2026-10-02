import assert from "node:assert/strict";
import test from "node:test";
import { assessmentAudioSeconds, assessmentBudgetError } from "../supabase/functions/_shared/speaking-assessment-budget.ts";
import { runSpeakingPronunciationFlow } from "../supabase/functions/_shared/speaking-pronunciation-flow.ts";

test("server duration rounds up and rejects invalid audio, never trusting a client claim", () => {
    assert.equal(assessmentAudioSeconds(0.35), 1);
    assert.equal(assessmentAudioSeconds(6.01), 7);
    assert.equal(assessmentAudioSeconds(12), 12);
    for (const duration of [0,0.34,12.01,NaN,Infinity]) assert.throws(() => assessmentAudioSeconds(duration));
});
test("quota denial occurs before Azure or saving progress and releases A-Z claim", async () => {
    let providerCalls = 0;
    let saves = 0;
    let released = false;
    const error = assessmentBudgetError({ code: "speaking_monthly_quota_reached", assessment_usage: { can_assess: false } });
    await assert.rejects(runSpeakingPronunciationFlow({
        foundationRound: true,
        claim: async () => ({ status: "claimed", claimToken: "claim" }),
        reserve: async () => { throw error; },
        assess: async () => { providerCalls++; return { ok: true, value: {} }; },
        saveAndRecordRound: async () => { saves++; return {}; },
        releaseClaim: async () => { released = true; return true; },
        finishRequest: async () => { throw new Error("no request was reserved"); }
    }), cause => cause === error && cause.status === 429 && cause.assessment_usage.can_assess === false);
    assert.equal(providerCalls,0);
    assert.equal(saves,0);
    assert.equal(released,true);
});
