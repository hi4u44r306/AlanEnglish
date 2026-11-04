import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [migration, edge, service, route, login] = await Promise.all([
    read("supabase/migrations/20261104110000_admin_student_password_reset.sql"),
    read("supabase/functions/academy-student-manager/index.ts"),
    read("src/services/academyStudentService.js"),
    read("src/auth/ProtectedRoute.jsx"),
    read("src/components/Pages/Login.jsx")
]);

const sliceBetween = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `找不到 ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `找不到 ${end}`);
    return source.slice(from, to);
};

// ---- 資料庫：稽核表不存密碼、只給 service_role ----
assert.match(migration, /create table if not exists public\.academy_student_password_admin_resets/);
assert.doesNotMatch(
    sliceBetween(migration, "create table if not exists public.academy_student_password_admin_resets", "create index"),
    /password\s+text|temporary_password/i,
    "稽核表不可保存密碼"
);
assert.match(migration, /alter table public\.academy_student_password_admin_resets enable row level security/);
assert.match(migration, /revoke all on table public\.academy_student_password_admin_resets from public, anon, authenticated/);
assert.match(migration, /revoke all on function public\.admin_record_student_password_reset_v1\(bigint, bigint, text, timestamptz\)\s+from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.admin_record_student_password_reset_v1\(bigint, bigint, text, timestamptz\)\s+to service_role/);
assert.match(migration, /role = 'admin'\s+and account_status = 'active'/, "資料庫要再確認是有效的管理員");
assert.match(migration, /authentication_method = 'academy_username'/);
assert.match(migration, /activated_at is not null/);
assert.match(migration, /must_change_password = true/);
assert.match(migration, /greatest\(now\(\), coalesce\(p_issued_at, now\(\)\)\)/);
assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b|\bdelete\s+from\b|\btruncate\b/i, "必須只新增，不動既有資料");

// ---- Edge：只有管理員、先改 Firebase 再記錄、不記錄密碼 ----
const fn = sliceBetween(edge, "const adminResetStudentPassword = async (", "const reissueStudentLoginCard = async (");
assert.match(fn, /requireAdmin\(caller\)/);
assert.match(fn, /!student\.activated_at/, "未啟用的帳號要改用重新發登入卡");
assert.match(fn, /CONFIRMATION_MISMATCH/, "要輸入學生帳號確認");
assert.match(fn, /RESET_REASON_REQUIRED/, "要填原因");
assert.ok(
    fn.indexOf("updateFirebasePasswordByUid") < fn.indexOf("admin_record_student_password_reset_v1"),
    "順序必須是：先改 Firebase 密碼，再記錄發放時間"
);
assert.match(fn, /p_issued_at: new Date\(Date\.now\(\) \+ 2000\)\.toISOString\(\)/);
assert.doesNotMatch(fn, /console\.(log|error|warn)\([^)]*temporaryPassword/, "不可記錄臨時密碼");
assert.doesNotMatch(fn, /console\.(log|error|warn)\([^)]*temporary_password/, "不可記錄臨時密碼");

const dispatchIndex = edge.indexOf('action === "admin_reset_student_password"');
assert.ok(dispatchIndex > edge.indexOf("const caller = await getCallerProfile"), "必須在驗證登入並確認身分之後才處理");

// ---- 前端：呼叫與導流 ----
assert.match(service, /action: "admin_reset_student_password"/);
assert.match(service, /"admin_reset_student_password"\]\.includes/, "要清除工作人員頁面快取");
assert.match(route, /authentication_method === "academy_username" && studentProfile\?\.must_change_password === true/);
assert.match(login, /student\?\.authentication_method === "academy_username" && student\?\.must_change_password === true/);

console.log("admin student password reset contract checks passed");
