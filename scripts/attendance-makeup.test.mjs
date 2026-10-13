import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    ABSENT_STATUSES,
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

test("attendance tables are closed to the browser and the function re-checks the caller", () => {
    const migration = read("supabase/migrations/20261013011500_attendance_and_makeup.sql");
    for (const table of ["book_video_segments", "class_sessions", "class_session_attendance", "class_session_progress_items", "makeup_item_completions"]) {
        assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
        assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
    }
    assert.doesNotMatch(migration, /create policy|grant select/i);

    const handler = read("supabase/functions/attendance-manager/index.ts");
    assert.match(handler, /verifyFirebaseRequest\(req, admin\)/);
    assert.match(handler, /requireManagedClass/);
    assert.match(handler, /loadEffectiveAccess/);
    assert.doesNotMatch(handler, /body\?\.(role|student_id|learner_type)\b/);
});
