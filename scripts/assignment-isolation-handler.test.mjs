// Behaviour tests for supabase/functions/assignment-manager/index.ts: class isolation,
// departure cut-off, teacher scoping and AI answer secrecy. The real handler runs with a
// stubbed Deno.serve and an in-memory admin client (scripts/edge-handler-harness.mjs).
// Run: node --experimental-strip-types --test scripts/assignment-isolation-handler.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadEffectiveAccess } from "../supabase/functions/_shared/effective-access.ts";
import { assignmentCopyTemplate } from "../supabase/functions/_shared/assignment-copy-template.ts";
import { callJson, createFakeAdmin, loadHandler, taipeiDate } from "./edge-handler-harness.mjs";

const YESTERDAY = taipeiDate(-1);
const TODAY = taipeiDate(0);
const TOMORROW = taipeiDate(1);
const ANSWER_SENTINEL = "EXPLANATION-SENTINEL";

const questionSnapshot = {
    title: "Fixture quiz",
    questions: [
        { question: "Q1?", options: ["apple", "banana", "cherry", "grape"], answer: "banana", explanation: `${ANSWER_SENTINEL}-1` },
        { question: "Q2?", options: ["red", "blue", "green", "pink"], answer: "green", explanation: `${ANSWER_SENTINEL}-2` }
    ]
};

