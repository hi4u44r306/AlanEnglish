import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260826233335_membership_class_material_commerce.sql");
const hardeningMigration = read("supabase/migrations/20260827013903_membership_commerce_authorization_hardening.sql");
const paidMemberIdentityMigration = read("supabase/migrations/20260831024923_promote_paid_trial_members.sql");
const departedMaterialsMigration = read("supabase/migrations/20260901030505_preserve_departed_academy_materials.sql");
const termRolloverMigration = read("supabase/migrations/20260901060511_term_material_rollover_entitlements.sql");
const currentMaterialCorrectionMigration = read("supabase/migrations/20260901114753_correct_current_class_materials.sql");
const simplifiedProductsMigration = read("supabase/migrations/20260901150048_simplify_products_and_listening_access.sql");
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
const studentSettings = read("src/components/Pages/StudentSettings.jsx");

test("1. 在校生可使用全部正式聽力，作業仍依 E1、E3、E5、E7 班級隔離", () => {
    assert.match(simplifiedProductsMigration, /where code = 'academy_internal'/);
    assert.match(simplifiedProductsMigration, /'requires_book_entitlement', false/);
    assert.match(content, /book\.content_scope !== "formal"\) return false/);
    assert.match(assignments, /getManagedClassCodes/);
    assert.match(migration, /code in \('E1',\s*'E3',\s*'E5',\s*'E7'\)/);
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
    assert.match(content, /requires_book_entitlement !== true\) return true/);
    assert.match(recordPlay, /requires_book_entitlement !== true\) return true/);
    assert.match(content, /student_book_entitlements/);
    assert.match(recordPlay, /student_book_entitlements/);
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

test("9. 基本會員可聽全部正式教材但不會取得作業或 AI", () => {
    assert.match(simplifiedProductsMigration, /where code = 'basic_membership_monthly'/);
    assert.match(simplifiedProductsMigration, /'requires_book_entitlement', false/);
    assert.match(simplifiedProductsMigration, /'assignments', false/);
    assert.match(simplifiedProductsMigration, /'ai_materials', false/);
    assert.match(content, /book\.content_scope !== "formal"\) return false/);
    assert.match(content, /effectiveAccess\.features\.requires_book_entitlement !== true\) return true/);
});

test("10. 教材包使用單一售價並正確疊加永久教材與 90 天權限", () => {
    assert.match(webhook, /source: "material_purchase"/);
    assert.match(webhook, /is_permanent: true/);
    assert.match(billing, /price_type: "standard"/);
    assert.match(billing, /materialPackage\.stripe_standard_price_id/);
    assert.doesNotMatch(billing, /memberPrice \? materialPackage\.member_price_twd/);
    assert.match(simplifiedProductsMigration, /member_price_twd = null/);
    assert.match(simplifiedProductsMigration, /includes_90_day_access = true/);
});

