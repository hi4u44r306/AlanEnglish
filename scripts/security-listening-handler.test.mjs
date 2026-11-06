// Runs the real record-play Edge handler against an in-memory fake Supabase client.
// No credentials, network or database are used. RECORD_PLAY_SOURCE may point to another
// copy of the handler (used to confirm these tests fail against the previous code).
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const sourcePath = process.env.RECORD_PLAY_SOURCE
    || new URL("../supabase/functions/record-play/index.ts", import.meta.url);
const source = stripTypeScriptTypes(readFileSync(sourcePath, "utf8").replace(/^import[\s\S]*?;\r?\n/gm, ""));
const SESSION = "11111111-1111-4111-8111-111111111111";

function harness({ trackDuration = null, sessionAgeSeconds = 0, sessionDuration = 60, sessionStudent = 1,
    sessionCompleted = false, accessActive = true } = {}) {
    let handler;
    const calls = [];
    const tables = {
        students: [{ id: 1, firebase_uid: "fixture-uid", role: "student", class: "E3", learner_type: "academy_student" }],
        student_feature_rollouts: [{ student_id: 1, feature_key: "listening_rewards_v2", enabled: true }],
        music_tracks: [{ id: 7, book_id: 5, enabled: true, duration_seconds: trackDuration, books: { id: 5, content_scope: "formal" } }],
        listening_coverage_sessions: [{
            id: SESSION, student_id: sessionStudent, track_id: 7, duration_seconds: sessionDuration,
            started_at: new Date(Date.now() - sessionAgeSeconds * 1000).toISOString(),
            completed_at: sessionCompleted ? new Date().toISOString() : null,
            count_recorded: sessionCompleted, eligible_for_count: true, reward_policy_version: 3
        }],
        student_activity_events: []
    };
    const admin = {
        from(table) {
            const filters = [];
            let operation = "select", payload = null, one = false;
            const q = {
                select() { return q; }, is() { return q; }, lte() { return q; }, or() { return q; },
                order() { return q; }, limit() { return q; }, in() { return q; },
                eq(key, value) { filters.push(row => row[key] === value); return q; },
                maybeSingle() { one = true; return q; }, single() { one = true; return q; },
                insert(value) { operation = "insert"; payload = value; return q; },
                update(value) { operation = "update"; payload = value; return q; },
                then(resolve, reject) {
                    const rows = tables[table] || (tables[table] = []);
                    let data;
                    if (operation === "insert") {
                        const row = { id: "inserted", started_at: new Date().toISOString(), ...payload };
                        rows.push(row); data = row;
                        calls.push({ insert: table, payload });
                    } else {
                        const matched = rows.filter(row => filters.every(fn => fn(row)));
                        if (operation === "update") {
                            matched.forEach(row => Object.assign(row, payload));
                            calls.push({ update: table, payload });
                        }
                        data = one ? matched[0] || null : matched;
                    }
                    return Promise.resolve({ data, error: null }).then(resolve, reject);
                }
            };
            return q;
        },
        async rpc(name, args) {
            calls.push({ rpc: name, args });
            if (name === "get_student_effective_access") {
                return { data: { is_active: accessActive, features: { listening: accessActive, requires_book_entitlement: false }, plan_codes: [] }, error: null };
            }
            if (name === "start_listening_reward_session_v3") {
                return { data: { id: "new-session", duration_seconds: args.p_duration_seconds, started_at: new Date().toISOString() }, error: null };
            }
            return { data: { play_count: 1, policy_version: 3 }, error: null };
        }
    };
    vm.runInNewContext(source, {
        Request, Response, URL, Date, JSON, Math, Number, String, Array, Object, Promise, Error,
        console: { error() {}, warn() {} },
        createClient: () => admin,
        createRemoteJWKSet: () => ({}),
        jwtVerify: async () => ({ payload: { sub: "fixture-uid" } }),
        loadEffectiveAccess: async (client, id) => (await client.rpc("get_student_effective_access", { p_student_id: id })).data,
        Deno: { env: { get: () => "isolated-placeholder" }, serve: fn => { handler = fn; } }
    });
    const call = body => handler(new Request("https://isolated.invalid", {
        method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify(body)
    }));
    return { calls, tables, call };
}

const start = duration => ({ track_id: 7, action: "start", duration_seconds: duration });
const complete = (ranges, sessionId = SESSION) => ({
    track_id: 7, action: "complete",
    listening_session: { session_id: sessionId, coverage_ranges: ranges, used_accelerated_playback: false }
});
const settled = calls => calls.some(call => call.rpc === "complete_listening_reward_session_v3");

test("a track without stored duration refuses client durations under 15 seconds", async () => {
    for (const duration of [1, 5, 14.99]) {
        const run = harness();
        const response = await run.call(start(duration));
        assert.equal(response.status, 400, `duration ${duration}`);
        assert.equal((await response.json()).code, "duration_too_short");
        assert.ok(!run.calls.some(call => call.rpc === "start_listening_reward_session_v3"));
    }
    const ok = harness();
    assert.equal((await ok.call(start(15))).status, 200);
    assert.equal(ok.calls.find(call => call.rpc === "start_listening_reward_session_v3").args.p_duration_seconds, 15);
});

test("a stored track duration always wins over the client value", async () => {
    const run = harness({ trackDuration: 60 });
    assert.equal((await run.call(start(1))).status, 200);
    assert.equal(run.calls.find(call => call.rpc === "start_listening_reward_session_v3").args.p_duration_seconds, 60);
});

test("a genuine 60 s track with pauses is counted", async () => {
    // Paused for 15 s in the middle: 75 s of wall time, 60 s heard.
    const paused = harness({ sessionAgeSeconds: 75 });
    const response = await paused.call(complete([[0, 20], [20.1, 60]]));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).counted, true);
    assert.ok(settled(paused.calls));
    // No pauses, and the start request reached the server 3 s after playback began.
    const delayed = harness({ sessionAgeSeconds: 57 });
    assert.equal((await delayed.call(complete([[0, 60]]))).status, 200);
    assert.ok(settled(delayed.calls));
});

test("full coverage claimed far too fast is refused", async () => {
    const quick = harness({ sessionAgeSeconds: 30 });
    const response = await quick.call(complete([[0, 60]]));
    assert.equal(response.status, 400);
    assert.ok(!settled(quick.calls));
    assert.equal(quick.tables.listening_coverage_sessions[0].ineligibility_reason, "elapsed_time_too_short");
    // 300 s track claimed after 230 s: the old 0.75 floor (225 s) let this through.
    const longTrack = harness({ sessionDuration: 300, sessionAgeSeconds: 230 });
    assert.equal((await longTrack.call(complete([[0, 300]]))).status, 400);
    assert.ok(!settled(longTrack.calls));
});

test("another student's session is refused", async () => {
    const run = harness({ sessionStudent: 2, sessionAgeSeconds: 120 });
    assert.equal((await run.call(complete([[0, 60]]))).status, 409);
    assert.ok(!settled(run.calls));
});

test("a completed session returns 409", async () => {
    const run = harness({ sessionCompleted: true, sessionAgeSeconds: 120 });
    assert.equal((await run.call(complete([[0, 60]]))).status, 409);
    assert.ok(!settled(run.calls));
});

test("an archived student is refused once effective access reports inactive (needs the migration)", async () => {
    const run = harness({ accessActive: false, trackDuration: 60 });
    const response = await run.call(start(60));
    assert.equal(response.status, 402);
    assert.equal((await response.json()).code, "membership_required");
    assert.ok(!run.calls.some(call => call.rpc === "start_listening_reward_session_v3"));
});