const baseTables = () => ({
    students: [
        { id: 7, firebase_uid: "uid-student-e3", name: "Student E3", class: "E3", role: "student", account_status: "active" },
        { id: 8, firebase_uid: "uid-student-e1", name: "Student E1", class: "E1", role: "student", account_status: "active" },
        { id: 9, firebase_uid: "uid-student-archived", name: "Archived", class: "E3", role: "student", account_status: "archived" },
        { id: 20, firebase_uid: "uid-teacher-a", name: "Teacher A", class: null, role: "teacher", account_status: "active" },
        { id: 21, firebase_uid: "uid-teacher-b", name: "Teacher B", class: null, role: "teacher", account_status: "active" },
        { id: 30, firebase_uid: "uid-admin", name: "Admin", class: null, role: "admin", account_status: "active" }
    ],
    academy_enrollments: [
        { id: 1, student_id: 7, status: "active", scheduled_departure_at: null, academy_classes: { code: "E3" } },
        { id: 2, student_id: 8, status: "active", scheduled_departure_at: null, academy_classes: { code: "E1" } },
        { id: 3, student_id: 9, status: "active", scheduled_departure_at: null, academy_classes: { code: "E3" } }
    ],
    teacher_class_permissions: [
        { teacher_id: 20, can_publish: true, starts_at: "2020-01-01", ends_at: null, academy_classes: { code: "E3" } },
        { teacher_id: 20, can_publish: true, starts_at: "2020-01-01", ends_at: YESTERDAY, academy_classes: { code: "E1" } },
        { teacher_id: 21, can_publish: true, starts_at: "2020-01-01", ends_at: null, academy_classes: { code: "E3" } }
    ],
    assignments: [
        { id: 101, title: "E3 listening", target_class: "E3", source_type: "music_track", enabled: true, assigned_date: YESTERDAY, created_at: "2026-01-01T00:00:01Z", creator_id: 20, track_id: 501 },
        { id: 102, title: "E1 listening", target_class: "E1", source_type: "music_track", enabled: true, assigned_date: YESTERDAY, created_at: "2026-01-01T00:00:02Z", creator_id: 20, track_id: 501 },
        { id: 103, title: "E3 future", target_class: "E3", source_type: "music_track", enabled: true, assigned_date: TOMORROW, created_at: "2026-01-01T00:00:03Z", creator_id: 20, track_id: 501 },
        { id: 104, title: "E3 mission pack", target_class: "E3", source_type: "mission_pack", enabled: true, assigned_date: YESTERDAY, created_at: "2026-01-01T00:00:04Z", creator_id: 20 },
        { id: 105, title: "E3 ai", target_class: "E3", source_type: "ai_material", enabled: true, assigned_date: YESTERDAY, created_at: "2026-01-01T00:00:05Z", creator_id: 20 },
        { id: 107, title: "E3 disabled", target_class: "E3", source_type: "music_track", enabled: false, assigned_date: YESTERDAY, created_at: "2026-01-01T00:00:07Z", creator_id: 20, track_id: 501 },
        { id: 108, title: "no class", target_class: null, source_type: "music_track", enabled: true, assigned_date: YESTERDAY, created_at: "2026-01-01T00:00:08Z", creator_id: 20, track_id: 501 },
        { id: 109, title: "E3 by teacher B", target_class: "E3", source_type: "music_track", enabled: true, assigned_date: YESTERDAY, created_at: "2026-01-01T00:00:09Z", creator_id: 21, track_id: 501 },
        { id: 201, title: "E3 v2", target_class: "E3", source_type: "multi_activity_v2", schema_version: 2, enabled: true, assigned_date: YESTERDAY, due_at: null, created_at: "2026-01-02T00:00:01Z", creator_id: 20 },
        { id: 202, title: "E1 v2", target_class: "E1", source_type: "multi_activity_v2", schema_version: 2, enabled: true, assigned_date: YESTERDAY, due_at: null, created_at: "2026-01-02T00:00:02Z", creator_id: 20 },
        { id: 203, title: "E3 v2 future", target_class: "E3", source_type: "multi_activity_v2", schema_version: 2, enabled: true, assigned_date: TOMORROW, due_at: null, created_at: "2026-01-02T00:00:03Z", creator_id: 20 },
        { id: 204, title: "E3 v2 overdue", target_class: "E3", source_type: "multi_activity_v2", schema_version: 2, enabled: true, assigned_date: "2026-01-01", due_at: "2026-01-02T00:00:00.000Z", created_at: "2026-01-02T00:00:04Z", creator_id: 20 }
    ],
    assignment_track_items: [],
    music_tracks: [{ id: 501, book_id: 1, page: "P4", display_page: "P4", track_type: "main", part_number: 1 }],
    books: [{ id: 1, name: "Workbook 1", code: "W1" }],
    assignment_items: [
        { id: 301, assignment_id: 201, item_type: "ai_quiz", config: {}, sort_order: 1 },
        { id: 302, assignment_id: 202, item_type: "ai_quiz", config: {}, sort_order: 1 },
        { id: 303, assignment_id: 203, item_type: "ai_quiz", config: {}, sort_order: 1 },
        { id: 304, assignment_id: 204, item_type: "ai_quiz", config: {}, sort_order: 1 }
    ],
    assignment_ai_items: [301, 302, 303, 304].map(id => ({ assignment_item_id: id, passing_score: 80, question_snapshot: questionSnapshot })),
    assignment_pronunciation_prompts: [],
    student_assignment_item_progress: [],
    student_feature_rollouts: [7, 8, 9].map(student_id => ({ student_id, feature_key: "assignment_v2", enabled: true })),
    assignment_progress: [],
    student_track_progress: []
});

const harness = ({ uid = "uid-student-e3", mutate } = {}) => {
    const tables = baseTables();
    mutate?.(tables);
    const admin = createFakeAdmin({
        tables,
        rpc: {
            // Mirrors get_student_effective_access for an academy student with an active class grant.
            get_student_effective_access: ({ p_student_id }) => ({
                data: {
                    student_id: p_student_id, role: "student", learner_type: "academy_student", is_active: true,
                    plan_codes: ["academy_platform"], grants: [{ plan_code: "academy_platform", ends_at: null }],
                    features: { listening: true, assignments: true, review: true }
                },
                error: null
            })
        }
    });
    const call = loadHandler("assignment-manager", {
        createClient: () => admin,
        jwtVerify: async () => ({ payload: { sub: uid } }),
        loadEffectiveAccess,
        assignmentCopyTemplate
    });
    return { admin, tables, call: body => callJson(call(body)) };
};

const ids = list => list.map(item => Number(item.id)).sort((a, b) => a - b);
const setDeparture = (studentId, date) => tables => {
    tables.academy_enrollments.find(row => row.student_id === studentId).scheduled_departure_at = date;
};

