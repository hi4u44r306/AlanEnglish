import assert from "node:assert/strict";
import test from "node:test";
import {
    getWebPushMessage, isAllowedPushEndpoint, isValidPushKey, isWebPushQuietHour
} from "../supabase/functions/_shared/web-push-policy.ts";

test("subscription endpoints cannot target arbitrary hosts or local services", () => {
    assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/example"), true);
    assert.equal(isAllowedPushEndpoint("https://web.push.apple.com/example"), true);
    for (const endpoint of [
        "http://fcm.googleapis.com/", "https://fcm.googleapis.com.evil.test/x",
        "https://127.0.0.1/internal", "https://user@web.push.apple.com/x"
    ]) assert.equal(isAllowedPushEndpoint(endpoint), false);
});

test("subscription encryption keys require the browser's expected byte lengths", () => {
    const publicPoint = Buffer.alloc(65);
    publicPoint[0] = 4;
    assert.equal(isValidPushKey(publicPoint.toString("base64url"), 65), true);
    assert.equal(isValidPushKey(Buffer.alloc(16).toString("base64url"), 16), true);
    assert.equal(isValidPushKey(Buffer.alloc(10).toString("base64url"), 16), false);
});

test("only low-sensitivity assignment and material-expiry events can reach lock screens", () => {
    assert.equal(getWebPushMessage({ id: 1, notification_type: "social" }), null);
    assert.equal(getWebPushMessage({ id: 2, notification_type: "membership", metadata: { event_type: "payment_failed" } }), null);
    const message = getWebPushMessage({ id: 3, notification_type: "assignment" });
    assert.equal(message.path, "/student/assignments");
    assert.equal(message.body.includes("學生"), false);
    assert.equal(getWebPushMessage({ id: 4, notification_type: "membership", metadata: { event_type: "material_access_expiring" } }).path, "/student/membership");
});

test("quiet hours follow Taipei local time", () => {
    assert.equal(isWebPushQuietHour(new Date("2026-09-25T12:59:00Z")), false);
    assert.equal(isWebPushQuietHour(new Date("2026-09-25T13:00:00Z")), true);
    assert.equal(isWebPushQuietHour(new Date("2026-09-26T00:00:00Z")), false);
});
