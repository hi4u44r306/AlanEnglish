import assert from "node:assert/strict";
import test from "node:test";
import { runSpeakingPronunciationFlow } from "../supabase/functions/_shared/speaking-pronunciation-flow.ts";

const baseOptions = events => ({
    foundationRound: true,
    claim: async () => { events.push("claim"); return { status: "claimed", claimToken: "claim-1" }; },
    reserve: async () => { events.push("reserve"); return "request-1"; },
    assess: async () => { events.push("assess"); return { ok: true, value: { answer_match: true } }; },
    saveAndRecordRound: async (_value, token) => {
        events.push(`save-and-record:${token}`);
        return { attempt: 41, round: { status: "open" } };
    },
    finishRequest: async (_id, status) => { events.push(`finish:${status}`); },
    releaseClaim: async token => { events.push(`release:${token}`); return true; },
    warn: message => events.push(`warn:${message}`)
});

test("busy claim stops before quota reservation, provider call, and attempt insert", async () => {
    const events = [];
    const options = baseOptions(events);
    options.claim = async () => { events.push("claim"); return { status: "busy", retryAfterSeconds: 8 }; };
    const result = await runSpeakingPronunciationFlow(options);
    assert.deepEqual(result, { status: "busy", retryAfterSeconds: 8 });
    assert.deepEqual(events, ["claim"]);
});

test("provider failure finalizes its ledger and releases the claim without saving progress", async () => {
    const events = [];
    const options = baseOptions(events);
    options.assess = async () => {
        events.push("assess");
        return {
            ok: false,
            failure: { status: 504, code: "provider_timeout" },
            ledgerStatus: "provider_failed",
            errorCode: "timeout"
        };
    };
    const result = await runSpeakingPronunciationFlow(options);
    assert.deepEqual(result, { status: "provider_failure", failure: { status: 504, code: "provider_timeout" } });
    assert.deepEqual(events, ["claim", "reserve", "assess", "finish:provider_failed", "release:claim-1"]);
});

test("successful foundation assessment persists attempt and round before completing the ledger", async () => {
    const events = [];
    const result = await runSpeakingPronunciationFlow(baseOptions(events));
    assert.equal(result.status, "completed");
    assert.deepEqual(events, [
        "claim", "reserve", "assess", "save-and-record:claim-1", "finish:completed"
    ]);
});

test("atomic attempt and round failure rolls back together, releases claim, and marks ledger internal_failed", async () => {
    const events = [];
    const options = baseOptions(events);
    options.saveAndRecordRound = async () => {
        events.push("save-and-record:error");
        throw Object.assign(new Error("db unavailable"), { code: "round_write_failed" });
    };
    await assert.rejects(runSpeakingPronunciationFlow(options), /db unavailable/);
    assert.deepEqual(events, [
        "claim", "reserve", "assess", "save-and-record:error", "release:claim-1", "finish:internal_failed"
    ]);
});

test("round success remains successful when only ledger completion needs later reconciliation", async () => {
    const events = [];
    const options = baseOptions(events);
    options.finishRequest = async (_id, status) => {
        events.push(`finish:${status}`);
        if (status === "completed") throw new Error("ledger unavailable");
    };
    const result = await runSpeakingPronunciationFlow(options);
    assert.equal(result.status, "completed");
    assert.equal(events.some(event => event.startsWith("warn:Pronunciation request ledger completion failed")), true);
    assert.equal(events.includes("finish:internal_failed"), false);
});

test("internal failure before an attempt releases claim and finalizes the reserved request", async () => {
    const events = [];
    const options = baseOptions(events);
    options.saveAndRecordRound = async () => { events.push("save-and-record:error"); throw new Error("insert failed"); };
    await assert.rejects(runSpeakingPronunciationFlow(options), /insert failed/);
    assert.deepEqual(events, [
        "claim", "reserve", "assess", "save-and-record:error", "release:claim-1", "finish:internal_failed"
    ]);
});

test("standard speaking success skips foundation callbacks and persists one attempt", async () => {
    const events = [];
    const result = await runSpeakingPronunciationFlow({
        foundationRound: false,
        reserve: async () => { events.push("reserve"); return "request-2"; },
        assess: async () => { events.push("assess"); return { ok: true, value: { answer_match: true } }; },
        saveAttempt: async value => { events.push(`save:${value.answer_match}`); return 72; },
        finishRequest: async (_id, status) => { events.push(`finish:${status}`); }
    });
    assert.deepEqual(result, {
        status: "completed",
        value: { answer_match: true },
        attempt: 72,
        round: null
    });
    assert.deepEqual(events, ["reserve", "assess", "save:true", "finish:completed"]);
});