// ---------------------------------------------------------------------------
// student_assignments (legacy listening list)
// ---------------------------------------------------------------------------

test("E3 student sees only enabled, already-assigned E3 music_track rows, never E1 or unclassed rows", async () => {
    const run = harness();
    const { status, body } = await run.call({ action: "student_assignments", student_class: "E1", target_class: "E1", student_id: 8 });
    assert.equal(status, 200);
    assert.equal(body.student_class, "E3");
    assert.deepEqual(ids(body.assignments), [101, 109]);
});

test("E1 student does not receive any E3 assignment", async () => {
    const { status, body } = await harness({ uid: "uid-student-e1" }).call({ action: "student_assignments" });
    assert.equal(status, 200);
    assert.deepEqual(ids(body.assignments), [102]);
});

for (const [label, date] of [["today", TODAY], ["yesterday", YESTERDAY]]) {
    test(`student whose departure date is ${label} gets an empty list on both list actions`, async () => {
        const run = harness({ mutate: setDeparture(7, date) });
        const legacy = await run.call({ action: "student_assignments" });
        assert.equal(legacy.status, 200);
        assert.deepEqual(legacy.body.assignments, []);
        assert.equal(legacy.body.student_class, null);
        const v2 = await run.call({ action: "student_assignments_v2" });
        assert.equal(v2.status, 200);
        assert.deepEqual(v2.body.assignments, []);
        assert.equal(run.admin.reads("assignment_items").length, 0, "no V2 item data is read for a departed student");
    });
}

test("student departing tomorrow still sees the class assignments", async () => {
    const { body } = await harness({ mutate: setDeparture(7, TOMORROW) }).call({ action: "student_assignments" });
    assert.deepEqual(ids(body.assignments), [101, 109]);
});

test("student without an active enrollment gets an empty list even if students.class says E3", async () => {
    const run = harness({ mutate: tables => { tables.academy_enrollments[0].status = "departed"; } });
    const { status, body } = await run.call({ action: "student_assignments" });
    assert.equal(status, 200);
    assert.deepEqual(body.assignments, []);
});

test("an enrollment in a class outside E1/E3/E5/E7 is treated as no class", async () => {
    const run = harness({ mutate: tables => { tables.academy_enrollments[0].academy_classes = { code: "E2" }; } });
    const { body } = await run.call({ action: "student_assignments" });
    assert.deepEqual(body.assignments, []);
});

test("staff callers are refused on the student list actions", async () => {
    for (const uid of ["uid-teacher-a", "uid-admin"]) {
        for (const action of ["student_assignments", "student_assignments_v2", "submit_assignment_v2_ai"]) {
            const { status } = await harness({ uid }).call({ action, assignment_id: 201, assignment_item_id: 301, answers: ["banana", "green"] });
            assert.equal(status, 403, `${uid} ${action}`);
        }
    }
});

// Fixed on fix/security-before-launch: assignment-manager now checks students.account_status
// itself (it previously failed with 200). The fake RPC models the SQL as deployed at 9bec529c,
// so this passes only because of the Edge-side check.
test("archived student is refused by the Edge Function itself", async () => {
    const run = harness({ uid: "uid-student-archived" });
    for (const action of ["student_assignments", "student_assignments_v2"]) {
        const { status } = await run.call({ action });
        assert.ok([402, 403].includes(status), `${action} returned ${status}`);
    }
});

