-- No historical backfill, rollout changes, or deletion of earned rewards.
alter table public.listening_coverage_sessions
    add column reward_policy_version integer not null default 2;

create table public.student_track_mastery (
    student_id bigint not null references public.students(id) on delete cascade,
    track_id bigint not null references public.music_tracks(id) on delete cascade,
    valid_listen_count integer not null default 0 check (valid_listen_count between 0 and 10),
    rewarded_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (student_id, track_id)
);
create index student_track_mastery_track_idx on public.student_track_mastery(track_id);

-- One allocation per session, irrespective of entry page or assignment count.
create table public.listening_reward_allocations (
    session_id uuid primary key references public.listening_coverage_sessions(id) on delete cascade,
    student_id bigint not null references public.students(id) on delete cascade,
    track_id bigint not null references public.music_tracks(id) on delete cascade,
    source text not null check (source in ('assignment', 'self_practice')),
    assignment_id bigint references public.assignments(id),
    created_at timestamptz not null default now(),
    check ((source = 'assignment') = (assignment_id is not null))
);
create index listening_reward_allocations_student_idx on public.listening_reward_allocations(student_id, track_id);
create index listening_reward_allocations_track_idx on public.listening_reward_allocations(track_id);
create index listening_reward_allocations_assignment_idx on public.listening_reward_allocations(assignment_id);
alter table public.student_track_mastery enable row level security;
alter table public.listening_reward_allocations enable row level security;
revoke all on public.student_track_mastery, public.listening_reward_allocations from public, anon, authenticated;
grant select, insert, update on public.student_track_mastery, public.listening_reward_allocations to service_role;

