alter table public.music_tracks
    add column if not exists storage_provider text not null default 'supabase',
    add column if not exists storage_size_bytes bigint,
    add column if not exists storage_etag text,
    add column if not exists storage_verified_at timestamptz,
    add column if not exists r2_migrated_at timestamptz,
    add column if not exists storage_migration_attempted_at timestamptz,
    add column if not exists storage_migration_error text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'music_tracks_storage_provider_check'
          and conrelid = 'public.music_tracks'::regclass
    ) then
        alter table public.music_tracks
            add constraint music_tracks_storage_provider_check
            check (storage_provider in ('supabase', 'r2'));
    end if;
end $$;

create index if not exists music_tracks_storage_provider_idx
    on public.music_tracks (storage_provider, id);

comment on column public.music_tracks.storage_provider is
    'Private object storage currently serving this track. Per-track switching keeps migration reversible.';
comment on column public.music_tracks.audio_url is
    'Private object key only; never store a long-lived public or presigned URL here.';

create table if not exists public.audio_storage_settings (
    singleton boolean primary key default true check (singleton),
    upload_provider text not null default 'supabase'
        check (upload_provider in ('supabase', 'r2')),
    r2_cors_configured_at timestamptz,
    updated_at timestamptz not null default now()
);

insert into public.audio_storage_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.audio_storage_settings enable row level security;
revoke all privileges on table public.audio_storage_settings from anon, authenticated;