// Depends on the pending migration 20261106090300_security_effective_access_archived.sql (another
// agent's change): once get_student_effective_access returns is_active=false for an archived
// account, the existing membership gate (L595-597) must refuse before any assignment read.
test("archived student is refused when effective access reports inactive (pending SQL fix)", async () => {
    const run = harness({ uid: "uid-student-archived" });
    const archivedRpc = createFakeAdmin({ tables: run.tables, rpc: {
        get_student_effective_access: ({ p_student_id }) => ({ data: { student_id: p_student_id, role: "student", learner_type: "academy_student", is_active: false, plan_codes: [], grants: [], features: {} }, error: null })
    } });
    const call = loadHandler("assignment-manager", { createClient: () => archivedRpc, jwtVerify: async () => ({ payload: { sub: "uid-student-archived" } }), loadEffectiveAccess, assignmentCopyTemplate });
    for (const action of ["student_assignments", "student_assignments_v2", "submit_assignment_v2_ai"]) {
        const { status, body } = await callJson(call({ action, assignment_id: 201, assignment_item_id: 301, answers: ["banana", "green"] }));
        // The Edge account_status check (403 ACCOUNT_ARCHIVED) now refuses first; the SQL gate
        // (402 membership_required) stays as a second layer.
        assert.ok([402, 403].includes(status), `${action} returned ${status}`);
        assert.ok(["membership_required", "ACCOUNT_ARCHIVED"].includes(body.code), action);
    }
    assert.equal(archivedRpc.reads("assignments").length, 0);
});

// ---------------------------------------------------------------------------
// student_assignments_v2 and answer secrecy
// ---------------------------------------------------------------------------

test("V2 list returns only the student's class, excludes future assigned_date, and never exposes answers or explanations", async () => {
    const run = harness();
    const { status, body, text } = await run.call({ action: "student_assignments_v2" });
    assert.equal(status, 200);
    assert.deepEqual(ids(body.assignments), [201, 204]);
    assert.ok(!text.includes(ANSWER_SENTINEL), "explanation text leaked to the student list");
    for (const assignment of body.assignments) {
        for (const activity of assignment.activities) {
            assert.ok(activity.ai, "fixture AI item is present");
            assert.deepEqual(Object.keys(activity.ai).sort(), ["passing_score", "questions", "title"]);
            for (const question of activity.ai.questions) {
                assert.deepEqual(Object.keys(question).sort(), ["options", "question"]);
            }
        }
    }
});

test("V2 list is empty for a student without the rollout", async () => {
    const run = harness({ mutate: tables => { tables.student_feature_rollouts = []; } });
    const { body } = await run.call({ action: "student_assignments_v2" });
    assert.deepEqual(body.assignments, []);
    assert.equal(body.rollout_enabled, false);
});

// ---------------------------------------------------------------------------
// submit_assignment_v2_ai
// ---------------------------------------------------------------------------

const submit = (run, extra = {}) => run.call({ action: "submit_assignment_v2_ai", assignment_id: 201, assignment_item_id: 301, answers: ["banana", "green"], ...extra });

test("submitting another class's V2 assignment is 403 and writes nothing", async () => {
    const run = harness();
    const { status, text } = await submit(run, { assignment_id: 202, assignment_item_id: 302 });
    assert.equal(status, 403);
    assert.ok(!text.includes(ANSWER_SENTINEL));
    assert.equal(run.admin.writes("student_assignment_item_progress").length, 0);
});

test("an item that belongs to a different assignment is 404 and writes nothing", async () => {
    const run = harness();
    const { status, text } = await submit(run, { assignment_id: 201, assignment_item_id: 302 });
    assert.equal(status, 404);
    assert.ok(!text.includes(ANSWER_SENTINEL));
    assert.equal(run.admin.writes("student_assignment_item_progress").length, 0);
});

test("answers not among the options, or an incomplete answer list, are rejected without revealing answers", async () => {
    for (const answers of [["banana"], ["banana", "not-an-option"], []]) {
        const run = harness();
        const { status, text } = await submit(run, { answers });
        assert.equal(status, 400);
        assert.ok(!text.includes(ANSWER_SENTINEL));
        assert.ok(!/correct_answer/.test(text));
    }
});

test("departed student cannot submit", async () => {
    const run = harness({ mutate: setDeparture(7, TODAY) });
    const { status } = await submit(run);
    assert.equal(status, 400);
    assert.equal(run.admin.writes("student_assignment_item_progress").length, 0);
});

