import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const edgeFunction = read("supabase/functions/guardian-email/index.ts");
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
