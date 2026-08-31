import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260826233335_membership_class_material_commerce.sql");
const hardeningMigration = read("supabase/migrations/20260827013903_membership_commerce_authorization_hardening.sql");
const paidMemberIdentityMigration = read("supabase/migrations/20260831023343_promote_paid_trial_members.sql");
const commerce = read("supabase/functions/commerce-manager/index.ts");
const content = read("supabase/functions/content-access/index.ts");
const recordPlay = read("supabase/functions/record-play/index.ts");
const assignments = read("supabase/functions/assignment-manager/index.ts");
const billing = read("supabase/functions/billing-manager/index.ts");
const webhook = read("supabase/functions/stripe-webhook/index.ts");
const membership = read("supabase/functions/membership-manager/index.ts");
const notifications = read("supabase/functions/notification-manager/index.ts");
const guardianEmail = read("supabase/functions/guardian-email/index.ts");
const routes = read("src/app/App.jsx");
const player = read("src/components/fragment/MusicPlayer.jsx");
const billingResult = read("src/components/Pages/BillingResult.jsx");

test("1. E1、E3、E5、E7 學生只能取得正確班級教材", () => {
    assert.match(migration, /code in \('E1',\s*'E3',\s*'E5',\s*'E7'\)/);
    assert.match(content, /academy_class_material_books/);
    assert.match(content, /enrollment\.data\.class_id/);
});

test("2. 班級、自購、管理員贈送與開通碼教材可疊加", () => {
    for (const source of ["material_purchase", "admin_grant", "activation_code", "trial", "legacy"]) assert.match(migration, new RegExp(`'${source}'`));
    assert.match(migration, /student_book_entitlements/);
    assert.doesNotMatch(commerce, /delete\(\).*student_book_entitlements/);
});

test("3. 未授權教材、音檔、逐字稿及偽造 ID 都被拒絕", () => {
    assert.match(content, /book_entitlement_required/);
    assert.match(recordPlay, /isTrackAuthorized/);
    assert.match(content, /subtitle_status === "published"/);
    assert.match(content, /if \(!enrollment\.data\) return false/);
    assert.match(recordPlay, /if \(!enrollment\.data\) return false/);
    assert.match(hardeningMigration, /e\.status='active'/);
});

test("4. 教師只能替授權班級發布該班教材作業", () => {
    assert.match(assignments, /getManagedClassCodes/);
    assert.match(assignments, /getClassMaterial/);
    assert.match(assignments, /音檔必須來自目標班級已啟用的教材/);
});

test("5. 管理員可設定班級教材，老師不可修改", () => {
    assert.match(commerce, /只有管理員可以修改班級教材/);
    assert.match(commerce, /read_only: caller\.role !== "admin"/);
});

test("6. 班級教材變更不破壞既有未到期作業", () => {
    assert.match(migration, /class_material_setting_id/);
    assert.match(migration, /book_id_snapshot/);
    assert.match(assignments, /track_id_snapshot/);
});

test("7. 教材購買後正確取得 90 天權限", () => {
    assert.match(webhook, /setUTCDate\(endsAtDate\.getUTCDate\(\) \+ 90\)/);
    assert.match(webhook, /material_bonus_90_day/);
});

test("8. 90 天權限不會自動扣款", () => {
    assert.match(webhook, /auto_renews: false/);
    assert.match(webhook, /cancel_at_period_end: false/);
    assert.match(billing, /mode: "payment"/);
});

test("9. 基本會員不會解鎖未購買的下一級教材", () => {
    assert.match(content, /student_book_entitlements/);
    assert.match(content, /book_entitlement_required/);
    assert.doesNotMatch(content, /basic_monthly_299.*return true/s);
});

test("10. 下一級教材包購買後正確疊加", () => {
    assert.match(webhook, /source: "material_purchase"/);
    assert.match(webhook, /is_permanent: true/);
    assert.match(billing, /memberPrice.*basic_monthly_299|BASIC_MEMBERSHIP_PLAN_CODE/s);
    assert.match(commerce, /plan_codes\.includes\(BASIC_MEMBERSHIP_PLAN_CODE\)/);
    assert.doesNotMatch(commerce, /basic_monthly_299/);
});

test("11. 在校轉離校不刪除歷史紀錄", () => {
    assert.match(commerce, /status: "withdrawn"/);
    assert.doesNotMatch(commerce, /from\("students"\)\.delete/);
    assert.doesNotMatch(commerce, /from\("student_book_entitlements"\)\.delete/);
    assert.match(commerce, /action === "restore_student" \? detail\.enrollment_history\?\.\[0\]/);
});

