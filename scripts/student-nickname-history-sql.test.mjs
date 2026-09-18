import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.PGLITE_MODULE
    ? pathToFileURL(process.env.PGLITE_MODULE).href
    : "@electric-sql/pglite");
const db = new PGlite();
const migration = readFileSync(
    new URL("../supabase/migrations/20260918023325_student_nickname_history.sql", import.meta.url),
    "utf8"
);

const saveProfile = async nickname => db.query(`
    select (public.set_student_social_profile_v1(
        1, $1, 'AE-ABCDEFGH', 'friends', 'friends', 1, 'student_settings'
    )).*;
`, [nickname]);

before(async () => {
    await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create table public.students (id bigint primary key);
        create table public.student_social_profiles (
            student_id bigint primary key references public.students(id) on delete cascade,
            nickname text not null,
            nickname_normalized text generated always as (lower(btrim(nickname))) stored,
            friend_code text not null,
            stats_visibility text not null default 'friends',
            presence_visibility text not null default 'friends',
            last_active_at timestamptz,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        );
        create unique index student_social_profiles_nickname_key
            on public.student_social_profiles(nickname_normalized);
        insert into public.students(id) values (1), (2);
        grant all on table public.student_social_profiles to service_role;
    `);
    await db.exec(migration);
});

after(() => db.close());

test("records initial nickname and only real later changes", async () => {
    await saveProfile("Sunny Fox");
    await saveProfile("Sunny Fox");
    await saveProfile("Brave Owl");

    const { rows } = await db.query(`
        select previous_nickname, new_nickname, change_source
        from public.student_nickname_history
        where student_id = 1
        order by id;
    `);
    assert.deepEqual(rows, [
        { previous_nickname: null, new_nickname: "Sunny Fox", change_source: "student_settings" },
        { previous_nickname: "Sunny Fox", new_nickname: "Brave Owl", change_source: "student_settings" }
    ]);
});

test("keeps nickname history private from browser database roles", async () => {
    const { rows } = await db.query(`
        select
            has_table_privilege('anon', 'public.student_nickname_history', 'select') anon_can_read,
            has_table_privilege('authenticated', 'public.student_nickname_history', 'select') authenticated_can_read,
            has_function_privilege(
                'authenticated',
                'public.set_student_social_profile_v1(bigint,text,text,text,text,bigint,text)',
                'execute'
            ) authenticated_can_execute;
    `);
    assert.deepEqual(rows[0], {
        anon_can_read: false,
        authenticated_can_read: false,
        authenticated_can_execute: false
    });
});
