begin;

create table if not exists public.speaking_tts_assets (
    id uuid primary key default gen_random_uuid(),
    provider text not null default 'google_cloud_tts',
    content_hash text not null,
    source_text text not null,
    voice_id text not null,
    language_code text not null default 'en-US',
    output_format text not null default 'mp3',
    sample_rate integer not null default 48000,
    settings_hash text not null,
    settings jsonb not null default '{}'::jsonb,
    private_object_key text,
    status text not null default 'processing',
    byte_size bigint,
    used_characters integer,
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint speaking_tts_assets_provider_check check (provider in ('google_cloud_tts')),
    constraint speaking_tts_assets_hash_check check (content_hash ~ '^[a-f0-9]{64}$' and settings_hash ~ '^[a-f0-9]{64}$'),
    constraint speaking_tts_assets_text_check check (btrim(source_text) <> '' and char_length(source_text) <= 2000),
    constraint speaking_tts_assets_voice_check check (btrim(voice_id) <> '' and char_length(voice_id) <= 120),
    constraint speaking_tts_assets_language_check check (language_code ~ '^[a-z]{2,3}-[A-Z]{2}$'),
    constraint speaking_tts_assets_format_check check (output_format in ('mp3')),
    constraint speaking_tts_assets_sample_rate_check check (sample_rate in (22050, 24000, 44100, 48000)),
    constraint speaking_tts_assets_settings_object check (jsonb_typeof(settings) = 'object'),
    constraint speaking_tts_assets_status_check check (status in ('processing', 'ready', 'failed')),
    constraint speaking_tts_assets_size_check check (byte_size is null or byte_size between 1 and 10485760),
    constraint speaking_tts_assets_used_chars_check check (used_characters is null or used_characters >= 0),
    constraint speaking_tts_assets_ready_consistency check (
        status <> 'ready' or (private_object_key is not null and byte_size is not null and completed_at is not null)
    ),
    constraint speaking_tts_assets_unique_generation unique (provider, content_hash, voice_id, settings_hash)
);

create table if not exists public.speaking_question_audio (
    question_id bigint primary key references public.speaking_questions(id) on delete cascade,
    asset_id uuid not null references public.speaking_tts_assets(id) on delete restrict,
    purpose text not null default 'model_answer',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint speaking_question_audio_purpose_check check (purpose in ('model_answer'))
);

create index if not exists speaking_tts_assets_status_updated_idx
    on public.speaking_tts_assets(status, updated_at desc);
create index if not exists speaking_question_audio_asset_idx
    on public.speaking_question_audio(asset_id);

alter table public.speaking_tts_assets enable row level security;
alter table public.speaking_question_audio enable row level security;

revoke all on table public.speaking_tts_assets from public, anon, authenticated;
revoke all on table public.speaking_question_audio from public, anon, authenticated;
grant select, insert, update, delete on table public.speaking_tts_assets to service_role;
grant select, insert, update, delete on table public.speaking_question_audio to service_role;

comment on table public.speaking_tts_assets is 'Deduplicated private TTS assets generated once by a trusted backend and stored in Cloudflare R2.';
comment on table public.speaking_question_audio is 'Server-only link from a speaking question to its approved model-answer audio asset.';

commit;
