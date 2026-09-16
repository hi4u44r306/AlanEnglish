begin;

create table if not exists public.speaking_pronunciation_requests (
    id uuid primary key default gen_random_uuid(),
    student_id bigint not null references public.students(id) on delete restrict,
    question_set_id bigint not null references public.speaking_question_sets(id) on delete restrict,
    question_id bigint not null references public.speaking_questions(id) on delete restrict,
    interaction_type text,
    provider text not null default 'azure',
    status text not null default 'reserved',
    error_code text,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint speaking_pronunciation_requests_status_check
        check (status in ('reserved', 'completed', 'provider_failed', 'unassessable', 'internal_failed')),
    constraint speaking_pronunciation_requests_interaction_length
        check (interaction_type is null or char_length(interaction_type) <= 80),
    constraint speaking_pronunciation_requests_error_length
        check (error_code is null or char_length(error_code) <= 120)
);

create index if not exists speaking_pronunciation_requests_student_created_idx
    on public.speaking_pronunciation_requests(student_id, created_at desc);

alter table public.speaking_pronunciation_requests enable row level security;
revoke all on table public.speaking_pronunciation_requests from public, anon, authenticated;
grant select, insert, update on table public.speaking_pronunciation_requests to service_role;

create or replace function public.reserve_speaking_pronunciation_request(
    p_student_id bigint,
    p_question_set_id bigint,
    p_question_id bigint,
    p_interaction_type text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_is_foundation boolean := coalesce(btrim(p_interaction_type), '') <> '';
    v_recent_limit integer := case when v_is_foundation then 60 else 12 end;
    v_recent_count integer;
    v_daily_count integer := 0;
    v_request_id uuid;
begin
    if p_student_id is null or p_question_set_id is null or p_question_id is null then
        raise exception 'Pronunciation reservation identifiers are required';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('speaking-pronunciation:' || p_student_id::text, 0));

    if not exists (
        select 1
        from public.speaking_questions question
        join public.speaking_question_sets question_set on question_set.id = question.question_set_id
        where question.id = p_question_id
          and question.question_set_id = p_question_set_id
          and question_set.status = 'published'
    ) then
        raise exception 'Published speaking question does not match its question set';
    end if;

    select count(*) into v_recent_count
    from public.speaking_pronunciation_requests request
    where request.student_id = p_student_id
      and request.created_at >= now() - interval '10 minutes';

    if v_is_foundation then
        select count(*) into v_daily_count
        from public.speaking_pronunciation_requests request
        where request.student_id = p_student_id
          and request.created_at >= now() - interval '24 hours';
    end if;

    if v_recent_count >= v_recent_limit or (v_is_foundation and v_daily_count >= 160) then
        return jsonb_build_object(
            'allowed', false,
            'code', 'rate_limited',
            'recent_count', v_recent_count,
            'daily_count', v_daily_count
        );
    end if;

    insert into public.speaking_pronunciation_requests (
        student_id, question_set_id, question_id, interaction_type
    ) values (
        p_student_id, p_question_set_id, p_question_id, nullif(btrim(p_interaction_type), '')
    ) returning id into v_request_id;

    return jsonb_build_object(
        'allowed', true,
        'request_id', v_request_id,
        'recent_count', v_recent_count + 1,
        'daily_count', case when v_is_foundation then v_daily_count + 1 else 0 end
    );
end;
$$;

revoke all on function public.reserve_speaking_pronunciation_request(bigint, bigint, bigint, text)
    from public, anon, authenticated;
grant execute on function public.reserve_speaking_pronunciation_request(bigint, bigint, bigint, text)
    to service_role;

comment on table public.speaking_pronunciation_requests is
    'Server-only reservations for every outbound pronunciation provider request. Raw microphone audio is never stored.';
comment on function public.reserve_speaking_pronunciation_request(bigint, bigint, bigint, text) is
    'Atomically reserves pronunciation provider capacity per student before any paid provider call.';

commit;
