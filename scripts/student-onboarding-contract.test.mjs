import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [migration, recoveryMigration, membership, academy, protectedRoute] = await Promise.all([
    read("supabase/migrations/20260916015253_student_onboarding_guardian_email_verification.sql"),
    read("supabase/migrations/20260909090000_secure_academy_recovery_codes.sql"),
    read("supabase/functions/membership-manager/index.ts"),
    read("supabase/functions/academy-student-manager/index.ts"),
    read("src/auth/ProtectedRoute.jsx")
]);

assert.match(migration, /add column if not exists onboarding_required boolean not null default false/i);
assert.match(migration, /add column if not exists email_verified_at timestamptz/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.guardian_email_verification_requests from public, anon, authenticated/i);
assert.match(migration, /code_hash text not null/i);
assert.doesNotMatch(migration, /\bcode\s+text\s+not null/i, "database must not store the plaintext OTP");
assert.match(migration, /prevent_student_birth_date_change/i);
assert.match(migration, /student_date_of_birth_is_immutable/i);
assert.match(migration, /on conflict \(student_id\) do update/i);
assert.match(migration, /complete_student_onboarding_if_ready/i);

assert.match(membership, /GUARDIAN_EMAIL_OTP_SECRET/);
assert.match(membership, /crypto\.subtle\.sign\(\s*"HMAC"/);
assert.match(membership, /request_guardian_email_verification/);
assert.match(membership, /confirm_guardian_email_verification/);
assert.match(membership, /家長 Email 必須先完成驗證/);
assert.match(membership, /set_student_birth_date_once/);
assert.doesNotMatch(
    membership.match(/if \(action === "update_student_profile"\)[\s\S]*?if \(action === "notifications"\)/)?.[0] || "",
    /\.from\("guardian_contacts"\)[\s\S]*?\.upsert/,
    "profile updates must not directly overwrite the guardian email"
);

assert.match(academy, /passwordUpdatedAt/);
assert.match(academy, /temporary_password:\s*hiddenBootstrapPassword/);
assert.match(academy, /return `Ae-\$\{compact\.slice\(0, 4\)\}-\$\{compact\.slice\(4, 8\)\}`/);
assert.match(academy, /return String\(values\[0\] % range\)\.padStart\(6, "0"\)/);
assert.match(academy, /createStudentRecoveryCodes/);
assert.match(academy, /reserve_academy_student_recovery_code/);
assert.match(academy, /RECOVERY_RATE_LIMITED/);
assert.match(academy, /p_guardian_email: null/);
assert.doesNotMatch(
    academy.match(/\.from\("academy_student_import_results"\)[\s\S]*?if \(resultAuditError\)/)?.[0] || "",
    /temporary_password/,
    "the import audit log must not persist a temporary password"
);

assert.match(recoveryMigration, /academy_student_recovery_attempts/);
assert.match(recoveryMigration, /v_failed_attempts >= 5/);
assert.match(recoveryMigration, /now\(\) - interval '1 hour'/);
assert.match(recoveryMigration, /reservation_expires_at = now\(\) \+ interval '5 minutes'/);
assert.match(recoveryMigration, /revoke all on public\.academy_student_recovery_attempts from public, anon, authenticated/i);
assert.match(recoveryMigration, /grant execute on function public\.reserve_academy_student_recovery_code[\s\S]*to service_role/i);

assert.match(protectedRoute, /studentProfile\?\.onboarding\?\.required === true/);
assert.match(protectedRoute, /to="\/student\/onboarding"/);

console.log("student onboarding contract checks passed");
