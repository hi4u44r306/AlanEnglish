import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("teacher and admin routes can open speaking demo pages", async () => {
    const app = await read("src/app/App.jsx");
    assert.match(app, /path="\/student\/speaking-challenges".*allowedRoles=\{\["student", "teacher", "admin"\]\}/);
    assert.match(app, /path="\/student\/speaking-history".*allowedRoles=\{\["student", "teacher", "admin"\]\}/);
});

test("speaking challenge backend keeps staff access read-only", async () => {
    const source = await read("supabase/functions/speaking-challenge/index.ts");
    assert.match(source, /user\.role === "teacher" \|\| user\.role === "admin"/);
    assert.match(source, /if \(demoMode\) return json\(403, \{ error: "示範模式不會寫入學生進度", code: "demo_read_only" \}\)/);
    assert.match(source, /questionIds\.length && !demoMode/);
    assert.match(source, /ids\.length && !demoMode/);
});

test("pronunciation scoring and private history remain student-only", async () => {
    const source = await read("supabase/functions/pronunciation-coach/index.ts");
    assert.match(source, /if \(user\.role !== "student"\) return json\(403/);
});