-- A preview is re-evaluated at settlement using the session start time.
-- A newly published assignment cannot consume a listen started before publication.
create function private.ae_listening_reward_context_v3(
    p_student_id bigint, p_track_id bigint, p_started_at timestamptz
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
    v_candidate record;
    v_count integer := 0;
    v_rewarded_at timestamptz;
    v_daily integer;
begin
    select a.id, least(10, greatest(1, coalesce(i.required_listens, a.required_listens, 3))) as required_listens,
           coalesce(p.valid_listen_count, 0) as valid_listen_count
    into v_candidate
    from public.assignments a
    left join public.assignment_track_items i on i.assignment_id = a.id and i.track_id = p_track_id
    left join public.assignment_listening_progress p
      on p.assignment_id = a.id and p.student_id = p_student_id and p.track_id = p_track_id
    where a.enabled is true and a.source_type = 'music_track'
      and a.assigned_date <= (now() at time zone 'Asia/Taipei')::date
      and (a.due_at is null or a.due_at >= now())
      and p_started_at >= greatest(a.created_at, a.assigned_date::timestamp at time zone 'Asia/Taipei')
      and (i.track_id is not null or (a.track_id = p_track_id and not exists (
          select 1 from public.assignment_track_items all_items where all_items.assignment_id = a.id
      )))
      and coalesce(p.valid_listen_count, 0) < least(10, greatest(1, coalesce(i.required_listens, a.required_listens, 3)))
      and not exists (
          select 1 from public.student_gamification_ledger l where l.student_id = p_student_id
          and l.source_type = 'assignment_complete' and l.source_key = concat('assignment:', a.id)
      )
      and exists (
          select 1 from public.academy_enrollments e
          join public.academy_classes c on c.id = e.class_id
          join public.students s on s.id = e.student_id
          where e.student_id = p_student_id and s.role = 'student' and s.learner_type = 'academy_student'
          and e.status = 'active' and c.code = a.target_class
          and e.enrolled_at <= (p_started_at at time zone 'Asia/Taipei')::date
          and (e.access_ends_at is null or e.access_ends_at >= (now() at time zone 'Asia/Taipei')::date)
          and (e.scheduled_departure_at is null or e.scheduled_departure_at > (now() at time zone 'Asia/Taipei')::date)
      )
    order by a.due_at asc nulls last, a.created_at asc, a.id asc
    limit 1;

    select count(*)::integer into v_daily from public.student_gamification_ledger l
    where l.student_id = p_student_id and l.source_type = 'listening_mastery'
      and l.created_at >= ((now() at time zone 'Asia/Taipei')::date::timestamp at time zone 'Asia/Taipei');
    select m.valid_listen_count, m.rewarded_at into v_count, v_rewarded_at
    from public.student_track_mastery m where m.student_id = p_student_id and m.track_id = p_track_id;
    return jsonb_build_object(
        'policy_version', 3, 'track_id', p_track_id,
        'source', case when v_candidate.id is not null then 'assignment' else 'self_practice' end,
        'assignment_id', v_candidate.id, 'required_listens', coalesce(v_candidate.required_listens, 10),
        'valid_listen_count', coalesce(v_candidate.valid_listen_count, v_count, 0),
        'mastery_count', coalesce(v_count, 0), 'mastery_rewarded', v_rewarded_at is not null,
        'daily_rewarded_tracks', v_daily, 'daily_track_limit', 3, 'limit_reached', v_daily >= 3
    );
end;
$$;

create function public.start_listening_reward_session_v3(
    p_student_id bigint, p_track_id bigint, p_duration_seconds numeric
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_session record;
begin
    -- V2 provides role/rollout validation, the student lock and single-session enforcement.
    select * into v_session from public.start_listening_reward_session_v2(p_student_id, p_track_id, p_duration_seconds);
    update public.listening_coverage_sessions set reward_policy_version = 3 where id = v_session.id;
    return to_jsonb(v_session) || jsonb_build_object('reward_status',
        private.ae_listening_reward_context_v3(p_student_id, p_track_id, v_session.started_at));
end;
$$;

create function public.complete_listening_reward_session_v3(
    p_student_id bigint, p_track_id bigint, p_session_id uuid,
    p_covered_ranges jsonb, p_covered_seconds numeric, p_coverage_percent numeric
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
    v_session public.listening_coverage_sessions%rowtype;
    v_context jsonb;
    v_progress record;
    v_assignment_id bigint;
    v_required integer;
    v_count integer;
    v_daily integer;
    v_mastery public.student_track_mastery%rowtype;
    v_granted boolean := false;
    v_assignment_granted boolean := false;
    v_assignment_updates jsonb := '[]'::jsonb;
    v_old_xp integer;
    v_old_points integer;
    v_new_xp integer;
    v_new_points integer;
    v_old_level integer;
    v_new_level integer;
    v_level integer;
    v_level_points integer := 0;
    v_levels jsonb := '[]'::jsonb;
begin
    if p_coverage_percent is null or p_coverage_percent not between 80 and 100
       or p_covered_seconds is null or p_covered_seconds <= 0
       or p_covered_ranges is null or jsonb_typeof(p_covered_ranges) <> 'array'
       or jsonb_array_length(p_covered_ranges) = 0 then
        raise exception 'INVALID_LISTENING_COVERAGE';
    end if;
    -- All student settlement paths use student -> balance -> session lock order.
    perform 1 from public.students s where s.id = p_student_id and s.role = 'student' for update;
    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
    if not exists (select 1 from public.student_feature_rollouts r where r.student_id = p_student_id
        and r.feature_key = 'listening_rewards_v2' and r.enabled is true) then
        raise exception 'LISTENING_REWARDS_V2_DISABLED';
    end if;
    insert into public.student_gamification_balances(student_id) values (p_student_id) on conflict do nothing;
    select b.total_xp, b.points_balance into v_old_xp, v_old_points
    from public.student_gamification_balances b where b.student_id = p_student_id for update;
    select * into v_session from public.listening_coverage_sessions s
    where s.id = p_session_id and s.student_id = p_student_id and s.track_id = p_track_id for update;
    if not found or v_session.completed_at is not null or v_session.count_recorded is true
       or v_session.eligible_for_count is not true or v_session.reward_policy_version <> 3 then
        raise exception 'LISTENING_SESSION_UNAVAILABLE';
    end if;
    -- Edge validates disjoint intervals; retain a DB elapsed/duration guard as well.
    if p_covered_seconds > v_session.duration_seconds
       or abs(p_coverage_percent - p_covered_seconds / v_session.duration_seconds * 100) > 0.1
       or extract(epoch from now() - v_session.started_at) < p_covered_seconds * 0.75 then
        raise exception 'INVALID_LISTENING_COVERAGE';
    end if;

    v_context := private.ae_listening_reward_context_v3(p_student_id, p_track_id, v_session.started_at);
    v_assignment_id := (v_context->>'assignment_id')::bigint;
    v_required := (v_context->>'required_listens')::integer;
    v_daily := (v_context->>'daily_rewarded_tracks')::integer;
    insert into public.listening_reward_allocations(session_id, student_id, track_id, source, assignment_id)
    values (p_session_id, p_student_id, p_track_id, v_context->>'source', v_assignment_id);
    update public.listening_coverage_sessions set completed_at = now(), covered_ranges = p_covered_ranges,
        covered_seconds = p_covered_seconds, coverage_percent = p_coverage_percent, count_recorded = true, updated_at = now()
    where id = p_session_id;
    select * into v_progress from public.record_student_music_play_v2(p_student_id, p_track_id, 1);

    if v_assignment_id is not null then
        insert into public.assignment_listening_events(assignment_id, student_id, track_id, session_id, listened_at)
        values (v_assignment_id, p_student_id, p_track_id, p_session_id, now());
        insert into public.assignment_listening_progress as p
            (assignment_id, student_id, track_id, valid_listen_count, completed, first_listened_at, last_listened_at, completed_at)
        values (v_assignment_id, p_student_id, p_track_id, 1, v_required = 1, now(), now(), case when v_required = 1 then now() end)
        on conflict (assignment_id, student_id, track_id) do update set
            valid_listen_count = least(v_required, p.valid_listen_count + 1),
            completed = p.valid_listen_count + 1 >= v_required,
            last_listened_at = now(), updated_at = now(),
            completed_at = case when p.valid_listen_count + 1 >= v_required then coalesce(p.completed_at, now()) end
        returning valid_listen_count into v_count;
        v_assignment_granted := private.ae_try_grant_assignment_completion_v2(p_student_id, v_assignment_id);
        v_assignment_updates := jsonb_build_array(jsonb_build_object(
            'assignment_id', v_assignment_id, 'track_id', p_track_id, 'valid_listen_count', v_count,
            'required_listens', v_required, 'track_completed', v_count >= v_required,
            'completion_reward_granted', v_assignment_granted));
    else
        insert into public.student_track_mastery as m(student_id, track_id, valid_listen_count)
        values (p_student_id, p_track_id, 1)
        on conflict (student_id, track_id) do update set
            valid_listen_count = least(10, m.valid_listen_count + 1), updated_at = now()
        returning * into v_mastery;
        v_count := v_mastery.valid_listen_count;
        if v_count >= 10 and v_mastery.rewarded_at is null and v_daily < 3 then
            v_granted := private.ae_gamification_grant_v2(p_student_id, 10, 1,
                'listening_mastery', concat('track:', p_track_id), '音檔自主熟練 10 次',
                jsonb_build_object('track_id', p_track_id, 'session_id', p_session_id, 'policy_version', 3));
            if v_granted then
                update public.student_track_mastery set rewarded_at = now()
                where student_id = p_student_id and track_id = p_track_id;
                v_daily := v_daily + 1;
            end if;
        end if;
    end if;

    v_context := v_context || jsonb_build_object(
        'valid_listen_count', v_count, 'daily_rewarded_tracks', v_daily, 'limit_reached', v_daily >= 3,
        'mastery_count', case when v_assignment_id is null then v_count else (v_context->>'mastery_count')::integer end,
        'mastery_rewarded', v_granted or (v_context->>'mastery_rewarded')::boolean,
        'completion_reward_granted', v_assignment_granted);
    select b.total_xp, b.points_balance into v_new_xp, v_new_points
    from public.student_gamification_balances b where b.student_id = p_student_id;
    v_old_level := private.ae_level_for_xp(v_old_xp);
    v_new_level := private.ae_level_for_xp(v_new_xp);
    if v_new_level > v_old_level then
        for v_level in (v_old_level + 1)..v_new_level loop
            v_level_points := v_level_points + private.ae_level_reward_points(v_level);
            v_levels := v_levels || jsonb_build_array(jsonb_build_object('level', v_level, 'points', private.ae_level_reward_points(v_level)));
        end loop;
    end if;
    return to_jsonb(v_progress) || jsonb_build_object(
        'policy_version', 3, 'reward_status', v_context,
        'reward_eligible', v_granted or v_assignment_granted,
        'listening_xp_added', case when v_granted then 10 else 0 end,
        'listening_points_added', case when v_granted then 1 else 0 end,
        'total_xp_added', v_new_xp - v_old_xp, 'total_points_added', v_new_points - v_old_points,
        'level_points_added', v_level_points, 'level_before', v_old_level, 'level_after', v_new_level,
        'levels_gained', v_levels, 'daily_rewarded_tracks', v_daily, 'daily_track_limit', 3,
        'reward_limit_reached', v_daily >= 3, 'total_xp', v_new_xp, 'points_balance', v_new_points,
        'assignment_updates', v_assignment_updates);
end;
$$;

revoke all on function private.ae_listening_reward_context_v3(bigint, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.start_listening_reward_session_v3(bigint, bigint, numeric) from public, anon, authenticated;
revoke all on function public.complete_listening_reward_session_v3(bigint, bigint, uuid, jsonb, numeric, numeric) from public, anon, authenticated;
grant execute on function private.ae_listening_reward_context_v3(bigint, bigint, timestamptz) to service_role;
grant execute on function public.start_listening_reward_session_v3(bigint, bigint, numeric) to service_role;
grant execute on function public.complete_listening_reward_session_v3(bigint, bigint, uuid, jsonb, numeric, numeric) to service_role;
