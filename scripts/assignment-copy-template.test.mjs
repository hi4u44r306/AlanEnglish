import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { assignmentCopyTemplate } from "../supabase/functions/_shared/assignment-copy-template.ts";

const assignment = { id: 10, creator_id: 1, target_class: "E1", enabled: true, source_type: "multi_activity_v2", schema_version: 2 };
const items = [
    { id: 20, assignment_id: 10, item_type: "listening", book_id_snapshot: 2, config: { required_listens: 7 }, content_snapshot: { tracks: [{ id: 30, private: "never-return" }] } },
    { id: 21, assignment_id: 10, item_type: "ai_quiz", book_id_snapshot: 2, config: { passing_score: 95 }, content_snapshot: { page_content: [{ id: 40, source_text: "never-return" }] } },
    { id: 22, assignment_id: 10, item_type: "pronunciation", book_id_snapshot: 2, config: { completion_mode: "target_score", target_score: 90, max_scored_attempts: 5 }, content_snapshot: { page_content: [{ id: 40 }] } }
];
const aiItems = [{ assignment_item_id: 21, ai_material_id: 50, passing_score: 95, question_snapshot: { answer: "never-return" } }];
const prompts = [{ assignment_item_id: 22, prompt_key: "40:Hello." }];
test("copies authoring identifiers and all settings without snapshots, answers or old identities", () => {
    const template = assignmentCopyTemplate(assignment, items, aiItems, prompts, []);
    assert.equal(template.items.length, 3);
    assert.deepEqual(template.items[0].track_ids, [30]);
    assert.equal(template.items[0].required_listens, 7);
    assert.equal(template.items[1].passing_score, 95);
    assert.equal(template.items[2].completion_mode, "target_score");
    assert.equal(template.items[2].target_score, 90);
    assert.equal(template.items[2].max_scored_attempts, 5);
    assert.doesNotMatch(JSON.stringify(template), /never-return|creator_id|assignment_id|question_snapshot/);
});
test("missing activity details refuse partial copy; retired legacy modes stay disabled", () => {
    assert.equal(assignmentCopyTemplate(assignment, items, [], prompts, []), null);
    assert.equal(assignmentCopyTemplate({ ...assignment, source_type: "mission_pack" }, items, aiItems, prompts, []), null);
    assert.deepEqual(assignmentCopyTemplate({ id: 1, source_type: "music_track", track_id: 3, required_listens: 2 }, [], [], [], []), { source_type: "music_track", track_ids: [3], required_listens: 2 });
});

// Run the real handler with isolated Firebase/DB substitutes. No credentials or remote data.
const source = stripTypeScriptTypes(readFileSync(new URL("../supabase/functions/assignment-manager/index.ts", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, ""));
function harness(role = "teacher", permitted = true, validToken = true) {
    const reads = [];
    const tables = {
        students: [{ id: 1, firebase_uid: "mock-uid", role }],
        teacher_class_permissions: permitted ? [{ teacher_id: 1, can_publish: true, starts_at: "2020-01-01", academy_classes: { code: "E1" } }] : [],
        assignments: [assignment, { ...assignment, id: 11, target_class: "E3" }, { ...assignment, id: 12, creator_id: 2 }],
        assignment_items: [...items, { ...items[0], id: 23, assignment_id: 11 }, { ...items[0], id: 24, assignment_id: 12 }],
        assignment_ai_items: aiItems, assignment_pronunciation_prompts: prompts, assignment_track_items: [], student_feature_rollouts: []
    };
    const admin = { from(table) {
        const filters = []; let single = false;
        const query = {
            select(fields) { reads.push({ table, fields, filters }); return query; },
            eq(field, value) { filters.push(row => row[field] === value); return query; },
            in(field, values) { reads.push({ table, in: field, values }); filters.push(row => values.includes(row[field])); return query; },
            lte() { return query; }, or() { return query; }, order() { return query; }, limit() { return query; },
            maybeSingle() { single = true; return query; },
            then(resolve, reject) { const rows = (tables[table] || []).filter(row => filters.every(filter => filter(row))); return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject); }
        };
        return query;
    } };
    let handler;
    vm.runInNewContext(source, {
        Deno: { env: { get: () => "isolated-placeholder" }, serve: value => { handler = value; } },
        Request, Response, URL, console, createClient: () => admin, createRemoteJWKSet: () => ({}), assignmentCopyTemplate,
        jwtVerify: async () => { if (!validToken) throw new Error("invalid"); return { payload: { sub: "mock-uid" } }; },
        loadEffectiveAccess: async () => ({ is_active: true, features: { assignments: true } })
    });
    return { reads, call: () => handler(new Request("https://isolated.invalid", { method: "POST", headers: { Authorization: "Bearer mock-token" }, body: JSON.stringify({ action: "teacher_assignments", role: "admin", student_id: 999 }) })) };
}
test("real list handler retains creator/class isolation and only reads authorized child IDs", async () => {
    const run = harness(); const response = await run.call();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.assignments.map(row => row.id), [10]);
    assert.equal(body.assignments[0].copy_template.items.length, 3);
    assert.ok(run.reads.filter(read => read.table === "assignment_items" && read.values).every(read => read.values.every(id => id === 10)));
    assert.ok(run.reads.filter(read => read.table === "assignment_ai_items" && read.values).every(read => read.values.every(id => [20, 21, 22].includes(id))));
    assert.doesNotMatch(JSON.stringify(body), /never-return/);
});
test("real handler rejects a student spoofing admin, invalid token and revoked classes", async () => {
    assert.equal((await harness("student").call()).status, 403);
    assert.equal((await harness("teacher", true, false).call()).status, 401);
    const run = harness("teacher", false); const body = await (await run.call()).json();
    assert.deepEqual(body.assignments, []);
    assert.ok(!run.reads.some(read => ["assignment_items", "assignment_ai_items", "assignment_pronunciation_prompts"].includes(read.table)));
});
test("admin retains visibility across managed classes", async () => {
    const body = await (await harness("admin").call()).json();
    assert.deepEqual(body.assignments.map(row => row.id), [10, 11, 12]);
});
