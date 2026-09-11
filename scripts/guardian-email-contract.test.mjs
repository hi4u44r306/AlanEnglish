import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const edgeFunction = read("supabase/functions/guardian-email/index.ts");
const sendingStatusMigration = read("supabase/migrations/20260910002545_guardian_email_sending_status.sql");
const resendAuditMigration = read("supabase/migrations/20260910020211_admin_guardian_email_resend_audit.sql");
const learningActivity = read("supabase/functions/learning-activity/index.ts");
const service = read("src/services/guardianEmailService.js");
const dashboard = read("src/components/Pages/ManagementDashboard.jsx");

test("direct and class notification actions are server-side and admin-only", () => {
    for (const action of ["send_notification", "preview_class_notifications", "send_class_notifications"]) {
        assert.match(edgeFunction, new RegExp(`"${action}"`));
        assert.match(service, new RegExp(`"${action}"`));
    }
    assert.match(edgeFunction, /notificationActions\.includes\(action\) && caller\?\.role !== "admin"/);
    assert.match(edgeFunction, /const CLASS_CODES = \["E1", "E3", "E5", "E7"\]/);
});

test("class batch previews counts and requires a second confirmation", () => {
    assert.match(edgeFunction, /ready_to_send/);
    assert.match(edgeFunction, /already_sent_today/);
    assert.match(edgeFunction, /missing_guardian_email/);
    assert.match(dashboard, /預覽寄送名單/);
    assert.match(dashboard, /確認寄送/);
});

test("each guardian receives an individual idempotent email", () => {
    assert.match(edgeFunction, /to: \[guardian\.email\]/);
    assert.match(edgeFunction, /guardian-inactive:\$\{student\.id\}:\$\{dateKey\}/);
    assert.match(edgeFunction, /Idempotency-Key/);
    assert.doesNotMatch(edgeFunction, /\bbcc\s*:/i);
});

test("the dashboard sends only backend-created notification records", () => {
    assert.match(dashboard, /sendGuardianNotification\(firebaseUser, noticeDraft\.id\)/);
    assert.doesNotMatch(service, /subject|message|guardian_email/);
});

test("email delivery has an allowed in-flight state and preserves backend error messages", () => {
    assert.match(sendingStatusMigration, /'sending'::text/);
    assert.match(sendingStatusMigration, /validate constraint notification_logs_status_check/);
    assert.match(edgeFunction, /const getErrorMessage = \(error: unknown, fallback: string\)/);
    assert.match(edgeFunction, /throw new Error\(errorMessage\)/);
});

test("all guardian HTML email variants include the public Alan English logo", () => {
    assert.match(edgeFunction, /const EMAIL_LOGO_URL = "https:\/\/alanenglish\.com\.tw\/android-chrome-512x512\.png"/);
    assert.equal((edgeFunction.match(/src="\$\{EMAIL_LOGO_URL\}"/g) || []).length, 3);
    assert.equal((edgeFunction.match(/alt="Alan English Logo"/g) || []).length, 3);
    assert.equal((edgeFunction.match(/width="64" height="64"/g) || []).length, 3);
});

test("admin resends require a reason and create a separate auditable delivery", () => {
    assert.match(edgeFunction, /"resend_notification"/);
    assert.match(service, /resendGuardianNotification/);
    assert.match(edgeFunction, /resendReason\.length < 3/);
    assert.match(edgeFunction, /requestedLog\.reason !== "inactive-learning"/);
    assert.match(edgeFunction, /\.gte\("sent_at", dayBounds\.startAt\)/);
    assert.match(edgeFunction, /\.lt\("sent_at", dayBounds\.endAt\)/);
    assert.match(edgeFunction, /subject: originalSent\.subject/);
    assert.match(edgeFunction, /message: originalSent\.message/);
    assert.match(edgeFunction, /resend_of_notification_id: originalSent\.id/);
    assert.match(edgeFunction, /resend_reason: resendReason/);
    assert.match(edgeFunction, /guardian-resend:\$\{originalSent\.id\}:\$\{requestId\}/);
    assert.match(resendAuditMigration, /foreign key \(resend_of_notification_id\)/);
    assert.match(resendAuditMigration, /char_length\(btrim\(resend_reason\)\) between 3 and 500/);
});

test("the reminder draft reports whether the student was already emailed today", () => {
    assert.match(learningActivity, /\.eq\("reason", "inactive-learning"\)/);
    assert.match(learningActivity, /\.eq\("status", "sent"\)/);
    assert.match(learningActivity, /already_sent_today: \(sentToday \|\| \[\]\)\.length > 0/);
    assert.match(dashboard, /noticeDraft\.already_sent_today/);
    assert.match(dashboard, /確認再次寄送/);
});
