// Executes the real A-Z candidate migration in isolated in-memory PostgreSQL.
// It never reads credentials or connects to a Supabase project.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.PGLITE_MODULE
    ? pathToFileURL(process.env.PGLITE_MODULE).href
    : "@electric-sql/pglite");
const db = new PGlite();
const migration = readFileSync(
    new URL("../supabase/migrations/20260913180000_speaking_alphabet_audio_candidates.sql", import.meta.url),
    "utf8"
);
const hash = character => character.repeat(64);
const segments = voice => JSON.stringify("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, index) => ({
    question_id: 1001 + index,
    letter,
    start_ms: index * 1500,
    end_ms: (index + 1) * 1500,
    voice_id: voice
})));

before(async () => {
    await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create table public.speaking_question_sets (
            id bigint primary key,
            version integer not null,
            generation_metadata jsonb not null default '{}'::jsonb
        );
        create table public.speaking_question_set_audio_sequences (
            question_set_id bigint not null references public.speaking_question_sets(id),
            purpose text not null,
            question_set_version integer not null,
            source_fingerprint text not null,
            assembler_version text not null,
            private_object_key text,
            mime_type text not null,
            byte_size bigint,
            duration_ms integer,
            segments jsonb not null,
            status text not null,
            error_code text,
            error_message text,
            assembly_token uuid,
            completed_at timestamptz,
            updated_at timestamptz not null default now(),
            primary key (question_set_id, purpose)
        );
        insert into public.speaking_question_sets(id, version, generation_metadata) values
            (7, 1, '{"template_key":"workbook_1_alphabet_round_v1","interaction_type":"alphabet_round"}');
        insert into public.speaking_question_set_audio_sequences values (
            7, 'alphabet_master', 1, '${hash("a")}', 'alphabet-pcm-sequence-v1',
            'speaking-tts/old.wav', 'audio/wav', 1000, 40000,
            '${segments("en-US-Chirp3-HD-Autonoe")}'::jsonb, 'ready', null, null, null, now(), now()
        );
    `);
    await db.exec(migration);
});

after(() => db.close());

test("核准候選會原子切換主音檔並保存舊 sequence 快照", async () => {
    const inserted = await db.query(`
        insert into public.speaking_alphabet_audio_candidates (
            question_set_id, question_set_version, revision, voice_id, settings_hash,
            source_fingerprint, assembler_version, private_object_key, byte_size,
            duration_ms, segments, status, completed_at
        ) values (
            7, 1, 'alphabet-neural2-f-sequence-v1', 'en-US-Neural2-F', '${hash("b")}',
            '${hash("c")}', 'alphabet-single-sequence-v1', 'speaking-tts/new.wav', 2000,
            39000, $1::jsonb, 'ready', now()
        ) returning id
    `, [segments("en-US-Neural2-F")]);
    const candidateId = inserted.rows[0].id;
    await db.query("select public.activate_speaking_alphabet_audio_candidate($1::uuid)", [candidateId]);
    const sequence = (await db.query("select * from public.speaking_question_set_audio_sequences where question_set_id = 7")).rows[0];
    const candidate = (await db.query("select status, previous_sequence from public.speaking_alphabet_audio_candidates where id = $1", [candidateId])).rows[0];
    assert.equal(sequence.private_object_key, "speaking-tts/new.wav");
    assert.equal(sequence.assembler_version, "alphabet-single-sequence-v1");
    assert.equal(candidate.status, "active");
    assert.equal(candidate.previous_sequence.private_object_key, "speaking-tts/old.wav");
});

test("題庫版本改變時整筆交易失敗且目前主音檔不變", async () => {
    const inserted = await db.query(`
        insert into public.speaking_alphabet_audio_candidates (
            question_set_id, question_set_version, revision, voice_id, settings_hash,
            source_fingerprint, assembler_version, private_object_key, byte_size,
            duration_ms, segments, status, completed_at
        ) values (
            7, 2, 'future-revision', 'en-US-Neural2-F', '${hash("d")}', '${hash("e")}',
            'alphabet-single-sequence-v1', 'speaking-tts/future.wav', 2100, 39000,
            $1::jsonb, 'ready', now()
        ) returning id
    `, [segments("en-US-Neural2-F")]);
    await assert.rejects(
        db.query("select public.activate_speaking_alphabet_audio_candidate($1::uuid)", [inserted.rows[0].id]),
        /alphabet question set changed/
    );
    const sequence = (await db.query("select private_object_key from public.speaking_question_set_audio_sequences where question_set_id = 7")).rows[0];
    assert.equal(sequence.private_object_key, "speaking-tts/new.wav");
});
