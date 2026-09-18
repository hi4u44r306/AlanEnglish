import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260908053030_student_social_foundation.sql", import.meta.url), "utf8");
const nicknameHistoryMigration = readFileSync(new URL("../supabase/migrations/20260918023325_student_nickname_history.sql", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/student-social/index.ts", import.meta.url), "utf8");
const membershipEdge = readFileSync(new URL("../supabase/functions/membership-manager/index.ts", import.meta.url), "utf8");

test("social tables are private and only served by the backend", () => {
    for (const table of ["student_social_profiles", "student_friendships", "student_social_blocks", "student_social_reports", "student_social_audit_events"]) {
        assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
        assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, "i"));
    }
});

test("nickname changes are atomic, private, and visible only through verified role checks", () => {
    assert.match(nicknameHistoryMigration, /create table if not exists public\.student_nickname_history/i);
    assert.match(nicknameHistoryMigration, /alter table public\.student_nickname_history enable row level security/i);
    assert.match(nicknameHistoryMigration, /revoke all on table public\.student_nickname_history from public, anon, authenticated/i);
    assert.match(nicknameHistoryMigration, /set_student_social_profile_v1/);
    assert.match(nicknameHistoryMigration, /previous_nickname_value is distinct from saved_profile\.nickname/i);
    assert.match(nicknameHistoryMigration, /grant execute on function[\s\S]*to service_role/i);
    assert.match(edge, /action === "nickname_settings"/);
    assert.match(edge, /action === "update_nickname"/);
    assert.match(edge, /nicknameHistory\(admin, caller\.id\)/);
    assert.match(membershipEdge, /action === "nickname_history"/);
    assert.match(membershipEdge, /caller\.role !== "admin"/);
});

test("friendship pairs and public nicknames cannot be duplicated", () => {
    assert.match(migration, /student_social_profiles_nickname_key/);
    assert.match(migration, /least\(requester_id, addressee_id\), greatest\(requester_id, addressee_id\)/);
    assert.match(edge, /DISALLOWED_NICKNAME_TERMS/);
    assert.match(edge, /這個暱稱已被使用，請換一個/);
    assert.match(edge, /nickname_normalized/);
});

test("the Edge Function verifies Firebase and rechecks active platform access", () => {
    assert.match(edge, /verifyFirebaseRequest\(req, admin\)/);
    assert.match(edge, /get_student_effective_access/);
    assert.match(edge, /p_as_of: new Date\(\)\.toISOString\(\)/);
    assert.match(edge, /access\?\.is_active !== true/);
});

test("search, invitations and reports are rate limited and blocks remove friendships", () => {
    assert.match(edge, /withinLimit\(admin, caller\.id, "search"/);
    assert.match(edge, /withinLimit\(admin, caller\.id, "friend_request"/);
    assert.match(edge, /withinLimit\(admin, caller\.id, "report"/);
    assert.match(edge, /student_friendships"\)\.delete\(\)\.or\(relationFilter/);
});

test("uploaded avatars stay private until a friendship is accepted", () => {
    assert.match(edge, /const socialAvatar = async/);
    assert.match(edge, /if \(!canViewUploadedPhoto\) return null/);
    assert.match(edge, /createSignedUrl\(normalized, 15 \* 60\)/);
    assert.match(edge, /socialAvatar\(admin, target\.user_image, relation\?\.status === "accepted"\)/);
});
