// Real PostgreSQL run of the workbook platform plan migration, isolated from production.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadEffectiveAccess } from "../supabase/functions/_shared/effective-access.ts";
import { baseBookEntitlementDecision } from "../supabase/functions/_shared/book-entitlement.ts";

const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const migration = readFileSync(new URL("../supabase/migrations/20261013060041_workbook_platform_access_plan.sql", import.meta.url), "utf8");
const access = async id => (await db.query("select public.get_student_effective_access($1) result", [id])).rows[0].result;
// Minimal stand-in for the service client: the RPC plus the plan lookup used when an add-on is stripped.
const admin = {
    rpc: async (_name, args) => ({ data: await access(args.p_student_id), error: null }),
    from: table => ({ select: () => ({
        in: async (_column, codes) => ({ data: (await db.query("select code, ai_daily_limit, features from subscription_plans where code = any($1)", [codes])).rows, error: null }),
        eq: async () => ({ data: table === "academy_enrollments" ? [] : [], error: null })
    }) })
};
const formalBook = { id: 1, enabled: true, content_scope: "formal" };

before(async () => {
    await db.exec(`
        create table students(id bigint primary key, role text not null default 'student', learner_type text);
        create table subscription_plans(
            id bigint generated always as identity primary key, code text not null unique, name text not null, description text,
            price_twd integer, billing_interval text, trial_days integer, ai_daily_limit integer not null default 0,
            stripe_price_id text unique, features jsonb not null default '{}', is_public boolean, enabled boolean not null default true,
            sort_order integer, access_model text);
        create table student_access_grants(
            id bigint generated always as identity primary key, student_id bigint not null, plan_id bigint not null,
            source text, source_reference_type text, source_reference_id text, status text not null default 'active',
            starts_at timestamptz not null default now() - interval '1 day', ends_at timestamptz);
        insert into subscription_plans(code, name, ai_daily_limit, features, access_model) values
          ('academy_internal', '在學', 5, '{"listening":true,"ai_materials":true,"assignments":true,"review":true,"conversation":true,"requires_book_entitlement":false}', 'academy'),
          ('textbook_access', '教材聽力', 0, '{"listening":true,"review":true,"ai_materials":false,"pronunciation":false,"pronunciation_practice":false,"requires_book_entitlement":false}', 'textbook'),
          ('basic_membership_monthly', '基本', 0, '{"listening":true,"review":true,"conversation":true,"ai_materials":false,"pronunciation":false,"requires_book_entitlement":false}', 'subscription'),
          ('ai_materials_addon_monthly', 'AI', 5, '{"ai_materials":true,"pronunciation":true,"pronunciation_practice":true,"requires_book_entitlement":false}', 'addon');
        insert into students(id, role, learner_type) values
          (1,'student','textbook_customer'),(2,'student','textbook_customer'),(3,'student','academy_student'),
          (4,'student','textbook_customer'),(5,'student','textbook_customer'),(6,'admin',null),(7,'student','textbook_customer');
    `);
    await db.exec(migration);
    await db.exec(migration); // re-running must not duplicate the plan or fail
    const grant = (student, code, ends) => db.query(
        "insert into student_access_grants(student_id, plan_id, ends_at) select $1, id, $3::timestamptz from subscription_plans where code = $2", [student, code, ends]);
    const future = new Date(Date.now() + 180 * 86400000).toISOString();
    await grant(1, "workbook_platform_access", future);
    await grant(2, "textbook_access", future);
    await grant(3, "academy_internal", null);
    await grant(4, "workbook_platform_access", future); await grant(4, "basic_membership_monthly", future);
    await grant(5, "workbook_platform_access", new Date(Date.now() - 86400000).toISOString());
    await grant(7, "ai_materials_addon_monthly", future);
});

test("the plan exists once, is not public, and carries speaking without AI", async () => {
    const { rows } = await db.query("select * from subscription_plans where code = 'workbook_platform_access'");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_public, false); assert.equal(rows[0].enabled, true); assert.equal(rows[0].access_model, "textbook");
    assert.equal(rows[0].price_twd, null); assert.equal(rows[0].stripe_price_id, null);
    assert.deepEqual(rows[0].features, { listening: true, review: true, pronunciation: true, pronunciation_practice: true,
        ai_materials: false, conversation: false, assignments: false, requires_book_entitlement: true });
});

test("a workbook buyer gets listening and speaking for owned books only, and no AI or assignments", async () => {
    const result = await loadEffectiveAccess(admin, 1);
    assert.equal(result.is_active, true); assert.equal(result.days_remaining, 180);
    assert.deepEqual(result.features, { listening: true, ai_materials: false, pronunciation: true, conversation: false,
        assignments: false, review: true, requires_book_entitlement: true });
    assert.equal(result.ai_daily_limit, 0);
    // null means "check the per-book entitlement ledger", i.e. not open to every formal book.
    assert.equal(baseBookEntitlementDecision({ id: 1, role: "student" }, result, formalBook), null);
});

test("existing plans resolve exactly as before", async () => {
    const textbook = await loadEffectiveAccess(admin, 2);
    assert.equal(textbook.features.pronunciation, false); assert.equal(textbook.features.listening, true);
    assert.equal(baseBookEntitlementDecision({ id: 2, role: "student" }, textbook, formalBook), true);
    const academyRaw = await access(3);
    assert.equal(academyRaw.features.pronunciation, false); // no key on the plan; granted through ai_materials below
    const academy = await loadEffectiveAccess(admin, 3);
    assert.equal(academy.features.pronunciation, true); assert.equal(academy.features.ai_materials, true); assert.equal(academy.features.assignments, true);
    const staff = await loadEffectiveAccess(admin, 6);
    assert.equal(staff.features.pronunciation, true); assert.equal(staff.is_active, true);
});

test("an expired workbook grant gives nothing", async () => {
    const result = await loadEffectiveAccess(admin, 5);
    assert.equal(result.is_active, false); assert.equal(result.features.pronunciation, false); assert.equal(result.features.listening, false);
});

test("stacking with basic membership keeps speaking and follows the existing all-books rule", async () => {
    const result = await loadEffectiveAccess(admin, 4);
    assert.equal(result.features.pronunciation, true); assert.equal(result.features.conversation, true);
    assert.equal(result.features.requires_book_entitlement, false);
    assert.deepEqual(result.plan_codes, ["basic_membership_monthly", "workbook_platform_access"]);
});

test("an AI add-on without basic membership is still stripped, speaking included", async () => {
    const result = await loadEffectiveAccess(admin, 7);
    assert.equal(result.is_active, false); assert.equal(result.features.pronunciation, false); assert.equal(result.features.ai_materials, false);
});