test("11. 在校轉離校不刪除歷史紀錄", () => {
    assert.match(departedMaterialsMigration, /set status='withdrawn'/);
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

test("24. 離校會盤點所有歷史 enrollment 的班級教材版本", () => {
    assert.match(departedMaterialsMigration, /academy_student_material_history_rows/);
    assert.match(departedMaterialsMigration, /e\.student_id=p_student_id/);
    assert.match(departedMaterialsMigration, /s\.effective_from<=ew\.enrollment_ends_at/);
    assert.match(departedMaterialsMigration, /s\.effective_to is null or s\.effective_to>=ew\.enrolled_at/);
    assert.match(departedMaterialsMigration, /'class_assignment'::text/);
    assert.match(departedMaterialsMigration, /'verified_listening'::text/);
    assert.match(departedMaterialsMigration, /between ew\.enrolled_at and ew\.enrollment_ends_at/);
    assert.doesNotMatch(departedMaterialsMigration, /academy_class_material_settings s[\s\S]{0,300}s\.is_active/);
});

test("25. 離校狀態與永久教材 entitlement 在同一個資料庫交易完成", () => {
    assert.match(departedMaterialsMigration, /process_academy_departure_with_materials/);
    assert.match(departedMaterialsMigration, /'academy_history'/);
    assert.match(departedMaterialsMigration, /'academy_enrollment'/);
    assert.match(departedMaterialsMigration, /status,is_permanent,starts_at/);
    assert.match(departedMaterialsMigration, /'active',\s*true,\s*h\.first_effective_from::timestamptz/);
    assert.match(departedMaterialsMigration, /set status='withdrawn'/);
    assert.match(departedMaterialsMigration, /event_type,effective_date,impact_snapshot/);
    assert.match(departedMaterialsMigration, /on conflict\(student_id,book_id,source,source_reference_type,source_reference_id\)/);
    assert.match(commerce, /rpc\("process_academy_departure_with_materials"/);
    assert.doesNotMatch(commerce, /from\("academy_enrollments"\)\.update\(\{ status: "withdrawn"/);
});

test("26. 既有離校生回填可重複執行且不解鎖新班級教材", () => {
    assert.match(departedMaterialsMigration, /status in \('withdrawn','graduated'\) or departed_at is not null/);
    assert.match(departedMaterialsMigration, /'backfilled',true/);
    assert.match(departedMaterialsMigration, /on conflict\(student_id,book_id,source,source_reference_type,source_reference_id\)/);
    assert.match(content, /student_book_entitlements/);
    assert.match(content, /\.eq\("status", "active"\)/);
    assert.match(content, /if \(!enrollment\.data\) return false/);
});

test("27. NT$299 開放全部正式聽力，離校生仍沒有新作業", () => {
    assert.match(simplifiedProductsMigration, /where code = 'basic_membership_monthly'/);
    assert.match(simplifiedProductsMigration, /'requires_book_entitlement', false/);
    assert.match(simplifiedProductsMigration, /'assignments', false/);
    assert.match(assignments, /if \(!effectiveAccess\.features\.assignments\)/);
    assert.match(assignments, /\.eq\("student_id", caller\.id\)\.eq\("status", "active"\)/);
    assert.match(commerce, /get_student_academy_material_history/);
    assert.match(studentSettings, /離校永久保留教材/);
    assert.match(studentSettings, /booksBySource\("academy_history"\)/);
});

test("28. 歷史教材 RPC 與離校 RPC 只允許 service_role", () => {
    assert.match(departedMaterialsMigration, /revoke all on function public\.get_student_academy_material_history\(bigint,date\)[\s\S]*from public,anon,authenticated/);
    assert.match(departedMaterialsMigration, /grant execute on function public\.get_student_academy_material_history\(bigint,date\)[\s\S]*to service_role/);
    assert.match(departedMaterialsMigration, /revoke all on function public\.process_academy_departure_with_materials\(bigint,bigint,bigint,date,jsonb\)[\s\S]*from public,anon,authenticated/);
    assert.match(departedMaterialsMigration, /where id=p_completed_by and role='admin'/);
});

test("29. 新學期換版會原子保存舊教材並建立新版本", () => {
    assert.match(termRolloverMigration, /rollover_academy_class_materials/);
    assert.match(termRolloverMigration, /pg_advisory_xact_lock/);
    assert.match(termRolloverMigration, /set effective_to=p_effective_from-1/);
    assert.match(termRolloverMigration, /'academy_history'/);
    assert.match(termRolloverMigration, /'academy_enrollment'/);
    assert.match(termRolloverMigration, /'retained_on_rollover',p_effective_from/);
    assert.match(termRolloverMigration, /insert into public\.academy_class_material_settings/);
    assert.match(termRolloverMigration, /insert into public\.academy_class_material_books/);
    assert.match(commerce, /rpc\("rollover_academy_class_materials"/);
    assert.doesNotMatch(commerce, /from\("academy_class_material_settings"\)\.update\(\{ effective_to/);
});

test("30. 換版盤點截至前一天的全部歷史教材，新生不取得入學前教材", () => {
    assert.match(termRolloverMigration, /e\.enrolled_at<p_effective_from/);
    assert.match(termRolloverMigration, /private\.academy_student_material_history_rows\([\s\S]*p_effective_from-1/);
    assert.match(termRolloverMigration, /'historical_book_ids',v_historical_book_ids/);
    assert.match(termRolloverMigration, /h\.first_effective_from::timestamptz/);
    assert.match(termRolloverMigration, /'material_setting_ids',h\.setting_ids/);
    assert.match(termRolloverMigration, /'evidence_sources',h\.evidence_sources/);
    assert.match(termRolloverMigration, /on conflict\(student_id,book_id,source,source_reference_type,source_reference_id\)/);
});

test("31. 換版預覽與寫入 RPC 只允許 service_role", () => {
    assert.match(termRolloverMigration, /security invoker/g);
    assert.match(termRolloverMigration, /revoke all on function public\.preview_academy_class_material_rollover\(smallint,date,bigint\[\]\)[\s\S]*from public,anon,authenticated/);
    assert.match(termRolloverMigration, /grant execute on function public\.preview_academy_class_material_rollover\(smallint,date,bigint\[\]\)[\s\S]*to service_role/);
    assert.match(termRolloverMigration, /revoke all on function public\.rollover_academy_class_materials\(smallint,date,bigint\[\],text,bigint\)[\s\S]*from public,anon,authenticated/);
    assert.match(termRolloverMigration, /where id=p_actor_id and role='admin'/);
});

test("32. 教材換版預覽不再使用模糊的 enrollment students 關聯", () => {
    assert.match(commerce, /preview_academy_class_material_rollover/);
    assert.doesNotMatch(commerce, /academy_enrollments"\)\.select\("id,student_id,students\(/);
});

test("33. 當天教材修正更新同一版本且每次留下前後快照", () => {
    assert.match(currentMaterialCorrectionMigration, /correct_academy_class_materials/);
    assert.match(currentMaterialCorrectionMigration, /s\.effective_from=v_today/);
    assert.match(currentMaterialCorrectionMigration, /pg_advisory_xact_lock/);
    assert.match(currentMaterialCorrectionMigration, /p_expected_updated_at/);
    assert.match(currentMaterialCorrectionMigration, /delete from public\.academy_class_material_books/);
    assert.match(currentMaterialCorrectionMigration, /insert into public\.academy_class_material_books/);
    assert.match(currentMaterialCorrectionMigration, /'corrected'/);
    assert.match(currentMaterialCorrectionMigration, /v_previous_snapshot/);
    assert.doesNotMatch(currentMaterialCorrectionMigration, /insert into public\.academy_class_material_settings/);
    assert.doesNotMatch(currentMaterialCorrectionMigration, /student_book_entitlements/);
});

test("34. 目前版本修正可在同一天重複執行但必須重新預覽", () => {
    assert.match(currentMaterialCorrectionMigration, /setting_updated_at/);
    assert.match(currentMaterialCorrectionMigration, /v_setting\.updated_at is distinct from p_expected_updated_at/);
    assert.match(currentMaterialCorrectionMigration, /請重新預覽目前版本後再確認修正/);
    assert.doesNotMatch(currentMaterialCorrectionMigration, /已經修正過|修正次數已達上限/);
    assert.match(commerce, /preview_current_class_materials/);
    assert.match(commerce, /correct_current_class_materials/);
    assert.match(commerce, /p_expected_updated_at: expectedUpdatedAt/);
});

test("35. 教材修正 RPC 只允許 service_role 且回傳真正錯誤", () => {
    assert.match(currentMaterialCorrectionMigration, /security invoker/g);
    assert.match(currentMaterialCorrectionMigration, /revoke all on function public\.preview_academy_class_material_correction\(smallint,bigint,bigint\[\],text\)[\s\S]*from public,anon,authenticated/);
    assert.match(currentMaterialCorrectionMigration, /grant execute on function public\.correct_academy_class_materials\(smallint,bigint,bigint\[\],text,bigint,timestamptz\)[\s\S]*to service_role/);
    assert.match(currentMaterialCorrectionMigration, /where id=p_actor_id and role='admin'/);
    assert.match(commerce, /const errorMessage/);
    assert.match(commerce, /message: errorMessage|const message = errorMessage/);
});

test("36. 商品包必須各有一本課本、Workbook 與聽力本並使用單一售價", () => {
    assert.match(simplifiedProductsMigration, /role in \('textbook', 'workbook', 'listening_book', 'web_material'\)/);
    assert.match(simplifiedProductsMigration, /textbook_count <> 1/);
    assert.match(simplifiedProductsMigration, /workbook_count <> 1/);
    assert.match(simplifiedProductsMigration, /listening_count <> 1/);
    assert.match(simplifiedProductsMigration, /stripe_standard_price_id/);
    assert.doesNotMatch(simplifiedProductsMigration, /new\.stripe_member_price_id/);
    assert.match(commerce, /new Set\(\["textbook","workbook","listening_book","web_material"\]\)/);
    assert.match(simplifiedProductsMigration, /mpb\.role in \('textbook', 'workbook', 'listening_book', 'web_material'\)/);
});

test("37. 商品不足三組時不會重複同一商品假裝成三個推薦", () => {
    assert.match(commerce, /packages\.length < 3/);
    assert.match(commerce, /\[\{ label: "建議", package: packages\[pivot\] \}\]/);
    assert.match(commerce, /findIndex\(y => y\.package\?\.id === x\.package\?\.id\)/);
});
