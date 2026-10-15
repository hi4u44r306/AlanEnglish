import assert from "node:assert/strict";
import test from "node:test";
import {
    ANONYMOUS_PLACEHOLDER_EMAIL,
    SYSTEM_SUBJECT_PREFIX,
    buildSystemReport,
    errorSignature,
    isSafeReportId,
    safePath,
    sanitizeDiagnostic,
    sanitizeStack
} from "../supabase/functions/support-manager/system-report.ts";

const identity = { studentId: 12, name: "測試", role: "student", email: null };
const base = { kind: "render_crash", report_id: "abcd1234-ef56", error_name: "TypeError", error_message: "x is undefined", path: "/student/review", build: "main.abc123.js" };

test("sanitizes tokens, bearer headers, signed urls, emails and long ids", () => {
    const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlMTIz";
    const out = sanitizeDiagnostic(`fail ${jwt} Bearer abc.def.ghi https://x.r2.dev/a/b.mp3?X-Amz-Signature=secret&x=1 mail me@kid.com id ${"a".repeat(40)}`);
    assert.ok(!out.includes("eyJ"));
    assert.ok(!out.includes("secret"));
    assert.ok(!out.includes("X-Amz"));
    assert.ok(!out.includes("me@kid.com"));
    assert.ok(!out.includes("a".repeat(30)));
    assert.match(out, /\[token\]/);
    assert.match(out, /https:\/\/x\.r2\.dev\/a\/b\.mp3/);
});

test("keeps only the first five stack lines and limits the length", () => {
    const stack = Array.from({ length: 12 }, (_, index) => `at line${index}`).join("\n");
    const out = sanitizeStack(stack);
    assert.equal(out.split("\n").length, 5);
    assert.ok(sanitizeDiagnostic("x".repeat(5000), 600).length <= 600);
});

test("drops query and hash from the path", () => {
    assert.equal(safePath("/academy/invite?token=SECRET#frag"), "/academy/invite");
    assert.equal(safePath("https://evil.example/x"), "/");
    assert.equal(safePath(undefined), "/");
});

test("validates report ids", () => {
    assert.equal(isSafeReportId("abcd1234-ef56"), true);
    assert.equal(isSafeReportId("short"), false);
    assert.equal(isSafeReportId("has space 12345"), false);
    assert.equal(isSafeReportId(12345678), false);
});

test("same error gets the same signature even when numbers differ", () => {
    assert.equal(errorSignature("render_crash", "TypeError", "item 3 failed"), errorSignature("render_crash", "TypeError", "item 87 failed"));
    assert.notEqual(errorSignature("render_crash", "TypeError", "a"), errorSignature("chunk_load", "TypeError", "a"));
});

test("builds an urgent system report with the system prefix and server-side identity only", () => {
    const report = buildSystemReport({ ...base, name: "冒充", email: "fake@example.com", user_note: "按下一題就白畫面" }, identity, new Date("2026-10-15T00:00:00Z"));
    assert.ok(report);
    assert.equal(report.priority, "urgent");
    assert.ok(report.subject.startsWith(SYSTEM_SUBJECT_PREFIX));
    assert.ok(report.subject.length <= 160);
    assert.ok(report.message.includes("按下一題就白畫面"));
    assert.ok(report.message.includes("/student/review"));
    assert.ok(!report.message.includes("冒充"));
    assert.ok(!report.message.includes("fake@example.com"));
    assert.ok(report.message.length >= 10 && report.message.length <= 4000);
});

test("manual and service failures are normal priority; unknown kinds and bad ids are rejected", () => {
    assert.equal(buildSystemReport({ ...base, kind: "manual" }, identity)?.priority, "normal");
    assert.equal(buildSystemReport({ ...base, kind: "service_failure" }, identity)?.priority, "normal");
    assert.equal(buildSystemReport({ ...base, kind: "hack" }, identity), null);
    assert.equal(buildSystemReport({ ...base, report_id: "bad" }, identity), null);
});

test("anonymous reports say so and never carry an identity", () => {
    const report = buildSystemReport(base, { studentId: null, name: "未登入訪客", role: null, email: null });
    assert.ok(report.message.includes("未登入訪客"));
    assert.match(ANONYMOUS_PLACEHOLDER_EMAIL, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
});

test("a user note cannot smuggle a token into the case", () => {
    const report = buildSystemReport({ ...base, user_note: "token eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlMTIz" }, identity);
    assert.ok(!report.message.includes("eyJ"));
});
