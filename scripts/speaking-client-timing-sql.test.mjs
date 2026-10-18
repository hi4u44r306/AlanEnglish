// Isolated PostgreSQL only (PGlite). No credentials or remote SQL.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite");
const db = new PGlite();
before(async () => {
    await db.exec(`create role anon; create role authenticated; create role service_role;
        create table public.speaking_local_reading_requests(id uuid primary key default gen_random_uuid(), student_id bigint,
            status text default 'reserved', created_at timestamptz default now());`);
    await db.exec(readFileSync(new URL("../supabase/migrations/20261018120000_speaking_local_client_timing.sql", import.meta.url), "utf8"));
});
after(() => db.close());

test("依平台與模型統計轉文字與往返時間", async () => {
    await db.exec(`insert into public.speaking_local_reading_requests(student_id, client_timing)
        select 1, jsonb_build_object('platform','ios','model','base','transcribe_ms', n * 1000, 'previous_submit_ms', 800)
        from generate_series(1,10) n;
        insert into public.speaking_local_reading_requests(student_id, client_timing) values (2, '{"platform":"android","model":"tiny","transcribe_ms":1500}');`);
    const rows = (await db.query("select * from public.speaking_client_timing_summary_v1(14)")).rows;
    assert.equal(rows[0].platform, "ios");
    assert.equal(Number(rows[0].samples), 10);
    assert.equal(rows[0].transcribe_p50, 5500);
    assert.equal(rows[0].transcribe_p90, 9100);
    assert.equal(rows[0].submit_p50, 800);
    assert.equal(rows[1].model, "tiny");
});

test("只接受小的物件；學生端不能讀統計", async () => {
    await assert.rejects(db.exec(`insert into public.speaking_local_reading_requests(client_timing) values ('[1,2]')`));
    await assert.rejects(db.exec(`insert into public.speaking_local_reading_requests(client_timing) values (jsonb_build_object('x', repeat('a', 2000)))`));
    const allowed = (await db.query(`select has_function_privilege('authenticated','public.speaking_client_timing_summary_v1(integer)','execute') a`)).rows[0];
    assert.equal(allowed.a, false);
});
