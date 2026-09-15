begin;

create table if not exists public.speaking_alphabet_audio_candidates (
    id uuid primary key default gen_random_uuid(),
    question_set_id bigint not null references public.speaking_question_sets(id) on delete cascade,
    question_set_version integer not null,
    revision text not null,
    voice_id text not null,
    settings_hash text not null,
    source_fingerprint text not null,
    assembler_version text not null,
    private_object_key text,
    mime_type text not null default 'audio/wav',
    byte_size bigint,
    duration_ms integer,
    segments jsonb not null default '[]'::jsonb,
    status text not null default 'processing',
    processing_token uuid,
    previous_sequence jsonb,
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    activated_at timestamptz,
    unique (question_set_id, question_set_version, revision),
    constraint speaking_alphabet_audio_candidates_revision_check
        check (btrim(revision) <> '' and char_length(revision) <= 80),
    constraint speaking_alphabet_audio_candidates_voice_check
        check (btrim(voice_id) <> '' and char_length(voice_id) <= 120),
    constraint speaking_alphabet_audio_candidates_hash_check
        check (settings_hash ~ '^[a-f0-9]{64}$' and source_fingerprint ~ '^[a-f0-9]{64}$'),
    constraint speaking_alphabet_audio_candidates_assembler_check
        check (btrim(assembler_version) <> '' and char_length(assembler_version) <= 80),
    constraint speaking_alphabet_audio_candidates_object_key_check
        check (private_object_key is null or (btrim(private_object_key) <> '' and private_object_key !~ '(^|/)\.\.(/|$)')),
    constraint speaking_alphabet_audio_candidates_mime_check check (mime_type = 'audio/wav'),
    constraint speaking_alphabet_audio_candidates_size_check
        check (byte_size is null or byte_size between 45 and 20971520),
    constraint speaking_alphabet_audio_candidates_duration_check
        check (duration_ms is null or duration_ms between 1000 and 300000),
    constraint speaking_alphabet_audio_candidates_segments_check
        check (jsonb_typeof(segments) = 'array' and jsonb_array_length(segments) <= 26),
    constraint speaking_alphabet_audio_candidates_status_check
        check (status in ('processing', 'ready', 'active', 'superseded', 'failed', 'rolled_back')),
    constraint speaking_alphabet_audio_candidates_ready_check
        check (status not in ('ready', 'active', 'superseded') or (
            private_object_key is not null and byte_size is not null and duration_ms is not null
            and jsonb_array_length(segments) = 26 and completed_at is not null
        ))
);

create unique index if not exists speaking_alphabet_audio_candidates_one_active_idx
    on public.speaking_alphabet_audio_candidates(question_set_id)
    where status = 'active';

alter table public.speaking_alphabet_audio_candidates enable row level security;
revoke all on table public.speaking_alphabet_audio_candidates from public, anon, authenticated;
grant select, insert, update, delete on table public.speaking_alphabet_audio_candidates to service_role;

create or replace function public.activate_speaking_alphabet_audio_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    candidate public.speaking_alphabet_audio_candidates%rowtype;
    current_sequence public.speaking_question_set_audio_sequences%rowtype;
    current_set public.speaking_question_sets%rowtype;
begin
    select * into candidate from public.speaking_alphabet_audio_candidates
    where id = p_candidate_id for update;
    if not found or candidate.status <> 'ready' then
        raise exception 'alphabet candidate is not ready' using errcode = '22023';
    end if;

    select * into current_set from public.speaking_question_sets
    where id = candidate.question_set_id for update;
    if not found or current_set.version <> candidate.question_set_version
       or current_set.generation_metadata->>'template_key' <> 'workbook_1_alphabet_round_v1'
       or current_set.generation_metadata->>'interaction_type' <> 'alphabet_round' then
        raise exception 'alphabet question set changed' using errcode = '40001';
    end if;

    select * into current_sequence from public.speaking_question_set_audio_sequences
    where question_set_id = candidate.question_set_id and purpose = 'alphabet_master' for update;
    if not found or current_sequence.status <> 'ready' then
        raise exception 'current alphabet sequence is not ready' using errcode = '55000';
    end if;

    update public.speaking_alphabet_audio_candidates
    set status = 'superseded', updated_at = now()
    where question_set_id = candidate.question_set_id and status = 'active';

    update public.speaking_question_set_audio_sequences
    set question_set_version = candidate.question_set_version,
        source_fingerprint = candidate.source_fingerprint,
        assembler_version = candidate.assembler_version,
        private_object_key = candidate.private_object_key,
        mime_type = candidate.mime_type,
        byte_size = candidate.byte_size,
        duration_ms = candidate.duration_ms,
        segments = candidate.segments,
        status = 'ready',
        error_code = null,
        error_message = null,
        assembly_token = null,
        completed_at = candidate.completed_at,
        updated_at = now()
    where question_set_id = candidate.question_set_id and purpose = 'alphabet_master';

    update public.speaking_alphabet_audio_candidates
    set status = 'active', previous_sequence = to_jsonb(current_sequence),
        activated_at = now(), updated_at = now()
    where id = candidate.id;

    return jsonb_build_object('activated', true, 'candidate_id', candidate.id);
end;
$$;

revoke all on function public.activate_speaking_alphabet_audio_candidate(uuid)
    from public, anon, authenticated;
grant execute on function public.activate_speaking_alphabet_audio_candidate(uuid) to service_role;

comment on table public.speaking_alphabet_audio_candidates is
    'Server-only immutable A-Z master audio candidates. The current student sequence changes only after explicit admin approval.';
comment on function public.activate_speaking_alphabet_audio_candidate(uuid) is
    'Service-role-only atomic activation that preserves the previous ready sequence for emergency manual recovery.';

commit;
