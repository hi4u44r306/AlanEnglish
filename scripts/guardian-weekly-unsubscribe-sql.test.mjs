// 在隔離的記憶體 PostgreSQL 執行真的 migration；不讀任何密鑰、不連 Supabase。
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
const migration = readFileSync(new URL("../supabase/migrations/20261113100000_guardian_weekly_unsubscribe.sql", import.meta.url), "utf8");
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

before(async () => {
    await db.exec(`
        create role anon; create role authenticated; create role service_role;
        create table public.students (id bigint primary key);
        create table public.guardian_contacts (id bigint generated always as identity primary key, student_id bigint unique references public.students(id), email text, notification_enabled boolean default true);
        insert into public.students values (1), (2), (9);
        insert into public.guardian_contacts (student_id, email) values (1, 'a@example.com'), (2, 'b@example.com');
    `);
    await db.exec(migration);
});
after(async () => { await db.close(); });

test("existing contacts keep working: not opted out, link version 1, notification_enabled untouched", async () => {
    const row = await one("select weekly_report_opted_out_at, weekly_report_link_version, notification_enabled from public.guardian_contacts where student_id = 1");
    assert.equal(row.weekly_report_opted_out_at, null);
    assert.equal(row.weekly_report_link_version, 1);
    assert.equal(row.notification_enabled, true);
});

test("opting out sets the dedicated column only, logs once, and repeating changes nothing", async () => {
    const first = (await one("select public.guardian_weekly_report_opt_out(1, 1, 'email_link') r")).r;
    assert.equal(first.status, "opted_out");
    const row = await one("select weekly_report_opted_out_at, weekly_report_opted_out_source, notification_enabled from public.guardian_contacts where student_id = 1");
    assert.ok(row.weekly_report_opted_out_at);
    assert.equal(row.weekly_report_opted_out_source, "email_link");
    assert.equal(row.notification_enabled, true);
    const again = (await one("select public.guardian_weekly_report_opt_out(1, 1, 'email_link') r")).r;
    assert.equal(again.status, "already");
    assert.equal((await rows("select 1 from public.guardian_weekly_report_choices where student_id = 1")).length, 1);
});

test("a contact id that belongs to another student cannot be opted out", async () => {
    const result = (await one("select public.guardian_weekly_report_opt_out(2, 1, 'email_link') r")).r;
    assert.equal(result.status, "already");
    assert.equal((await one("select weekly_report_opted_out_at from public.guardian_contacts where student_id = 2")).weekly_report_opted_out_at, null);
    await assert.rejects(db.query("select public.guardian_weekly_report_opt_out(1, 1, 'bogus')"), /invalid source/);
});

test("re-enabling clears the opt-out, bumps the link version and logs the actor; a second call is a no-op", async () => {
    const result = (await one("select public.guardian_weekly_report_re_enable(1, 9) r")).r;
    assert.equal(result.status, "re_enabled");
    const row = await one("select weekly_report_opted_out_at, weekly_report_opted_out_source, weekly_report_link_version from public.guardian_contacts where student_id = 1");
    assert.equal(row.weekly_report_opted_out_at, null);
    assert.equal(row.weekly_report_opted_out_source, null);
    assert.equal(row.weekly_report_link_version, 2);
    assert.equal((await one("select public.guardian_weekly_report_re_enable(1, 9) r")).r.status, "not_opted_out");
    const log = await rows("select choice, source, actor_id from public.guardian_weekly_report_choices where student_id = 1 order by id");
    assert.deepEqual(log.map(r => r.choice), ["opt_out", "re_enable"]);
    assert.equal(Number(log[1].actor_id), 9);
});

test("only the service role can run the functions or touch the log", async () => {
    const privilege = async (role, fn) => (await one(`select has_function_privilege('${role}', '${fn}', 'execute') ok`)).ok;
    for (const fn of ["public.guardian_weekly_report_opt_out(bigint,bigint,text)", "public.guardian_weekly_report_re_enable(bigint,bigint)"]) {
        assert.equal(await privilege("service_role", fn), true);
        for (const role of ["anon", "authenticated"]) assert.equal(await privilege(role, fn), false);
    }
    for (const role of ["anon", "authenticated"]) {
        assert.equal((await one(`select has_table_privilege('${role}', 'public.guardian_weekly_report_choices', 'select') ok`)).ok, false);
    }
    assert.equal((await one("select relrowsecurity from pg_class where relname = 'guardian_weekly_report_choices'")).relrowsecurity, true);
});

test("running the migration twice is safe", async () => {
    await db.exec(migration);
    assert.equal((await rows("select 1 from public.guardian_weekly_report_choices")).length, 2);
});
