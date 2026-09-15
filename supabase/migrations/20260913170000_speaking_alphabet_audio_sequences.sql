begin;

create table if not exists public.speaking_question_set_audio_sequences (
    question_set_id bigint not null references public.speaking_question_sets(id) on delete cascade,
    purpose text not null default 'alphabet_master',
    question_set_version integer not null,
    source_fingerprint text not null,
    assembler_version text not null default 'alphabet-pcm-sequence-v1',
    private_object_key text,
    mime_type text not null default 'audio/wav',
    byte_size bigint,
    duration_ms integer,
    segments jsonb not null default '[]'::jsonb,
    status text not null default 'processing',
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    primary key (question_set_id, purpose),
    constraint speaking_question_set_audio_sequences_purpose_check
        check (purpose in ('alphabet_master')),
    constraint speaking_question_set_audio_sequences_fingerprint_check
        check (source_fingerprint ~ '^[a-f0-9]{64}$'),
    constraint speaking_question_set_audio_sequences_version_check
        check (question_set_version > 0),
    constraint speaking_question_set_audio_sequences_assembler_check
        check (btrim(assembler_version) <> '' and char_length(assembler_version) <= 80),
    constraint speaking_question_set_audio_sequences_object_key_check
        check (private_object_key is null or (btrim(private_object_key) <> '' and private_object_key !~ '(^|/)\.\.(/|$)')),
    constraint speaking_question_set_audio_sequences_mime_check
        check (mime_type = 'audio/wav'),
    constraint speaking_question_set_audio_sequences_size_check
        check (byte_size is null or byte_size between 1 and 20971520),
    constraint speaking_question_set_audio_sequences_duration_check
        check (duration_ms is null or duration_ms between 1 and 300000),
    constraint speaking_question_set_audio_sequences_segments_check
        check (jsonb_typeof(segments) = 'array' and jsonb_array_length(segments) <= 26),
    constraint speaking_question_set_audio_sequences_status_check
        check (status in ('processing', 'ready', 'failed')),
    constraint speaking_question_set_audio_sequences_ready_check
        check (status <> 'ready' or (
            private_object_key is not null
            and byte_size is not null
            and duration_ms is not null
            and jsonb_array_length(segments) = 26
            and completed_at is not null
        ))
);

create index if not exists speaking_question_set_audio_sequences_status_idx
    on public.speaking_question_set_audio_sequences(status, updated_at desc);

alter table public.speaking_question_set_audio_sequences enable row level security;
revoke all on table public.speaking_question_set_audio_sequences from public, anon, authenticated;
grant select, insert, update, delete on table public.speaking_question_set_audio_sequences to service_role;

comment on table public.speaking_question_set_audio_sequences is
    'Server-only link and cue manifest for a derived question-set audio sequence; private object keys never reach clients.';

commit;
