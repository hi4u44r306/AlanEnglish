import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    ABSENT_STATUSES,
    describeMakeupForFamily,
    isValidSessionDate,
    normalizeSeconds,
    normalizeYouTubeUrl,
    sessionStartIso
} from "../supabase/functions/_shared/attendance-makeup.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("only absent and leave students need a makeup", () => {
    assert.deepEqual([...ABSENT_STATUSES].sort(), ["absent", "leave"]);
});

test("video links are limited to single YouTube videos", () => {
    const canonical = "https://www.youtube.com/watch?v=abcdefghijk";
    assert.equal(normalizeYouTubeUrl("https://youtu.be/abcdefghijk?t=30"), canonical);
    assert.equal(normalizeYouTubeUrl("https://m.youtube.com/watch?v=abcdefghijk&list=PL1"), canonical);
    assert.equal(normalizeYouTubeUrl("https://www.youtube.com/embed/abcdefghijk"), canonical);
    assert.equal(normalizeYouTubeUrl("https://www.youtube.com/playlist?list=PL1"), "");
    assert.equal(normalizeYouTubeUrl("http://www.youtube.com/watch?v=abcdefghijk"), "");
    assert.equal(normalizeYouTubeUrl("https://evil.example/watch?v=abcdefghijk"), "");
    assert.equal(normalizeYouTubeUrl("javascript:alert(1)"), "");
});

test("seconds and session dates are validated", () => {
    assert.equal(normalizeSeconds("750"), 750);
    assert.equal(normalizeSeconds(""), null);
    assert.equal(normalizeSeconds(-1), null);
    assert.equal(normalizeSeconds(1.5), null);
    assert.equal(isValidSessionDate("2026-10-13", "2026-10-13"), true);
    assert.equal(isValidSessionDate("2026-10-14", "2026-10-13"), false);
    assert.equal(isValidSessionDate("2026-02-30", "2026-10-13"), false);
    assert.equal(sessionStartIso("2026-10-13"), "2026-10-12T16:00:00.000Z");
});

test("parents read what was taught on a missed day and how far the makeup has got", () => {
    assert.deepEqual(describeMakeupForFamily([]), []);
    assert.deepEqual(describeMakeupForFamily([
        { date: "2026-10-13", status: "leave", total: 2, done: 1, items: [
            { item_type: "video", title: "Workbook 2 P.24", done: true },
            { item_type: "listening", title: "P24 Reading", done: false }
        ] },
        { date: "2026-10-15", status: "absent", total: 1, done: 1, items: [{ item_type: "assignment", title: "週四作業", done: true }] },
        { date: "2026-10-16", status: "leave", total: 0, done: 0, items: [] }
    ]), [
        "10/13（請假）上課內容：影片「Workbook 2 P.24」、聽力「P24 Reading」。補課完成 1／2 項。",
        "10/15（缺席）上課內容：作業「週四作業」。補課已全部完成。",
        "10/16（請假）：老師尚未登記當天的上課內容。"
    ]);
    const report = read("supabase/functions/weekly-report/index.ts");
    assert.match(report, /loadStudentMakeupSummary\(admin, Number\(target\.id\)/);
    assert.match(report, /weekly-report makeup summary error/);
});

test("attendance tables are closed to the browser and the function re-checks the caller", () => {
    const migration = read("supabase/migrations/20261013021601_attendance_and_makeup.sql");
    for (const table of ["book_video_segments", "class_sessions", "class_session_attendance", "class_session_progress_items", "makeup_item_completions"]) {
        assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
        assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
    }
    assert.doesNotMatch(migration, /create policy|grant select/i);

    const handler = read("supabase/functions/attendance-manager/index.ts");
    assert.match(handler, /verifyFirebaseRequest\(req, admin\)/);
    assert.match(handler, /requireManagedClass/);
    // academy_enrollments has three foreign keys to students; an unnamed embed fails with PGRST201.
    assert.match(handler, /students!academy_enrollments_student_id_fkey\(/);
    assert.doesNotMatch(handler, /[ ,"]students\(id/);
    assert.match(handler, /loadEffectiveAccess/);
    assert.doesNotMatch(handler, /body\?\.(role|student_id|learner_type)\b/);
});
