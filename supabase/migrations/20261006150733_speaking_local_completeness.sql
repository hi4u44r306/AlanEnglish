begin;

-- Local completeness does not measure acoustic pronunciation dimensions.
-- Existing paid assessments retain their original values.
alter table public.speaking_pronunciation_attempts
    alter column pronunciation_score drop not null,
    alter column accuracy_score drop not null,
    alter column fluency_score drop not null,
    alter column prosody_score drop not null,
    add column assessment_kind text generated always as
        (case when pronunciation_score is null then 'local_completeness_v1' else 'azure_pronunciation' end) stored,
    add constraint speaking_assessment_dimensions_check check (
        (pronunciation_score is null and accuracy_score is null and fluency_score is null and prosody_score is null)
        or (pronunciation_score is not null and accuracy_score is not null and fluency_score is not null and prosody_score is not null)
    );
comment on column public.speaking_pronunciation_attempts.assessment_kind is
    'Local completeness is recomputed from client-reported text, not verified acoustic evidence. Null pronunciation dimensions mean not measured.';

-- Keep local requests out of the paid provider ledger and monthly audio budget.
create table public.speaking_local_reading_requests (
    id uuid primary key default gen_random_uuid(),
    student_id bigint not null references public.students(id) on delete restrict,
    question_set_id bigint not null references public.speaking_question_sets(id) on delete restrict,
    question_id bigint not null references public.speaking_questions(id) on delete restrict,
    interaction_type text,
    status text not null default 'reserved' check (status in ('reserved','completed','provider_failed','unassessable','internal_failed')),
    error_code text check (char_length(error_code) <= 120),
    created_at timestamptz not null default now(),
    completed_at timestamptz
);
create index speaking_local_reading_student_created_idx on public.speaking_local_reading_requests(student_id, created_at);
create index speaking_local_reading_set_idx on public.speaking_local_reading_requests(question_set_id);
create index speaking_local_reading_question_idx on public.speaking_local_reading_requests(question_id);
alter table public.speaking_local_reading_requests enable row level security;
revoke all on public.speaking_local_reading_requests from public, anon, authenticated;
grant select, insert, update on public.speaking_local_reading_requests to service_role;

create function public.reserve_speaking_local_request_v1(
    p_student_id bigint, p_question_set_id bigint, p_question_id bigint,
    p_interaction_type text, p_client_session_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_count integer; v_request_id uuid; v_usage jsonb;
begin
    if p_student_id is null or p_question_set_id is null or p_question_id is null then
        raise exception 'INVALID_LOCAL_READING_REQUEST';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('speaking-local:' || p_student_id::text, 0));
    if not exists (select 1 from public.speaking_questions q join public.speaking_question_sets s on s.id = q.question_set_id
        where q.id = p_question_id and s.id = p_question_set_id and s.status = 'published') then
        raise exception 'QUESTION_NOT_IN_PUBLISHED_SET';
    end if;
    select count(*) into v_count from public.speaking_local_reading_requests
        where student_id = p_student_id and created_at >= now() - interval '10 minutes';
    if v_count >= 60 then return jsonb_build_object('allowed', false, 'code', 'rate_limited'); end if;
    if p_client_session_id is not null then
        v_usage := public.reserve_speaking_challenge_session_v1(p_student_id, p_question_set_id, p_question_id, p_client_session_id);
        if (v_usage->>'allowed')::boolean is not true then return v_usage; end if;
    end if;
    insert into public.speaking_local_reading_requests(student_id, question_set_id, question_id, interaction_type)
        values (p_student_id, p_question_set_id, p_question_id, p_interaction_type) returning id into v_request_id;
    return jsonb_build_object('allowed', true, 'request_id', v_request_id, 'challenge_usage', v_usage);
end;
$$;
revoke all on function public.reserve_speaking_local_request_v1(bigint,bigint,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public.reserve_speaking_local_request_v1(bigint,bigint,bigint,text,uuid) to service_role;

commit;
