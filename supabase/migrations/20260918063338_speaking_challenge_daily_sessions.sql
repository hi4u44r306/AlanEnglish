begin;

create table public.speaking_challenge_sessions (
    id uuid primary key default gen_random_uuid(),
    client_session_id uuid not null,
    student_id bigint not null references public.students(id) on delete restrict,
    question_set_id bigint not null references public.speaking_question_sets(id) on delete restrict,
    first_question_id bigint not null references public.speaking_questions(id) on delete restrict,
    activity_date date not null,
    started_at timestamptz not null default now(),
    constraint speaking_challenge_sessions_student_client_unique
        unique (student_id, client_session_id)
);

create index speaking_challenge_sessions_student_activity_idx
    on public.speaking_challenge_sessions(student_id, activity_date, started_at desc);

alter table public.speaking_challenge_sessions enable row level security;
revoke all on table public.speaking_challenge_sessions from public, anon, authenticated;
grant select, insert on table public.speaking_challenge_sessions to service_role;

create or replace function public.reserve_speaking_challenge_session_v1(
    p_student_id bigint,
    p_question_set_id bigint,
    p_question_id bigint,
    p_client_session_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_activity_date date := (now() at time zone 'Asia/Taipei')::date;
    v_daily_limit constant integer := 5;
    v_daily_count integer;
    v_existing public.speaking_challenge_sessions%rowtype;
begin
    if p_student_id is null or p_question_set_id is null
       or p_question_id is null or p_client_session_id is null then
        raise exception 'Speaking challenge session identifiers are required';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        'speaking-challenge-session:' || p_student_id::text || ':' || v_activity_date::text,
        0
    ));

    if not exists (
        select 1
        from public.speaking_questions question
        join public.speaking_question_sets question_set
          on question_set.id = question.question_set_id
        where question.id = p_question_id
          and question.question_set_id = p_question_set_id
          and question_set.status = 'published'
    ) then
        raise exception 'Published speaking question does not match its question set';
    end if;

    select * into v_existing
    from public.speaking_challenge_sessions session
    where session.student_id = p_student_id
      and session.client_session_id = p_client_session_id;

    if found then
        if v_existing.question_set_id <> p_question_set_id then
            raise exception 'Speaking challenge session does not match its question set';
        end if;

        select count(*) into v_daily_count
        from public.speaking_challenge_sessions session
        where session.student_id = p_student_id
          and session.activity_date = v_activity_date;

        return jsonb_build_object(
            'allowed', true,
            'already_reserved', true,
            'session_id', v_existing.id,
            'daily_limit', v_daily_limit,
            'daily_used', v_daily_count,
            'daily_remaining', greatest(v_daily_limit - v_daily_count, 0),
            'activity_date', v_activity_date
        );
    end if;

    select count(*) into v_daily_count
    from public.speaking_challenge_sessions session
    where session.student_id = p_student_id
      and session.activity_date = v_activity_date;

    if v_daily_count >= v_daily_limit then
        return jsonb_build_object(
            'allowed', false,
            'code', 'speaking_daily_limit_reached',
            'daily_limit', v_daily_limit,
            'daily_used', v_daily_count,
            'daily_remaining', 0,
            'activity_date', v_activity_date
        );
    end if;

    insert into public.speaking_challenge_sessions (
        client_session_id,
        student_id,
        question_set_id,
        first_question_id,
        activity_date
    ) values (
        p_client_session_id,
        p_student_id,
        p_question_set_id,
        p_question_id,
        v_activity_date
    ) returning * into v_existing;

    return jsonb_build_object(
        'allowed', true,
        'already_reserved', false,
        'session_id', v_existing.id,
        'daily_limit', v_daily_limit,
        'daily_used', v_daily_count + 1,
        'daily_remaining', greatest(v_daily_limit - v_daily_count - 1, 0),
        'activity_date', v_activity_date
    );
end;
$$;

revoke all on function public.reserve_speaking_challenge_session_v1(bigint, bigint, bigint, uuid)
    from public, anon, authenticated;
grant execute on function public.reserve_speaking_challenge_session_v1(bigint, bigint, bigint, uuid)
    to service_role;

comment on table public.speaking_challenge_sessions is
    'Server-only record of formal speaking challenge rounds. A round is created on its first valid recording submission.';
comment on function public.reserve_speaking_challenge_session_v1(bigint, bigint, bigint, uuid) is
    'Atomically enforces five formal speaking challenge rounds per student per Asia/Taipei calendar day.';

commit;
