begin;

alter table public.speaking_pronunciation_attempts
    add column if not exists audio_object_key text,
    add column if not exists audio_mime_type text,
    add column if not exists audio_byte_size bigint,
    add column if not exists audio_duration_ms integer,
    add column if not exists audio_saved_at timestamptz,
    add column if not exists audio_deleted_at timestamptz;

alter table public.speaking_pronunciation_attempts
    drop constraint if exists speaking_pronunciation_attempts_audio_byte_size_check,
    add constraint speaking_pronunciation_attempts_audio_byte_size_check
        check (audio_byte_size is null or audio_byte_size between 1000 and 1048576),
    drop constraint if exists speaking_pronunciation_attempts_audio_duration_ms_check,
    add constraint speaking_pronunciation_attempts_audio_duration_ms_check
        check (audio_duration_ms is null or audio_duration_ms between 350 and 20000),
    drop constraint if exists speaking_pronunciation_attempts_audio_mime_type_check,
    add constraint speaking_pronunciation_attempts_audio_mime_type_check
        check (audio_mime_type is null or audio_mime_type = 'audio/wav'),
    drop constraint if exists speaking_pronunciation_attempts_audio_lifecycle_check,
    add constraint speaking_pronunciation_attempts_audio_lifecycle_check
        check (
            (audio_object_key is null and audio_saved_at is null)
            or (audio_object_key is not null and audio_saved_at is not null and audio_deleted_at is null)
        );

create index if not exists speaking_pronunciation_attempts_student_audio_created_idx
    on public.speaking_pronunciation_attempts(student_id, created_at desc, id desc)
    where audio_object_key is not null and audio_deleted_at is null;

grant select, insert, update on table public.speaking_pronunciation_attempts to service_role;

comment on table public.speaking_pronunciation_attempts is
    'Private textbook speaking assessment history. Audio is stored in private R2 and only its object key and metadata are kept here.';
comment on column public.speaking_pronunciation_attempts.audio_object_key is
    'Private R2 object key. The pronunciation-coach Edge Function authorizes the owner before issuing a short-lived URL.';
comment on column public.speaking_pronunciation_attempts.audio_deleted_at is
    'Deletion timestamp for a removed or retention-pruned recording. Scores and progress remain available.';

commit;
