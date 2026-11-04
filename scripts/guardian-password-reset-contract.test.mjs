import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [migration, edge, service, forgot] = await Promise.all([
    read("supabase/migrations/20261104100000_guardian_password_reset.sql"),
    read("supabase/functions/academy-student-manager/index.ts"),
    read("src/services/academyStudentService.js"),
    read("src/components/Pages/ForgotPassword.jsx")
]);

const sliceBetween = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `找不到 ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `找不到 ${end}`);
    return source.slice(from, to);
};

// ---- 資料庫：資料表只給 service_role，token 只存雜湊 ----
assert.match(migration, /create table if not exists public\.academy_password_reset_tokens/);
assert.match(migration, /token_hash char\(64\) not null unique/);
assert.doesNotMatch(migration, /\btoken\s+text\b/i, "不可存明文 token");
assert.match(migration, /alter table public\.academy_password_reset_tokens enable row level security/);
assert.match(migration, /alter table public\.academy_password_reset_requests enable row level security/);
assert.match(migration, /revoke all on table public\.academy_password_reset_tokens from public, anon, authenticated/);
assert.match(migration, /revoke all on table public\.academy_password_reset_requests from public, anon, authenticated/);
assert.doesNotMatch(migration, /grant[^;]*on table public\.academy_password_reset_[a-z]+ to (anon|authenticated|public)/i);
assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b|\bdelete\s+from\b|\btruncate\b/i, "migration 必須只新增，不動既有資料");

for (const fn of [
    "request_academy_guardian_password_reset\\(text, char\\(64\\), char\\(64\\), char\\(64\\)\\)",
    "preview_academy_password_reset\\(char\\(64\\)\\)",
    "reserve_academy_password_reset\\(char\\(64\\), char\\(64\\)\\)",
    "complete_academy_password_reset\\(bigint, char\\(64\\)\\)"
]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\s+from public, anon, authenticated`, "i"), `缺少 revoke：${fn}`);
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn} to service_role`, "i"), `缺少 grant：${fn}`);
}

// ---- 資格：只寄給「已驗證且確實收過驗證碼」的家長信箱、已啟用的英文班學生 ----
const requestFn = sliceBetween(migration, "create or replace function public.request_academy_guardian_password_reset", "-- 2) 預覽");
assert.match(requestFn, /email_verified_at is not null/);
assert.match(requestFn, /r\.status = 'verified'/, "必須確認真的收過驗證碼");
assert.match(requestFn, /r\.pending_email = lower\(btrim\(g\.email\)\)/);
assert.match(requestFn, /authentication_method = 'academy_username'/);
assert.match(requestFn, /activated_at is not null/);
assert.match(requestFn, /interval '30 minutes'/, "token 30 分鐘有效");
assert.match(requestFn, /v_recent_user >= 3/, "同帳號每小時最多 3 次");
assert.match(requestFn, /v_recent_source >= 20/, "同來源每小時最多 20 次");
assert.match(requestFn, /interval '60 seconds'/, "60 秒冷卻");
assert.match(requestFn, /set revoked_at = now\(\)/, "新要求要作廢舊 token");

const completeFn = sliceBetween(migration, "create or replace function public.complete_academy_password_reset", "revoke all on function public.request_academy_guardian_password_reset");
assert.match(completeFn, /reservation_hash = p_reservation_hash/);
assert.match(completeFn, /reservation_expires_at > now\(\)/);
assert.match(completeFn, /must_change_password = false/);

// ---- Edge：三個免登入 action、同樣的回應、固定延遲、不洩漏 ----
assert.match(edge, /action === "request_guardian_password_reset"/);
assert.match(edge, /action === "preview_guardian_password_reset"/);
assert.match(edge, /action === "complete_guardian_password_reset"/);
const dispatch = sliceBetween(edge, 'action === "request_guardian_password_reset"', "const token = extractFirebaseToken(req);");
assert.ok(dispatch.length > 0, "三個 action 必須在要求 Firebase 登入之前處理（忘記密碼時學生沒有登入）");

const requestEdge = sliceBetween(edge, "const requestGuardianPasswordReset = async (", "const resetLinkInvalid");
assert.match(requestEdge, /GUARDIAN_RESET_MIN_RESPONSE_MS/, "回應時間要補齊");
assert.match(requestEdge, /hashInvitationToken\(`guardian-reset:\$\{username\}`\)/, "以帳號雜湊限流");
assert.match(requestEdge, /generic\(\)/);
assert.doesNotMatch(requestEdge, /json\(req, 200, \{[^}]*email:/, "回應不可帶出信箱");
assert.match(requestEdge, /\.update\(\{ revoked_at:/, "寄信失敗要作廢 token");
assert.match(requestEdge, /429/);
assert.doesNotMatch(requestEdge, /console\.(log|error)\([^)]*rawToken/, "不可記錄明文 token");
assert.doesNotMatch(requestEdge, /console\.(log|error)\([^)]*data\.email/, "不可記錄家長信箱");

const completeEdge = sliceBetween(edge, "const completeGuardianPasswordReset = async (", "const markPasswordChanged = async (");
assert.match(completeEdge, /validateStudentPassword/);
assert.match(completeEdge, /reserve_academy_password_reset/);
assert.ok(
    completeEdge.indexOf("reserve_academy_password_reset") < completeEdge.indexOf("updateFirebasePasswordByUid")
        && completeEdge.indexOf("updateFirebasePasswordByUid") < completeEdge.indexOf("complete_academy_password_reset"),
    "順序必須是：先保留 → 改 Firebase 密碼 → 完成"
);

// ---- 前端：呼叫的是這三個 action，且忘記密碼頁沒有洩漏 ----
assert.match(service, /action: "request_guardian_password_reset"/);
assert.match(service, /action: "preview_guardian_password_reset"/);
assert.match(service, /action: "complete_guardian_password_reset"/);
assert.match(forgot, /requestGuardianPasswordReset/);

console.log("guardian password reset contract checks passed");
