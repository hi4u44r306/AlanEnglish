// 家長取消每週週報：連結簽章與各處接線。執行：node --experimental-strip-types --test scripts/guardian-weekly-unsubscribe.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildUnsubscribeUrl, unsubscribeExpiry, verifyUnsubscribe } from "../supabase/functions/_shared/guardian-weekly-unsubscribe-token.ts";

const SECRET = "test-secret-not-real";
const subject = { studentId: 7, contactId: 3, email: "Parent@Example.com", linkVersion: 1 };
const parse = url => { const p = new URL(url).searchParams; return { exp: Number(p.get("e")), token: p.get("t"), student: Number(p.get("s")) }; };

test("the link is signed, deterministic and carries no email or name", async () => {
    const a = await buildUnsubscribeUrl(SECRET, subject, "2026-11-02");
    const b = await buildUnsubscribeUrl(SECRET, subject, "2026-11-02");
    assert.equal(a, b);
    assert.match(a, /^https:\/\/alanenglish\.com\.tw\/unsubscribe-weekly\?s=7&e=\d+&t=[0-9a-f]{64}$/);
    assert.doesNotMatch(a, /parent|example/i);
    assert.equal(await buildUnsubscribeUrl("", subject, "2026-11-02"), null);
});

test("a valid link verifies; the email case does not matter", async () => {
    const { exp, token } = parse(await buildUnsubscribeUrl(SECRET, subject, "2026-11-02"));
    assert.equal(await verifyUnsubscribe(SECRET, subject, exp, token, exp - 10), "ok");
    assert.equal(await verifyUnsubscribe(SECRET, { ...subject, email: "parent@example.com" }, exp, token, exp - 10), "ok");
});

test("a forged, edited or foreign link is rejected", async () => {
    const { exp, token } = parse(await buildUnsubscribeUrl(SECRET, subject, "2026-11-02"));
    const now = exp - 10;
    assert.equal(await verifyUnsubscribe(SECRET, subject, exp, token.replace(/.$/, c => (c === "0" ? "1" : "0")), now), "invalid");
    assert.equal(await verifyUnsubscribe(SECRET, { ...subject, studentId: 8 }, exp, token, now), "invalid");
    assert.equal(await verifyUnsubscribe(SECRET, { ...subject, contactId: 4 }, exp, token, now), "invalid");
    assert.equal(await verifyUnsubscribe(SECRET, subject, exp + 1, token, now), "invalid");
    assert.equal(await verifyUnsubscribe("another-secret", subject, exp, token, now), "invalid");
    for (const bad of ["", "abc", null, undefined, "g".repeat(64)]) assert.equal(await verifyUnsubscribe(SECRET, subject, exp, bad, now), "invalid");
    assert.equal(await verifyUnsubscribe("", subject, exp, token, now), "invalid");
    assert.equal(await verifyUnsubscribe(SECRET, subject, 0, token, now), "invalid");
});

test("a changed email or a re-enabled contact (new link version) kills old links", async () => {
    const { exp, token } = parse(await buildUnsubscribeUrl(SECRET, subject, "2026-11-02"));
    assert.equal(await verifyUnsubscribe(SECRET, { ...subject, email: "new@example.com" }, exp, token, exp - 10), "invalid");
    assert.equal(await verifyUnsubscribe(SECRET, { ...subject, linkVersion: 2 }, exp, token, exp - 10), "invalid");
});

test("the link expires 60 days after the report week ends", async () => {
    const { exp, token } = parse(await buildUnsubscribeUrl(SECRET, subject, "2026-11-02"));
    assert.equal(exp, unsubscribeExpiry("2026-11-02"));
    assert.equal(new Date(exp * 1000).toISOString(), "2027-01-08T00:00:00.000Z");
    assert.equal(await verifyUnsubscribe(SECRET, subject, exp, token, exp + 1), "expired");
});

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("the public function only checks on preview, changes data only on confirm, and never returns personal data", () => {
    const src = read("../supabase/functions/guardian-weekly-unsubscribe/index.ts");
    assert.match(src, /\["preview", "confirm"\]\.includes\(action\)/);
    const beforeRpc = src.slice(0, src.indexOf('.rpc("guardian_weekly_report_opt_out"'));
    assert.match(beforeRpc, /if \(action === "preview"\) \{[\s\S]*return json/);
    assert.match(src, /p_source: "email_link"/);
    assert.doesNotMatch(src, /guardian_name|student_name|select\([^)]*\bname\b/);
    assert.match(read("../supabase/config.toml"), /\[functions\.guardian-weekly-unsubscribe\]\s+verify_jwt = false/);
});

test("the weekly email links to the page, skips opted-out parents, and keeps the link out of the log", () => {
    const src = read("../supabase/functions/guardian-email/index.ts");
    assert.match(src, /\.is\("guardian_contacts\.weekly_report_opted_out_at", null\)/);
    assert.match(src, /reason: "guardian_opted_out"/);
    assert.match(src, /message: email\.logText,/);
    assert.doesNotMatch(src, /message: email\.text/);
    assert.match(src, /buildEmail\(report, unsubscribeUrl\)/);
    // 退訂連結不能讓冪等鍵改變。
    assert.match(src, /guardian-weekly:\$\{student\.id\}:\$\{weekStart\}/);
});

test("teachers can only re-enable inside their own classes, and the weekly draft respects the opt-out", () => {
    const src = read("../supabase/functions/learning-activity/index.ts");
    const block = src.slice(src.indexOf('action === "guardian_weekly_reenable"'), src.indexOf('action === "notification_draft"'));
    assert.match(block, /canManageStudent\(admin, account, studentId\)/);
    assert.match(block, /\["teacher", "admin"\]\.includes\(account\.role\)/);
    assert.match(read("../supabase/functions/weekly-report/index.ts"), /report\.guardian\.weekly_opted_out/);
});
