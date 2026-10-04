begin;

alter table public.speaking_pronunciation_requests
    add column audio_seconds integer check (audio_seconds between 1 and 25);
create index speaking_pronunciation_requests_created_idx
    on public.speaking_pronunciation_requests(created_at);

-- Owner approved this release on 2026-10-04: 60 minutes/user, 50 hours/site.
create table public.speaking_audio_budget_policy (
    id boolean primary key default true check (id),
    student_monthly_seconds integer check (student_monthly_seconds > 0),
    global_monthly_seconds integer check (global_monthly_seconds > 0),
    updated_at timestamptz not null default now()
);
insert into public.speaking_audio_budget_policy(id, student_monthly_seconds, global_monthly_seconds)
    values (true, 3600, 180000);
alter table public.speaking_audio_budget_policy enable row level security;
revoke all on public.speaking_audio_budget_policy from public, anon, authenticated;
grant select, update on public.speaking_audio_budget_policy to service_role;

create function public.reserve_speaking_pronunciation_request_v2(
    p_student_id bigint, p_question_set_id bigint, p_question_id bigint,
    p_interaction_type text, p_audio_seconds integer, p_client_session_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
    v_policy public.speaking_audio_budget_policy%rowtype;
    v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
    v_next_month timestamptz := (date_trunc('month', now() at time zone 'Asia/Taipei') + interval '1 month') at time zone 'Asia/Taipei';
    v_student_seconds bigint;
    v_global_seconds bigint;
    v_result jsonb;
    v_usage jsonb;
begin
    if p_audio_seconds is null or p_audio_seconds < 1 or p_audio_seconds >
        (case when p_interaction_type in ('alphabet_round', 'letter_spelling') then 12 else 25 end) then
        raise exception 'Invalid speaking audio duration';
    end if;
    -- One short transaction serializes all monthly reservations, including staff demos.
    select * into v_policy from public.speaking_audio_budget_policy where id for update;
    if not found or v_policy.student_monthly_seconds is null or v_policy.global_monthly_seconds is null then
        return jsonb_build_object('allowed', false, 'code', 'audio_budget_not_configured');
    end if;
    -- Historical requests have unknown duration. Conservatively reserve their
    -- maximum allowed length, including failures; never erase or backfill them.
    select coalesce(sum(coalesce(audio_seconds,
        case when interaction_type in ('alphabet_round', 'letter_spelling') then 12 else 25 end)), 0)
        into v_global_seconds
    from public.speaking_pronunciation_requests where created_at >= v_month_start and created_at < v_next_month;
    select coalesce(sum(coalesce(audio_seconds,
        case when interaction_type in ('alphabet_round', 'letter_spelling') then 12 else 25 end)), 0)
        into v_student_seconds
    from public.speaking_pronunciation_requests where student_id = p_student_id
        and created_at >= v_month_start and created_at < v_next_month;
    if v_global_seconds + p_audio_seconds > v_policy.global_monthly_seconds then
        return jsonb_build_object('allowed', false, 'code', 'global_audio_budget_exhausted', 'resets_at', v_next_month);
    end if;
    if v_student_seconds + p_audio_seconds > v_policy.student_monthly_seconds then
        return jsonb_build_object('allowed', false, 'code', 'student_audio_budget_exhausted', 'resets_at', v_next_month);
    end if;
    -- Roll back both reservations if either existing guard refuses the request.
    begin
        v_result := public.reserve_speaking_pronunciation_request(
            p_student_id, p_question_set_id, p_question_id, p_interaction_type);
        if not coalesce((v_result->>'allowed')::boolean, false) then return v_result; end if;
        if p_client_session_id is not null then
            v_usage := public.reserve_speaking_challenge_session_v1(
                p_student_id, p_question_set_id, p_question_id, p_client_session_id);
            if not coalesce((v_usage->>'allowed')::boolean, false) then
                raise exception using errcode = 'P0002', message = 'Speaking daily session limit';
            end if;
        end if;
        update public.speaking_pronunciation_requests set audio_seconds = p_audio_seconds
            where id = (v_result->>'request_id')::uuid;
    exception when sqlstate 'P0002' then
        return jsonb_build_object('allowed', false, 'code', 'speaking_daily_limit_reached');
    end;
    return v_result || jsonb_build_object('challenge_usage', v_usage,
        'audio_seconds', p_audio_seconds, 'student_monthly_remaining_seconds',
        v_policy.student_monthly_seconds - v_student_seconds - p_audio_seconds, 'resets_at', v_next_month);
end;
$$;
revoke all on function public.reserve_speaking_pronunciation_request_v2(bigint,bigint,bigint,text,integer,uuid)
    from public, anon, authenticated;
grant execute on function public.reserve_speaking_pronunciation_request_v2(bigint,bigint,bigint,text,integer,uuid) to service_role;

commit;
