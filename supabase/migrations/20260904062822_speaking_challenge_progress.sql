begin;

create table if not exists public.speaking_challenge_question_progress (
    student_id bigint not null references public.students(id) on delete cascade,
    question_set_id bigint not null references public.speaking_question_sets(id) on delete cascade,
    question_id bigint not null references public.speaking_questions(id) on delete cascade,
    status text not null default 'opened',
    opened_at timestamptz not null default now(),
    completed_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (student_id, question_id),
    constraint speaking_challenge_progress_status_check check (status in ('opened', 'completed')),
    constraint speaking_challenge_progress_completed_check check (
        (status = 'completed' and completed_at is not null) or status = 'opened'
    )
);

create index if not exists speaking_challenge_progress_student_set_idx
    on public.speaking_challenge_question_progress(student_id, question_set_id, updated_at desc);

alter table public.speaking_challenge_question_progress enable row level security;
revoke all on table public.speaking_challenge_question_progress from public, anon, authenticated;
grant select, insert, update, delete on table public.speaking_challenge_question_progress to service_role;

comment on table public.speaking_challenge_question_progress is
    'Student self-reported practice progress for published textbook speaking questions. It never grants XP or AE Points.';

commit;