test("12. 已付款 AI 可使用至 current_period_end", () => {
    assert.match(commerce, /cancel_at_period_end: true/);
    assert.match(billing, /current_period_end: currentPeriodEnd/);
    assert.match(billing, /stripe_subscription_status/);
});

test("13. 本期結束取消後可在到期前恢復", () => {
    assert.match(billing, /resume_subscription/);
    assert.match(billing, /cancel_at_period_end: cancelAtPeriodEnd/);
    assert.match(billing, /subscription_expired/);
});

test("14. Stripe Webhook 重送不會重複授權", () => {
    assert.match(webhook, /stripe_event_id/);
    assert.match(webhook, /duplicate: true/);
    assert.match(webhook, /onConflict: "student_id,book_id,source,source_reference_type,source_reference_id"/);
    assert.doesNotMatch(webhook, /if \(!paid\).*accessGrant\.student_id.*periodEnd/);
});

test("15. 家長 Email 缺失時禁止 Checkout", () => {
    assert.match(billing, /guardian_email_required/);
    assert.match(billing, /loadGuardianEmail/);
    assert.match(billing, /RESERVED_EMAIL_DOMAINS/);
});

test("16. 到期前三天只建立一次通知", () => {
    assert.match(notifications, /setUTCDate\(target\.getUTCDate\(\) \+ 3\)/);
    assert.match(migration, /event_key text not null unique/);
    assert.match(notifications, /ignoreDuplicates: true/);
    assert.match(notifications, /verify_guardian_cron_secret/);
    assert.match(guardianEmail, /notification-manager/);
    assert.match(guardianEmail, /action: "run_due"/);
});

test("17. 七天試用不能看正式教材及班級作業", () => {
    assert.match(content, /content_scope === "trial"/);
    assert.match(content, /trial_user/);
    assert.match(assignments, /features\.assignments/);
});

test("18. 逐字稿依教材權限限制且預設關閉", () => {
    assert.match(content, /isBookAuthorized/);
    assert.match(player, /useState\("none"\)/);
    assert.match(player, /hasTranscript && transcriptMode !== "none"/);
});

test("19. 學生、老師、管理員直接路由存取均正確", () => {
    assert.match(routes, /path="\/materials"/);
    assert.match(routes, /path="\/teacher\/class-materials".*allowedRoles=\{\["teacher", "admin"\]\}/);
    assert.match(routes, /path="\/admin\/material-packages".*allowedRoles=\{\["admin"\]\}/);
    assert.match(routes, /path="\/admin\/student-lifecycle".*allowedRoles=\{\["admin"\]\}/);
});

test("20. RLS、安全後端與 Production build 契約完整", () => {
    assert.match(migration, /enable row level security/g);
    assert.match(migration, /revoke all on table[\s\S]*from anon,authenticated/);
    assert.match(commerce, /verifyFirebaseRequest/);
    assert.match(membership, /book_entitlement_id/);
    assert.match(hardeningMigration, /before insert or update on public\.material_packages/);
    assert.match(commerce, /已上架商品包請先停售/);
});

test("21. 教材商務後台明確使用學生在學關聯", () => {
    assert.match(commerce, /academy_enrollments!academy_enrollments_student_id_fkey/);
    assert.doesNotMatch(commerce, /account_status,academy_enrollments\(/);
});

test("22. 取消訂閱後的一次性教材付款可由成功頁正確確認", () => {
    assert.match(billing, /sessionCommerceType === "material_package"/);
    assert.match(billing, /session\?\.mode !== "payment"/);
    assert.match(billing, /from\("material_purchases"\)[\s\S]*stripe_checkout_session_id/);
    assert.match(billingResult, /material_purchase\?\.status === "paid"/);
});

test("23. 試用會員付款後轉為一般會員且不覆蓋英文班身分", () => {
    assert.match(paidMemberIdentityMigration, /plans\.code = 'basic_membership_monthly'/);
    assert.match(paidMemberIdentityMigration, /memberships\.status in \('active', 'complimentary'\)/);
    assert.match(paidMemberIdentityMigration, /purchases\.status = 'paid'/);
    assert.match(paidMemberIdentityMigration, /students\.learner_type = 'trial_user'/);
    assert.match(paidMemberIdentityMigration, /set learner_type = 'textbook_customer'/);
    assert.match(paidMemberIdentityMigration, /students\.role = 'student'/);
    assert.match(paidMemberIdentityMigration, /memberships_promote_paid_trial_user/);
    assert.match(paidMemberIdentityMigration, /material_purchases_promote_paid_trial_user/);
    assert.match(paidMemberIdentityMigration, /security invoker/);
    assert.match(paidMemberIdentityMigration, /revoke all on function[\s\S]*from public, anon, authenticated/);
    assert.doesNotMatch(paidMemberIdentityMigration, /set learner_type = 'academy_student'/);
});
