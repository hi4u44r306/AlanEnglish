import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrationName = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .find(name => name.endsWith("_create_academy_staff_login_record.sql"));

test("only admins can create staff, in the function and in the database", () => {
    const handler = read("supabase/functions/academy-student-manager/index.ts");
    const action = handler.slice(handler.indexOf("const createStaffAccount"), handler.indexOf("const reissueStudentLoginCard"));
    assert.match(action, /caller\.role !== "admin"/);
    assert.match(action, /STAFF_ACCOUNT_ROLES\.has\(role\)/);
    assert.match(action, /rollbackFirebaseAccount\(firebaseAccount\.idToken\)/);
    // The response never carries the hidden bootstrap password.
    assert.doesNotMatch(action.slice(action.indexOf("return json(req, 201")), /temporary_password|hiddenBootstrapPassword/);

    const migration = read(`supabase/migrations/${migrationName}`);
    assert.match(migration, /creator\.role = 'admin'/);
    assert.match(migration, /p_role not in \('teacher', 'admin'\)/);
    assert.match(migration, /from public, anon, authenticated;/);
    assert.match(migration, /to service_role;/);
    assert.doesNotMatch(migration, /security definer/i);
    assert.doesNotMatch(migration, /academy_enrollments/);
});

test("only admins can change a teacher's classes, and removed classes are switched off rather than deleted", () => {
    const handler = read("supabase/functions/academy-student-manager/index.ts");
    const action = handler.slice(handler.indexOf("const manageTeacherClasses"), handler.indexOf("const reissueStudentLoginCard"));
    assert.match(action, /caller\.role !== "admin"/);
    assert.match(action, /teacher\.role !== "teacher"/);
    assert.match(action, /STAFF_CLASS_CODES\.has\(code\)/);
    assert.match(action, /can_publish: false, ends_at: today/);
    assert.doesNotMatch(action, /\.delete\(\)/);
});

test("the page is reachable by admins only", () => {
    const app = read("src/app/App.jsx");
    assert.match(app, /path="\/admin\/accounts\/create-staff" element=\{<ProtectedRoute allowedRoles=\{\["admin"\]\}>/);
});