test("score is computed on the server and best_score never decreases across attempts", async () => {
    const run = harness();
    const first = await submit(run, { score: 0, passed: false });
    assert.equal(first.status, 200);
    assert.equal(first.body.score, 100);
    assert.equal(first.body.passed, true);
    const worse = await submit(run, { answers: ["apple", "red"], score: 100, passed: true });
    assert.equal(worse.status, 200);
    assert.equal(worse.body.score, 0);
    assert.equal(worse.body.passed, false);
    const progress = run.tables.student_assignment_item_progress.filter(row => row.student_id === 7 && row.assignment_item_id === 301);
    assert.equal(progress.length, 1);
    assert.equal(progress[0].best_score, 100);
    assert.equal(progress[0].attempt_count, 2);
});

// KNOWN BUG: L1426-1436 writes status/completed_units/completed_at from the latest attempt only.
// A student who already passed (best_score 100) and retakes with a lower score is downgraded to
// "in_progress" with completed_at null, although best_score stays 100. Confirmed: fails with
// status "in_progress". (Product decision needed if a retake is meant to reopen the activity.)
test("a passed activity stays completed after a worse retake", { todo: "KNOWN BUG: retake downgrades completion" }, async () => {
    const run = harness();
    await submit(run);
    await submit(run, { answers: ["apple", "red"] });
    const progress = run.tables.student_assignment_item_progress.find(row => row.student_id === 7 && row.assignment_item_id === 301);
    assert.equal(progress.status, "completed");
    assert.ok(progress.completed_at);
});

// Fixed on fix/security-before-launch: submit_assignment_v2_ai now refuses a future assigned_date.
// due_at is still not enforced (late submission is a product decision), so that test stays todo.
test("an assignment not yet published (future assigned_date) cannot be submitted", async () => {
    const run = harness();
    const { status } = await submit(run, { assignment_id: 203, assignment_item_id: 303 });
    assert.equal(status, 403);
    assert.equal(run.admin.writes("student_assignment_item_progress").length, 0);
});

test("an assignment past its due_at cannot be submitted", { todo: "KNOWN BUG: due_at ignored on submit" }, async () => {
    const run = harness();
    const { status } = await submit(run, { assignment_id: 204, assignment_item_id: 304 });
    assert.equal(status, 403);
    assert.equal(run.admin.writes("student_assignment_item_progress").length, 0);
});

// Characterisation, not a pass/fail security judgement: the graded response carries
// correct_answer and explanation for every question even when the attempt failed, so one wrong
// submission reveals the full key and an unlimited retry can then score 100.
test("graded response reveals correct answers even for a failed attempt (current behaviour)", async () => {
    const run = harness();
    const { body } = await submit(run, { answers: ["apple", "red"] });
    assert.equal(body.passed, false);
    assert.deepEqual(body.results.map(result => result.correct_answer), ["banana", "green"]);
    assert.ok(body.results.every(result => result.explanation.startsWith(ANSWER_SENTINEL)));
});

// ---------------------------------------------------------------------------
// Teacher scoping: teacher_assignments, assignment_results, delete_assignment
// (Other agents are changing teacher scoping; these assert the secure intent.)
// ---------------------------------------------------------------------------

test("teacher_assignments: teacher sees only own assignments in classes with a current permission", async () => {
    const { status, body } = await harness({ uid: "uid-teacher-a" }).call({ action: "teacher_assignments", creator_id: 21, role: "admin" });
    assert.equal(status, 200);
    // 102 is E1 (permission ended yesterday), 108 has no class, 109 belongs to teacher B, 107 disabled.
    assert.deepEqual(ids(body.assignments), [101, 103, 104, 105, 201, 203, 204]);
});

test("teacher_assignments: a teacher whose only permission has ended sees nothing", async () => {
    const run = harness({ uid: "uid-teacher-b", mutate: tables => { tables.teacher_class_permissions[2].ends_at = YESTERDAY; } });
    const { body } = await run.call({ action: "teacher_assignments" });
    assert.deepEqual(body.assignments, []);
});

