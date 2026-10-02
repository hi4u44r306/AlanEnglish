begin;

-- Existing rows have unknown duration: reserve the previous 12-second maximum.
-- No historical progress or provider ledger rows are removed.
alter table public.speaking_pronunciation_requests
    add column audio_seconds integer not null default 12
        check (audio_seconds between 1 and 12);
create index speaking_pronunciation_requests_month_idx
    on public.speaking_pronunciation_requests(created_at) include (audio_seconds);

create function public.speaking_assessment_usage_v1(p_student_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    v_now timestamptz := clock_timestamp();
    v_start timestamptz := date_trunc('month', v_now at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
    v_reset timestamptz := (date_trunc('month', v_now at time zone 'Asia/Taipei') + interval '1 month') at time zone 'Asia/Taipei';
    v_role text;
    v_used bigint;
    v_global_used bigint;
begin
    select role into v_role from public.students where id = p_student_id;
    if v_role is null or v_role not in ('student', 'teacher', 'admin') then
        raise exception 'Valid speaking user required';
    end if;
    select coalesce(sum(audio_seconds) filter (where student_id = p_student_id), 0),
           coalesce(sum(audio_seconds), 0)
      into v_used, v_global_used
      from public.speaking_pronunciation_requests
     where created_at >= v_start and created_at < v_reset;
    return jsonb_build_object(
        'monthly_limit_seconds', case when v_role = 'student' then 5400 else null end,
        'monthly_used_seconds', v_used,
        'monthly_remaining_seconds', case when v_role = 'student' then greatest(5400 - v_used, 0) else null end,
        'global_available', v_global_used < 270000,
        'reset_at', v_reset, 'reset_timezone', 'Asia/Taipei',
        'can_assess', v_global_used < 270000 and (v_role <> 'student' or v_used < 5400)
    );
end;
$$;

create function public.reserve_speaking_pronunciation_request_v2(
    p_student_id bigint, p_question_set_id bigint, p_question_id bigint,
    p_interaction_type text, p_audio_seconds integer, p_client_session_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    v_now timestamptz;
    v_start timestamptz;
    v_reset timestamptz;
    v_role text;
    v_used bigint;
    v_global_used bigint;
    v_recent bigint;
    v_daily bigint;
    v_id uuid;
    v_session jsonb := null;
    v_usage jsonb;
begin
    if p_audio_seconds is null or p_audio_seconds not between 1 and 12 then
        raise exception 'Validated audio seconds must be between 1 and 12';
    end if;
    select role into v_role from public.students where id = p_student_id;
    if v_role is null or v_role not in ('student', 'teacher', 'admin') then
        raise exception 'Valid speaking user required';
    end if;
    if not exists (
        select 1 from public.speaking_questions q
        join public.speaking_question_sets s on s.id = q.question_set_id
        where q.id = p_question_id and q.question_set_id = p_question_set_id and s.status = 'published'
    ) then
        raise exception 'Published speaking question does not match its question set';
    end if;
    -- One lock for ALL users and old/new callers. Reserve before calling Azure.
    perform pg_advisory_xact_lock(hashtextextended('speaking-assessment-global-budget', 0));
    perform pg_advisory_xact_lock(hashtextextended('speaking-pronunciation:' || p_student_id::text, 0));
    v_now := clock_timestamp();
    v_start := date_trunc('month', v_now at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
    v_reset := (date_trunc('month', v_now at time zone 'Asia/Taipei') + interval '1 month') at time zone 'Asia/Taipei';
    select coalesce(sum(audio_seconds) filter (where student_id = p_student_id), 0), coalesce(sum(audio_seconds), 0)
      into v_used, v_global_used from public.speaking_pronunciation_requests
     where created_at >= v_start and created_at < v_reset;
    v_usage := public.speaking_assessment_usage_v1(p_student_id);
    if v_global_used + p_audio_seconds > 270000 then
        return jsonb_build_object('allowed', false, 'code', 'speaking_global_budget_reached', 'assessment_usage', v_usage);
    end if;
    if v_role = 'student' and v_used + p_audio_seconds > 5400 then
        return jsonb_build_object('allowed', false, 'code', 'speaking_monthly_quota_reached', 'assessment_usage', v_usage);
    end if;
    select count(*) filter (where created_at >= v_now - interval '10 minutes'), count(*)
      into v_recent, v_daily from public.speaking_pronunciation_requests
     where student_id = p_student_id and created_at >= v_now - interval '24 hours';
    if v_daily >= 160 or v_recent >= (case when coalesce(btrim(p_interaction_type), '') = '' then 12 else 60 end) then
        return jsonb_build_object('allowed', false, 'code', 'rate_limited', 'assessment_usage', v_usage);
    end if;
    -- New Edge callers reserve session and audio in one transaction, so quota
    -- rejection never consumes a daily round. Legacy callers already reserved it.
    if v_role = 'student' and p_client_session_id is not null then
        v_session := public.reserve_speaking_challenge_session_v1(
            p_student_id, p_question_set_id, p_question_id, p_client_session_id);
        if (v_session->>'allowed')::boolean is distinct from true then
            return jsonb_build_object('allowed', false, 'code', 'speaking_daily_limit_reached', 'assessment_usage', v_usage);
        end if;
    end if;
    insert into public.speaking_pronunciation_requests(student_id, question_set_id, question_id, interaction_type, audio_seconds, created_at)
        values (p_student_id, p_question_set_id, p_question_id, nullif(btrim(p_interaction_type), ''), p_audio_seconds, v_now)
        returning id into v_id;
    return jsonb_build_object('allowed', true, 'request_id', v_id, 'challenge_usage', v_session,
        'assessment_usage', public.speaking_assessment_usage_v1(p_student_id));
end;
$$;

-- Compatibility wrapper protects deployed legacy Edge Functions immediately.
create or replace function public.reserve_speaking_pronunciation_request(
    p_student_id bigint, p_question_set_id bigint, p_question_id bigint, p_interaction_type text
) returns jsonb language sql security invoker set search_path = '' as $$
    select public.reserve_speaking_pronunciation_request_v2(p_student_id, p_question_set_id, p_question_id, p_interaction_type, 12, null);
$$;

revoke all on function public.speaking_assessment_usage_v1(bigint) from public, anon, authenticated;
revoke all on function public.reserve_speaking_pronunciation_request_v2(bigint,bigint,bigint,text,integer,uuid) from public, anon, authenticated;
grant execute on function public.speaking_assessment_usage_v1(bigint) to service_role;
grant execute on function public.reserve_speaking_pronunciation_request_v2(bigint,bigint,bigint,text,integer,uuid) to service_role;
revoke all on function public.reserve_speaking_pronunciation_request(bigint,bigint,bigint,text) from public, anon, authenticated;
grant execute on function public.reserve_speaking_pronunciation_request(bigint,bigint,bigint,text) to service_role;

comment on column public.speaking_pronunciation_requests.audio_seconds is
    'Server-validated WAV duration rounded up to whole seconds; reservations including failures count conservatively, never refunded automatically.';
commit;
