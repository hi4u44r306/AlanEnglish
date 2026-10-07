begin;

create table public.speaking_daily_level_completions (
 student_id bigint not null references public.students(id),
 question_set_id bigint not null references public.speaking_question_sets(id),
 activity_date date not null,
 completion_key uuid not null,
 completed_at timestamptz not null default now(),
 primary key(student_id, question_set_id, activity_date)
);
create index speaking_daily_level_completions_set_idx on public.speaking_daily_level_completions(question_set_id);
alter table public.speaking_daily_level_completions enable row level security;
revoke all on public.speaking_daily_level_completions from public, anon, authenticated;
grant select, insert on public.speaking_daily_level_completions to service_role;
create policy speaking_daily_completion_service on public.speaking_daily_level_completions
 for all to service_role using (true) with check (true);

create table public.speaking_daily_question_completions (
 student_id bigint not null references public.students(id),
 question_set_id bigint not null references public.speaking_question_sets(id),
 question_id bigint not null references public.speaking_questions(id),
 activity_date date not null,
 challenge_mode text not null check(challenge_mode in ('easy','challenge')),
 completed_at timestamptz not null default now(),
 primary key(student_id,question_set_id,activity_date,challenge_mode,question_id)
);
create index speaking_daily_question_completions_set_idx on public.speaking_daily_question_completions(question_set_id);
create index speaking_daily_question_completions_question_idx on public.speaking_daily_question_completions(question_id);
alter table public.speaking_daily_question_completions enable row level security;
revoke all on public.speaking_daily_question_completions from public,anon,authenticated;
grant select,insert on public.speaking_daily_question_completions to service_role;
create policy speaking_daily_question_completion_service on public.speaking_daily_question_completions
 for all to service_role using(true) with check(true);

alter table public.speaking_pronunciation_requests add column alphabet_letter text
 check (alphabet_letter is null or alphabet_letter ~ '^[A-Z]$');

create function public.speaking_daily_level_policy_v1(p_student_id bigint, p_question_set_id bigint default null)
returns jsonb language sql security invoker set search_path = '' as $$
 select jsonb_build_object('completed_set_ids', coalesce(jsonb_agg(question_set_id),'[]'::jsonb),
 'level_daily_limit',1,'alphabet_letter_daily_limit',3,'activity_date',(now() at time zone 'Asia/Taipei')::date)
 from public.speaking_daily_level_completions where student_id=p_student_id
 and activity_date=(now() at time zone 'Asia/Taipei')::date
 and (p_question_set_id is null or question_set_id=p_question_set_id);
$$;

create or replace function public.reserve_speaking_azure_alphabet_request_v1(
 p_student_id bigint,p_question_set_id bigint,p_question_id bigint,p_audio_seconds integer,p_client_session_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_usage jsonb; v_id uuid; v_count integer; v_letter text; v_used integer := 0;
 v_day date := (now() at time zone 'Asia/Taipei')::date;
begin
 if p_student_id is null or p_audio_seconds is null or p_audio_seconds not between 1 and 12 then raise exception 'INVALID_ALPHABET_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended('speaking-alphabet:' || p_student_id::text,0));
 select upper(trim(q.model_answer)) into v_letter from public.speaking_questions q join public.speaking_question_sets s on s.id=q.question_set_id
 where q.id=p_question_id and s.id=p_question_set_id and s.status='published' and s.generation_metadata->>'interaction_type'='alphabet_round';
 if v_letter is null or v_letter !~ '^[A-Z]$' then raise exception 'ALPHABET_QUESTION_REQUIRED'; end if;
 if p_client_session_id is not null then
  select count(*) into v_used from public.speaking_pronunciation_requests r
  left join public.speaking_questions q on q.id=r.question_id
  where r.student_id=p_student_id and r.provider='azure_alphabet_basic'
  and r.created_at >= v_day::timestamp at time zone 'Asia/Taipei'
  and r.created_at < (v_day+1)::timestamp at time zone 'Asia/Taipei'
  and coalesce(r.alphabet_letter,upper(trim(q.model_answer)))=v_letter;
  if v_used>=3 then return jsonb_build_object('allowed',false,'code','alphabet_letter_daily_limit_reached','letter',v_letter,'letter_remaining',0); end if;
 end if;
 select count(*) into v_count from public.speaking_pronunciation_requests where student_id=p_student_id and created_at>=now()-interval '10 minutes';
 if v_count>=60 then return jsonb_build_object('allowed',false,'code','rate_limited'); end if;
 if p_client_session_id is not null then
  v_usage:=public.reserve_speaking_challenge_session_v1(p_student_id,p_question_set_id,p_question_id,p_client_session_id);
  if (v_usage->>'allowed')::boolean is not true then return v_usage; end if;
 end if;
 insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,interaction_type,provider,audio_seconds,alphabet_letter)
 values(p_student_id,p_question_set_id,p_question_id,'alphabet_round','azure_alphabet_basic',p_audio_seconds,v_letter) returning id into v_id;
 return jsonb_build_object('allowed',true,'request_id',v_id,'challenge_usage',v_usage,
 'letter',v_letter,'letter_remaining',case when p_client_session_id is null then null else 2-v_used end);
