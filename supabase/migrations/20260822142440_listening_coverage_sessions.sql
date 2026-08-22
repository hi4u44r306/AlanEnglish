-- Stores server-created listening sessions. Only Edge Functions using the
-- service role may write these rows; browser clients have no direct access.

alter table public.music_tracks
    add column if not exists duration_seconds numeric(10, 2);

alter table public.music_tracks
    drop constraint if exists music_tracks_duration_seconds_check;

alter table public.music_tracks
    add constraint music_tracks_duration_seconds_check
    check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 3600));

create table if not exists public.listening_coverage_sessions (
    id uuid primary key default gen_random_uuid(),
    student_id bigint not null references public.students(id) on delete cascade,
    track_id bigint not null references public.music_tracks(id) on delete cascade,
    duration_seconds numeric(10, 2) not null check (duration_seconds > 0 and duration_seconds <= 3600),
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    covered_ranges jsonb not null default '[]'::jsonb,
    covered_seconds numeric(10, 2) not null default 0 check (covered_seconds >= 0),
    coverage_percent numeric(5, 2) not null default 0 check (coverage_percent >= 0 and coverage_percent <= 100),
    used_accelerated_playback boolean not null default false,
    eligible_for_count boolean not null default true,
    count_recorded boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists listening_coverage_sessions_student_track_started_idx
    on public.listening_coverage_sessions (student_id, track_id, started_at desc);

create index if not exists listening_coverage_sessions_open_idx
    on public.listening_coverage_sessions (student_id, track_id)
    where completed_at is null;

alter table public.listening_coverage_sessions enable row level security;

comment on table public.listening_coverage_sessions is
    'Server-verified listening coverage sessions. Browser clients do not receive direct table access.';

comment on column public.music_tracks.duration_seconds is
    'Canonical audio duration used for listening coverage validation. Null tracks use the first server-session duration until catalog metadata is backfilled.';
