import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [migration, resetMigration, edge, service, learningActivity] = await Promise.all([
    read("supabase/migrations/20261104120000_admin_guardian_email_change.sql"),
    read("supabase/migrations/20261104100000_guardian_password_reset.sql"),
    read("supabase/functions/membership-manager/index.ts"),
    read("src/services/membershipService.js"),
    read("supabase/functions/learning-activity/index.ts")
]);

const sliceBetween = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `找不到 ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `找不到 ${end}`);
    return source.slice(from, to);
};

// ---- 資料庫：稽核表與函式只給 service_role ----
assert.match(migration, /create table if not exists public\.guardian_email_change_audit/);
assert.match(migration, /alter table public\.guardian_email_change_audit enable row level security/);
assert.match(migration, /revoke all on table public\.guardian_email_change_audit from public, anon, authenticated/);
assert.match(migration, /revoke all on function public\.admin_set_guardian_email_v1\(bigint, bigint, text, text\)\s+from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.admin_set_guardian_email_v1\(bigint, bigint, text, text\)\s+to service_role/);
assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b|\bdelete\s+from\b|\btruncate\b/i, "必須只新增，不動既有資料");
assert.match(migration, /char_length\(btrim\(reason\)\) between 2 and 300/, "稽核一定要有原因");

const fn = sliceBetween(migration, "create or replace function public.admin_set_guardian_email_v1", "revoke all on function public.admin_set_guardian_email_v1");
assert.match(fn, /role = 'admin'\s+and account_status = 'active'/, "資料庫要再確認是有效的管理員");
assert.match(fn, /where id = p_student_id\s+and role = 'student'/);
assert.match(fn, /v_previous = v_new/, "相同信箱不重複更換");
// 只改信箱與設定記號；不可蓋掉原本的通知設定、家長姓名、電話
const onConflict = sliceBetween(fn, "on conflict (student_id) do update", "-- 學生自己還在進行中");
assert.match(onConflict, /set email = excluded\.email/);
assert.match(onConflict, /email_set_by_admin_at = excluded\.email_set_by_admin_at/);
assert.doesNotMatch(onConflict, /notification_enabled|preferred_channel|guardian_name|phone/, "不可蓋掉原本的通知設定與家長資料");
assert.match(fn, /set status = 'expired'/, "學生自己還在進行中的驗證要求要作廢");
assert.match(fn, /\|\| '\*\*\*@' \|\|/, "稽核只存遮蔽後的信箱");
assert.match(fn, /complete_student_onboarding_if_ready/);

// 「寄重設連結」要認得管理員親自設定的信箱
assert.match(resetMigration, /email_set_by_admin_at timestamptz/);
assert.match(resetMigration, /g\.email_set_by_admin_at is not null/);

// ---- Edge：兩個 action 都只有管理員，且只能透過資料庫函式換信箱 ----
for (const action of ["admin_guardian_email_status", "admin_set_guardian_email"]) {
    assert.match(edge, new RegExp(`action === "${action}"`), `缺少 ${action}`);
}
assert.doesNotMatch(edge, /admin_request_guardian_email_change|admin_confirm_guardian_email_change/, "不再有需要驗證碼的舊版 action");
const dispatchIndex = edge.indexOf('action === "admin_guardian_email_status"');
assert.ok(dispatchIndex > edge.indexOf("const caller"), "必須在確認登入身分之後才處理");
assert.match(sliceBetween(edge, "const requireAdminCaller = (caller: any) =>", "const loadStudentForGuardianAdmin"), /caller\?\.role === "admin"/);

const statusFn = sliceBetween(edge, "const adminGuardianEmailStatus = async (", "// 管理員：直接更換家長 Email");
assert.match(statusFn, /requireAdminCaller\(caller\)/);
const setFn = sliceBetween(edge, "const adminSetGuardianEmail = async (", "Deno.serve(");
assert.match(setFn, /requireAdminCaller\(caller\)/);
assert.match(setFn, /normalizeEmail\(body\?\.confirm_email\)/, "要輸入兩次");
assert.match(setFn, /reason\.length < 2/, "要寫原因");
assert.match(setFn, /admin_set_guardian_email_v1/);
assert.doesNotMatch(setFn, /guardian_contacts"\)\s*\.(update|upsert|insert)/, "只能透過資料庫函式換信箱");
assert.doesNotMatch(setFn, /console\.(log|error|warn)\([^)]*newEmail/, "不可記錄完整信箱");

// 老師與一般流程仍然不能直接寫入家長信箱（批次 1 的封鎖仍在）
assert.match(learningActivity, /existingEmail && requestedEmail !== existingEmail/);

// ---- 前端服務 ----
assert.match(service, /"admin_guardian_email_status"/);
assert.match(service, /"admin_set_guardian_email"/);

console.log("admin guardian email change contract checks passed");