test("teacher_assignments: permission ending today still counts; starting tomorrow or can_publish=false does not", async () => {
    const endsToday = harness({ uid: "uid-teacher-b", mutate: tables => { tables.teacher_class_permissions[2].ends_at = TODAY; } });
    assert.deepEqual(ids((await endsToday.call({ action: "teacher_assignments" })).body.assignments), [109]);
    const startsTomorrow = harness({ uid: "uid-teacher-b", mutate: tables => { tables.teacher_class_permissions[2].starts_at = TOMORROW; } });
    assert.deepEqual((await startsTomorrow.call({ action: "teacher_assignments" })).body.assignments, []);
    const noPublish = harness({ uid: "uid-teacher-b", mutate: tables => { tables.teacher_class_permissions[2].can_publish = false; } });
    assert.deepEqual((await noPublish.call({ action: "teacher_assignments" })).body.assignments, []);
});

test("teacher_assignments: admin sees every enabled assignment in E1/E3/E5/E7", async () => {
    const { body } = await harness({ uid: "uid-admin" }).call({ action: "teacher_assignments" });
    assert.deepEqual(ids(body.assignments), [101, 102, 103, 104, 105, 109, 201, 202, 203, 204]);
});

test("assignment_results: creator with current class permission gets 200", async () => {
    const { status, body } = await harness({ uid: "uid-teacher-a" }).call({ action: "assignment_results", assignment_id: 101 });
    assert.equal(status, 200);
    assert.equal(body.assignment.id, 101);
});

test("assignment_results: non-creator teacher is 403 even with the class permission", async () => {
    const { status } = await harness({ uid: "uid-teacher-b" }).call({ action: "assignment_results", assignment_id: 101 });
    assert.equal(status, 403);
});

test("assignment_results: creator whose class permission ended is 403 and no student data is read", async () => {
    const run = harness({ uid: "uid-teacher-a" });
    const { status } = await run.call({ action: "assignment_results", assignment_id: 102 });
    assert.equal(status, 403);
    assert.ok(!run.admin.reads("students").some((_, index) => index > 0), "only the caller lookup touched students");
});

test("assignment_results: creator without any permission for the class is 403", async () => {
    const run = harness({ uid: "uid-teacher-a", mutate: tables => { tables.teacher_class_permissions = tables.teacher_class_permissions.filter(row => row.teacher_id !== 20); } });
    assert.equal((await run.call({ action: "assignment_results", assignment_id: 101 })).status, 403);
});

test("assignment_results and teacher actions refuse student callers", async () => {
    for (const action of ["assignment_results", "teacher_assignments", "delete_assignment"]) {
        const run = harness();
        const { status } = await run.call({ action, assignment_id: 101, role: "admin" });
        assert.equal(status, 403, action);
        assert.equal(run.admin.writes("assignments").length, 0);
    }
});

test("delete_assignment: creator with permission disables the assignment", async () => {
    const run = harness({ uid: "uid-teacher-a" });
    const { status } = await run.call({ action: "delete_assignment", assignment_id: 101 });
    assert.equal(status, 200);
    assert.equal(run.tables.assignments.find(row => row.id === 101).enabled, false);
});

test("delete_assignment: non-creator teacher, ended permission, or no permission cannot disable", async () => {
    const cases = [
        ["uid-teacher-b", 101, null],
        ["uid-teacher-a", 102, null],
        ["uid-teacher-a", 101, tables => { tables.teacher_class_permissions = []; }]
    ];
    for (const [uid, assignmentId, mutate] of cases) {
        const run = harness({ uid, mutate });
        const { status } = await run.call({ action: "delete_assignment", assignment_id: assignmentId });
        assert.ok(status === 403 || status === 404, `${uid} ${assignmentId} got ${status}`);
        assert.equal(run.admin.writes("assignments", "update").length, 0);
        assert.equal(run.tables.assignments.find(row => row.id === assignmentId).enabled, true);
    }
});

test("missing or invalid Firebase token is 401 before any database read", async () => {
    const tables = baseTables();
    const admin = createFakeAdmin({ tables });
    const call = loadHandler("assignment-manager", {
        createClient: () => admin, loadEffectiveAccess, assignmentCopyTemplate,
        jwtVerify: async () => { throw new Error("invalid"); }
    });
    assert.equal((await callJson(call({ action: "student_assignments" }, { token: "" }))).status, 401);
    assert.equal((await callJson(call({ action: "student_assignments" }))).status, 401);
    assert.equal(admin.log.length, 0);
});
