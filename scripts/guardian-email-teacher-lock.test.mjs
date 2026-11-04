import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [learningActivity, membership] = await Promise.all([
    read("supabase/functions/learning-activity/index.ts"),
    read("supabase/functions/membership-manager/index.ts")
]);

const sliceBetween = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `找不到 ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `找不到 ${end}`);
    return source.slice(from, to);
};

// 老師／管理員在 learning-activity 不能直接換家長 Email
const guardianUpsert = sliceBetween(learningActivity, 'if (action === "guardian_upsert")', 'if (action === "notification_draft")');
assert.match(guardianUpsert, /\.select\("email"\)/, "要先讀出目前的家長 Email");
assert.match(guardianUpsert, /existingEmail && requestedEmail !== existingEmail/, "已有信箱且不同時要拒絕");
assert.match(guardianUpsert, /json\(409/, "拒絕時回 409");
assert.match(guardianUpsert, /if \(!existingEmail && requestedEmail\)\s*\{[^}]*guardianPayload\.email = requestedEmail;[^}]*email_verified_at = null/s, "只有第一次填入，且一律未驗證");
assert.doesNotMatch(
    guardianUpsert.slice(guardianUpsert.indexOf("const guardianPayload"), guardianUpsert.indexOf("if (!existingEmail && requestedEmail)")),
    /\bemail\b/,
    "基本 payload 不可直接帶 email"
);
assert.match(learningActivity, /guardian_contacts"\)\s*\.select\("id, student_id, guardian_name, email, email_verified_at,/, "儀表板要拿到驗證狀態");

// membership-manager complete_signup 不能覆蓋既有家長信箱
const completeSignupGuardian = sliceBetween(membership, "// 只在還沒有家長信箱時才寫入", "// A paid physical-store order");
assert.match(completeSignupGuardian, /\.select\("email"\)/, "要先讀出目前信箱");
assert.match(completeSignupGuardian, /if \(!String\(existingGuardian\?\.email \|\| ""\)\.trim\(\)\)/, "只有沒有信箱時才寫入");
assert.match(completeSignupGuardian, /email_verified_at: null/, "新寫入一律未驗證");

console.log("guardian email teacher lock contract: ok");