end; $$;

create function public.start_speaking_foundation_round_v2(p_student_id bigint,p_question_set_id bigint,p_question_set_version integer,p_question_order bigint[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_day date := (now() at time zone 'Asia/Taipei')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('speaking-challenge-session:'||p_student_id::text||':'||v_day::text,0));
 if exists(select 1 from public.speaking_daily_level_completions where student_id=p_student_id and question_set_id=p_question_set_id and activity_date=v_day)
 then return jsonb_build_object('status','practice_only','code','speaking_level_completed_today'); end if;
 return public.start_speaking_foundation_round_v1(p_student_id,p_question_set_id,p_question_set_version,p_question_order);
end; $$;

create function public.record_speaking_foundation_assessment_v3(
 p_student_id bigint,p_round_id uuid,p_question_id bigint,p_claim_token uuid,
 p_pronunciation_score numeric,p_accuracy_score numeric,p_fluency_score numeric,p_completeness_score numeric,
 p_prosody_score numeric,p_recognized_text text,p_word_results jsonb,p_answer_match boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb; v_set bigint; v_existing uuid; v_day date := (now() at time zone 'Asia/Taipei')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('speaking-challenge-session:'||p_student_id::text||':'||v_day::text,0));
 select question_set_id into v_set from public.speaking_foundation_rounds where id=p_round_id and student_id=p_student_id;
 select completion_key into v_existing from public.speaking_daily_level_completions where student_id=p_student_id and question_set_id=v_set and activity_date=v_day;
 if v_existing is not null and v_existing<>p_round_id then raise exception 'DAILY_LEVEL_COMPLETED'; end if;
 v_result:=public.record_speaking_foundation_assessment_v2(p_student_id,p_round_id,p_question_id,p_claim_token,
 p_pronunciation_score,p_accuracy_score,p_fluency_score,p_completeness_score,p_prosody_score,p_recognized_text,p_word_results,p_answer_match);
 if v_result->>'status'='completed' then
  insert into public.speaking_daily_level_completions(student_id,question_set_id,activity_date,completion_key)
  values(p_student_id,v_set,v_day,p_round_id) on conflict do nothing;
 end if;
 return v_result;
end; $$;

create function public.complete_speaking_daily_question_v1(p_student_id bigint,p_question_set_id bigint,p_question_id bigint,p_client_session_id uuid,p_challenge_mode text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb := '{}'::jsonb; v_finished boolean; v_existing uuid;
 v_day date := (now() at time zone 'Asia/Taipei')::date;
begin
 if p_client_session_id is null or p_challenge_mode not in ('easy','challenge') then raise exception 'INVALID_DAILY_COMPLETION'; end if;
 perform pg_advisory_xact_lock(hashtextextended('speaking-challenge-session:'||p_student_id::text||':'||v_day::text,0));
 select completion_key into v_existing from public.speaking_daily_level_completions where student_id=p_student_id and question_set_id=p_question_set_id and activity_date=v_day;
 if v_existing is not null then
  if v_existing=p_client_session_id then return jsonb_build_object('challenge_completed',true,'completed_challenge',true,'xp_awarded',0,'ae_points_awarded',0,'already_completed_today',true); end if;
  raise exception 'DAILY_LEVEL_COMPLETED';
 end if;
 if not exists(select 1 from public.speaking_questions q join public.speaking_question_sets s on s.id=q.question_set_id
 where q.id=p_question_id and s.id=p_question_set_id and s.status='published') then raise exception 'QUESTION_NOT_IN_PUBLISHED_SET'; end if;
 if not exists(select 1 from public.speaking_pronunciation_attempts a where a.student_id=p_student_id and a.question_set_id=p_question_set_id
 and a.question_id=p_question_id and a.client_session_id=p_client_session_id and a.challenge_mode=p_challenge_mode and a.answer_match
 and (p_challenge_mode='easy' or (not a.hint_used and not exists(select 1 from public.speaking_challenge_hint_reveals h
 where h.student_id=a.student_id and h.question_id=a.question_id and h.client_session_id=a.client_session_id)))
 and a.created_at >= now()-interval '10 minutes') then raise exception 'CORRECT_ASSESSMENT_REQUIRED'; end if;
 if p_challenge_mode='challenge' then
  insert into public.speaking_challenge_mode_progress(student_id,question_set_id,question_id)
  values(p_student_id,p_question_set_id,p_question_id) on conflict(student_id,question_id) do nothing;
 else
  v_result:=public.complete_speaking_challenge_question_v2(p_student_id,p_question_set_id,p_question_id);
 end if;
 insert into public.speaking_daily_question_completions(student_id,question_set_id,question_id,activity_date,challenge_mode)
 values(p_student_id,p_question_set_id,p_question_id,v_day,p_challenge_mode) on conflict do nothing;
 -- Only committed completion actions count, even if a previous score saved but completion failed.
 select exists(select 1 from public.speaking_questions where question_set_id=p_question_set_id) and not exists(
  select 1 from public.speaking_questions q where q.question_set_id=p_question_set_id and not exists(
   select 1 from public.speaking_daily_question_completions a where a.student_id=p_student_id and a.question_id=q.id
   and a.question_set_id=p_question_set_id and a.challenge_mode=p_challenge_mode
   and a.activity_date=v_day)) into v_finished;
 if v_finished then
  insert into public.speaking_daily_level_completions(student_id,question_set_id,activity_date,completion_key)
  values(p_student_id,p_question_set_id,v_day,p_client_session_id);
 end if;
 return v_result || jsonb_build_object('challenge_completed',v_finished,'completed_challenge',v_finished,'challenge_complete',v_finished);
end; $$;

revoke all on function public.speaking_daily_level_policy_v1(bigint,bigint) from public,anon,authenticated;
grant execute on function public.speaking_daily_level_policy_v1(bigint,bigint) to service_role;
revoke all on function public.start_speaking_foundation_round_v2(bigint,bigint,integer,bigint[]) from public,anon,authenticated;
grant execute on function public.start_speaking_foundation_round_v2(bigint,bigint,integer,bigint[]) to service_role;
revoke all on function public.record_speaking_foundation_assessment_v3(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.record_speaking_foundation_assessment_v3(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean) to service_role;
revoke all on function public.complete_speaking_daily_question_v1(bigint,bigint,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_speaking_daily_question_v1(bigint,bigint,bigint,uuid,text) to service_role;

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
    v_daily_limit constant integer := 10;
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

    if exists (select 1 from public.speaking_daily_level_completions
        where student_id = p_student_id and question_set_id = p_question_set_id and activity_date = v_activity_date) then
        return jsonb_build_object('allowed', false, 'code', 'speaking_level_completed_today');
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

commit;
