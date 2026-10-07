begin;

-- Keep old easy-mode achievements and rewards as historical records. New map
-- unlocking reads challenge-mode progress only. No student rows are deleted.
create table public.speaking_session_question_completions (
 student_id bigint not null references public.students(id),
 question_set_id bigint not null references public.speaking_question_sets(id),
 question_id bigint not null references public.speaking_questions(id),
 client_session_id uuid not null,
 challenge_mode text not null check(challenge_mode in ('easy','challenge')),
 completed_at timestamptz not null default now(),
 primary key(student_id,client_session_id,challenge_mode,question_id)
);
create index speaking_session_completion_set_idx on public.speaking_session_question_completions(question_set_id);
create index speaking_session_completion_question_idx on public.speaking_session_question_completions(question_id);
alter table public.speaking_session_question_completions enable row level security;
revoke all on public.speaking_session_question_completions from public,anon,authenticated;
grant select,insert on public.speaking_session_question_completions to service_role;
create policy speaking_session_completion_service on public.speaking_session_question_completions
 for all to service_role using(true) with check(true);

create function public.complete_speaking_session_question_v2(
 p_student_id bigint,p_question_set_id bigint,p_question_id bigint,p_client_session_id uuid,p_challenge_mode text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_finished boolean; v_question bigint; v_result jsonb := '{}'::jsonb;
 v_xp integer := 0; v_points integer := 0;
begin
 if p_client_session_id is null or p_challenge_mode is null or p_challenge_mode not in ('easy','challenge') then raise exception 'INVALID_SESSION_COMPLETION'; end if;
 perform pg_advisory_xact_lock(hashtextextended('speaking-session-completion:'||p_student_id::text||':'||p_client_session_id::text,0));
 if not exists(select 1 from public.speaking_questions q join public.speaking_question_sets s on s.id=q.question_set_id
  where q.id=p_question_id and s.id=p_question_set_id and s.status='published') then raise exception 'QUESTION_NOT_IN_PUBLISHED_SET'; end if;
 if exists(select 1 from public.speaking_session_question_completions where student_id=p_student_id
  and client_session_id=p_client_session_id and question_set_id<>p_question_set_id) then raise exception 'SESSION_SET_MISMATCH'; end if;
 -- Re-check the latest decision, not any earlier pass in this session.
 if not exists(select 1 from (
  select a.* from public.speaking_pronunciation_attempts a where a.student_id=p_student_id
   and a.question_set_id=p_question_set_id and a.question_id=p_question_id
   and a.client_session_id=p_client_session_id and a.challenge_mode=p_challenge_mode
   and a.created_at>=now()-interval '10 minutes' order by a.created_at desc,a.id desc limit 1
 ) a where a.answer_match is true and coalesce(a.pronunciation_score,a.completeness_score)>=70
  and (p_challenge_mode='easy' or (not a.hint_used and not exists(select 1 from public.speaking_challenge_hint_reveals h
   where h.student_id=a.student_id and h.question_id=a.question_id and h.client_session_id=a.client_session_id))))
 then raise exception 'CORRECT_ASSESSMENT_REQUIRED'; end if;
 insert into public.speaking_session_question_completions(student_id,question_set_id,question_id,client_session_id,challenge_mode)
 values(p_student_id,p_question_set_id,p_question_id,p_client_session_id,p_challenge_mode) on conflict do nothing;
 select not exists(select 1 from public.speaking_questions q where q.question_set_id=p_question_set_id and not exists(
  select 1 from public.speaking_session_question_completions c where c.student_id=p_student_id
   and c.client_session_id=p_client_session_id and c.question_set_id=p_question_set_id
   and c.challenge_mode=p_challenge_mode and c.question_id=q.id)) into v_finished;
 if p_challenge_mode='challenge' then
  insert into public.speaking_challenge_mode_progress(student_id,question_set_id,question_id)
  values(p_student_id,p_question_set_id,p_question_id) on conflict(student_id,question_id) do nothing;
  if v_finished then
   -- Call the existing once-only reward writer only after a full challenge run.
   -- Existing easy-mode rewards remain; their original source key prevents duplicates.
   for v_question in select id from public.speaking_questions where question_set_id=p_question_set_id order by id loop
    v_result:=public.complete_speaking_challenge_question_v2(p_student_id,p_question_set_id,v_question);
    v_xp:=v_xp+coalesce((v_result->>'xp_awarded')::integer,0);
    v_points:=v_points+coalesce((v_result->>'ae_points_awarded')::integer,0);
   end loop;
  end if;
 end if;
 return v_result || jsonb_build_object('xp_awarded',v_xp,'ae_points_awarded',v_points,'challenge_completed',v_finished and p_challenge_mode='challenge',
  'completed_challenge',v_finished and p_challenge_mode='challenge','challenge_complete',v_finished and p_challenge_mode='challenge',
  'practice_completed',v_finished and p_challenge_mode='easy');
end; $$;
revoke all on function public.complete_speaking_session_question_v2(bigint,bigint,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_speaking_session_question_v2(bigint,bigint,bigint,uuid,text) to service_role;

-- Only challenge mode can call the round recorder through pronunciation-coach.
-- Preserve its atomic claim/retry/order checks and once-only reward behavior.
create function public.record_speaking_foundation_challenge_v4(
 p_student_id bigint,p_round_id uuid,p_question_id bigint,p_claim_token uuid,
 p_pronunciation_score numeric,p_accuracy_score numeric,p_fluency_score numeric,p_completeness_score numeric,
 p_prosody_score numeric,p_recognized_text text,p_word_results jsonb,p_answer_match boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb; v_set bigint;
begin
 v_result:=public.record_speaking_foundation_assessment_v3(p_student_id,p_round_id,p_question_id,p_claim_token,
  p_pronunciation_score,p_accuracy_score,p_fluency_score,p_completeness_score,p_prosody_score,p_recognized_text,p_word_results,
  p_answer_match and coalesce(p_pronunciation_score,p_completeness_score)>=70);
 if v_result->>'status'='completed' then
  select question_set_id into v_set from public.speaking_foundation_rounds where id=p_round_id and student_id=p_student_id;
  insert into public.speaking_challenge_mode_progress(student_id,question_set_id,question_id)
   select p_student_id,v_set,unnest(question_order) from public.speaking_foundation_rounds where id=p_round_id and student_id=p_student_id
   on conflict(student_id,question_id) do nothing;
 end if;
 return v_result;
end; $$;
revoke all on function public.record_speaking_foundation_challenge_v4(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.record_speaking_foundation_challenge_v4(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean) to service_role;

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

-- Reuse the existing monthly audio budget and daily paid-session guards.
-- Basic letter spelling uses the same non-prosody rate tracked by the legacy
-- azure_alphabet_basic cost bucket. Duration still contributes to the global budget.
create function public.reserve_speaking_azure_spelling_request_v1(
 p_student_id bigint,p_question_set_id bigint,p_question_id bigint,p_audio_seconds integer,p_client_session_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
 v_result:=public.reserve_speaking_pronunciation_request_v2(p_student_id,p_question_set_id,p_question_id,'letter_spelling',p_audio_seconds,p_client_session_id);
 if (v_result->>'allowed')::boolean is true then
  update public.speaking_pronunciation_requests set provider='azure_alphabet_basic' where id=(v_result->>'request_id')::uuid;
 end if;
 return v_result;
end; $$;
revoke all on function public.reserve_speaking_azure_spelling_request_v1(bigint,bigint,bigint,integer,uuid) from public,anon,authenticated;
grant execute on function public.reserve_speaking_azure_spelling_request_v1(bigint,bigint,bigint,integer,uuid) to service_role;

commit;
