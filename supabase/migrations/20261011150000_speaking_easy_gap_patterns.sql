-- Easy mode shows the answer sentence with its key word blanked out and the Chinese cue
-- inside the blank ("They are [餐桌]."). The pattern is authored per question and only
-- reaches students after it has been approved. Additive only; the Edge Function is the
-- sole reader, so the table stays closed to anon and authenticated roles.
-- Rollback: drop table public.speaking_question_easy_gaps;

create table public.speaking_question_easy_gaps (
    question_id bigint primary key references public.speaking_questions(id) on delete cascade,
    gap_pattern text not null check (char_length(gap_pattern) between 3 and 400 and gap_pattern ~ '\[[^\[\]]{1,80}\]'),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    source text not null default 'auto_candidate',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.speaking_question_easy_gaps enable row level security;
revoke all on public.speaking_question_easy_gaps from public, anon, authenticated;
grant select, insert, update, delete on public.speaking_question_easy_gaps to service_role;
