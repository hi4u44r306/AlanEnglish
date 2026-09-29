begin;

-- Existing question progress remains the easy mode and continues to unlock
-- the next published page. Challenge achievements never grant XP or points.
create table public.speaking_challenge_mode_progress (
    student_id bigint not null references public.students(id) on delete cascade,
    question_set_id bigint not null references public.speaking_question_sets(id) on delete cascade,
    question_id bigint not null references public.speaking_questions(id) on delete cascade,
    completed_at timestamptz not null default now(),
    primary key (student_id, question_id)
);
create index speaking_challenge_mode_progress_student_set_idx
    on public.speaking_challenge_mode_progress(student_id, question_set_id);
alter table public.speaking_challenge_mode_progress enable row level security;
revoke all on public.speaking_challenge_mode_progress from public, anon, authenticated;
grant select, insert on public.speaking_challenge_mode_progress to service_role;

-- A hint belongs to one client round and one published question. The client
-- can begin a new round, subject to the existing daily five-round limit.
create table public.speaking_challenge_hint_reveals (
    student_id bigint not null references public.students(id) on delete cascade,
    question_set_id bigint not null references public.speaking_question_sets(id) on delete cascade,
    question_id bigint not null references public.speaking_questions(id) on delete cascade,
    client_session_id uuid not null,
    revealed_at timestamptz not null default now(),
    primary key (student_id, question_id, client_session_id)
);
create index speaking_challenge_hint_reveals_student_set_idx
    on public.speaking_challenge_hint_reveals(student_id, question_set_id, client_session_id);
alter table public.speaking_challenge_hint_reveals enable row level security;
revoke all on public.speaking_challenge_hint_reveals from public, anon, authenticated;
grant select, insert on public.speaking_challenge_hint_reveals to service_role;

alter table public.speaking_pronunciation_attempts
    add column challenge_mode text not null default 'easy'
        check (challenge_mode in ('easy', 'challenge')),
    add column client_session_id uuid,
    add column hint_used boolean not null default false;
create index speaking_pronunciation_attempts_mode_session_idx
    on public.speaking_pronunciation_attempts(
        student_id, question_id, challenge_mode, client_session_id, created_at desc
    );

comment on table public.speaking_challenge_mode_progress is
    'Independent no-hint challenge achievements; easy progress alone unlocks the next page.';
comment on table public.speaking_challenge_hint_reveals is
    'Server-recorded answer reveals per student, question and client round.';

commit;
