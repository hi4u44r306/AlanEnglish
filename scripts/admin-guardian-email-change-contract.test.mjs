import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [migration, edge, service] = await Promise.all([
    read("supabase/migrations/20261104120000_admin_guardian_email_change.sql"),
    read("supabase/functions/membership-manager/index.ts"),
    read("src/services/membershipService.js")
]);

const sliceBetween = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `找不到 ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `找不到 ${end}`);
    return source.slice(from, to);
};

// ---- 資料庫 ----
assert.match(migration, /add column if not exists requested_by_admin_id bigint references public\.students\(id\) on delete set null/);
assert.match(migration, /alter table public\.guardian_email_change_audit enable row level security/);
assert.match(migration, /revoke all on table public\.guardian_email_change_audit from public, anon, authenticated/);
assert.match(migration, /revoke all on function public\.admin_confirm_guardian_email_verification_v1\(bigint, bigint, bigint, text\)\s+from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.admin_confirm_guardian_email_verification_v1\(bigint, bigint, bigint, text\)\s+to service_role/);
assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b|\bdelete\s+from\b|\btruncate\b/i, "必須只新增，不動既有資料");

const fn = sliceBetween(migration, "create or replace function public.admin_confirm_guardian_email_verification_v1", "revoke all on function public.admin_confirm_guardian_email_verification_v1");
assert.match(fn, /role = 'admin'\s+and account_status = 'active'/, "資料庫要再確認是有效的管理員");
assert.match(fn, /requested_by_admin_id is not null/, "只有管理員發起的要求才能由管理員確認");
assert.match(fn, /v_request\.code_hash <> lower\(btrim\(coalesce\(p_code_hash, ''\)\)\)/);
assert.match(fn, /interval|expires_at <= now\(\)/);
assert.match(fn, /attempts >= 5/);
assert.match(fn, /set email = excluded\.email,\s+email_verified_at = excluded\.email_verified_at/, "驗證成功才換信箱，且只改信箱與驗證時間");
assert.doesNotMatch(fn, /preferred_channel = 'email',\s+notification_enabled = true,\s+email_verified_at = excluded/, "不可蓋掉原本的通知設定");
assert.match(fn, /'verified'/);
assert.match(fn, /\|\| '\*\*\*@' \|\|/, "稽核只存遮蔽後的信箱");

// ---- Edge：三個 action 都只有管理員 ----
for (const action of ["admin_guardian_email_status", "admin_request_guardian_email_change", "admin_confirm_guardian_email_change"]) {
    assert.match(edge, new RegExp(`action === "${action}"`), `缺少 ${action}`);
}
const dispatchIndex = edge.indexOf('action === "admin_guardian_email_status"');
assert.ok(dispatchIndex > edge.indexOf("const caller"), "必須在確認登入身分之後才處理");
assert.match(sliceBetween(edge, "const requireAdminCaller = (caller: any) =>", "const loadStudentForGuardianAdmin"), /caller\?\.role === "admin"/);
for (const name of ["adminGuardianEmailStatus", "adminRequestGuardianEmailChange", "adminConfirmGuardianEmailChange"]) {
    const body = sliceBetween(edge, `const ${name} = async (`, name === "adminConfirmGuardianEmailChange" ? "Deno.serve(" : "// 管理員");
    assert.match(body, /requireAdminCaller\(caller\)/, `${name} 必須檢查管理員`);
}
const requestFn = sliceBetween(edge, "const adminRequestGuardianEmailChange = async (", "// 管理員：輸入家長用電話告知");
assert.match(requestFn, /normalizeEmail\(body\?\.confirm_email\)/, "要輸入兩次");
assert.match(requestFn, /requestedByAdminId: Number\(caller\.id\)/);
assert.match(requestFn, /guardian_email_change_audit/);
assert.match(requestFn, /maskedEmail\(newEmail\)/, "稽核只存遮蔽後的信箱");
assert.doesNotMatch(requestFn, /guardian_contacts"\)\s*\.(update|upsert|insert)/, "發起階段不可直接改家長信箱");
const confirmFn = sliceBetween(edge, "const adminConfirmGuardianEmailChange = async (", "Deno.serve(");
assert.match(confirmFn, /admin_confirm_guardian_email_verification_v1/);
assert.match(confirmFn, /!requestRow\.requested_by_admin_id/, "學生自己發起的要求不能由這裡確認");
assert.doesNotMatch(confirmFn, /guardian_contacts"\)\s*\.(update|upsert|insert)/, "只能透過資料庫函式換信箱");

// ---- 前端服務 ----
assert.match(service, /"admin_guardian_email_status"/);
assert.match(service, /"admin_request_guardian_email_change"/);
assert.match(service, /"admin_confirm_guardian_email_change"/);

console.log("admin guardian email change contract checks passed");
