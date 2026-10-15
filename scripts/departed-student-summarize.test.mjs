import assert from "node:assert/strict";
import test from "node:test";
import { latestDepartures, summarizeDepartedActivity } from "../supabase/functions/departed-student-activity/summarize.ts";

const row = (student_id, status, departed_at, class_code = "E3") => ({ student_id, status, departed_at, access_ends_at: null, class_code });
const student = (id, last_login_at, account_status = "active") => ({ id, name: `s${id}`, chinese_name: null, english_name: null, account_status, last_login_at, last_active_at: null });
const NOW = new Date("2026-10-15T00:00:00Z");

test("students with a current enrollment are not departed", () => {
    const result = latestDepartures([row(1, "withdrawn", "2026-06-30"), row(2, "graduated", "2026-06-30")], new Set([1]));
    assert.deepEqual([...result.keys()], [2]);
});

test("uses the latest departure when a student left more than once", () => {
    const result = latestDepartures([row(1, "withdrawn", "2025-06-30", "E1"), row(1, "graduated", "2026-06-30", "E3")], new Set());
    assert.equal(result.get(1).class_code, "E3");
});

test("counts returned, never returned and recent logins", () => {
    const departures = latestDepartures([row(1, "withdrawn", "2026-06-30"), row(2, "withdrawn", "2026-06-30"), row(3, "graduated", "2026-06-30")], new Set());
    const { summary, students } = summarizeDepartedActivity(departures, [
        student(1, "2026-10-01T00:00:00Z"),
        student(2, null, "archived"),
        student(3, "2026-06-30T10:00:00Z")
    ], NOW);
    assert.equal(summary.total_departed, 3);
    assert.equal(summary.returned_after_departure, 1);
    assert.equal(summary.never_returned, 2);
    assert.equal(summary.accounts_archived, 1);
    assert.equal(summary.logged_in_last_30_days, 1);
    assert.equal(students[0].id, 1);
});

test("login on the departure day itself does not count as returning", () => {
    const departures = latestDepartures([row(1, "withdrawn", "2026-06-30")], new Set());
    const { summary } = summarizeDepartedActivity(departures, [student(1, "2026-06-30T12:00:00Z")], NOW);
    assert.equal(summary.returned_after_departure, 0);
});
