begin;

-- Return actual event-ledger rewards only. Listening validation, assignments,
-- session idempotency, rollout policy, coverage and daily track limits are preserved.
create or replace function public.complete_listening_reward_session_v2(
    p_student_id bigint,
    p_track_id bigint,
    p_session_id uuid,
    p_covered_ranges jsonb,
    p_covered_seconds numeric,
    p_coverage_percent numeric
) returns table(
    result_track_id bigint,
    play_count integer,
    completed boolean,
    daily_count integer,
    monthly_count integer,
    total_count integer,
    reward_eligible boolean,
    listening_xp_added integer,
    listening_points_added integer,
    total_xp_added integer,
    total_points_added integer,
    level_points_added integer,
    level_before integer,
    level_after integer,
    levels_gained jsonb,
    daily_rewarded_tracks integer,
    daily_track_limit integer,
    next_point_in integer,
    reward_limit_reached boolean,
    total_xp integer,
    points_balance integer,
    assignment_updates jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_day date := (v_now at time zone 'Asia/Taipei')::date;
    v_day_start timestamptz := (v_day::timestamp at time zone 'Asia/Taipei');
    v_session public.listening_coverage_sessions%rowtype;
    v_result_track_id bigint;
    v_play_count integer;
    v_completed boolean;
    v_daily_count integer;
    v_monthly_count integer;
    v_total_count integer;
    v_rewarded_before integer := 0;
    v_rewarded_after integer := 0;
    v_listening_points integer := 0;
    v_reward_granted boolean := false;
    v_old_xp integer := 0;
    v_old_points integer := 0;
    v_new_xp integer := 0;
    v_new_points integer := 0;
    v_old_level integer := 1;
    v_new_level integer := 1;
    v_level integer;
    v_level_points integer := 0;
    v_level_points_total integer := 0;
    v_levels jsonb := '[]'::jsonb;
    v_assignment_updates jsonb := '[]'::jsonb;
begin
    if p_coverage_percent < 80 or p_coverage_percent > 100
       or p_covered_seconds <= 0
       or jsonb_typeof(p_covered_ranges) <> 'array' then
        raise exception 'INVALID_LISTENING_COVERAGE';
    end if;

    perform 1
    from public.students student
    where student.id = p_student_id and student.role = 'student'
    for update;
    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;

    if not exists (
        select 1
        from public.student_feature_rollouts rollout
        where rollout.student_id = p_student_id
          and rollout.feature_key = 'listening_rewards_v2'
          and rollout.enabled is true
    ) then
        raise exception 'LISTENING_REWARDS_V2_DISABLED';
    end if;

    insert into public.student_gamification_balances (student_id)
    values (p_student_id)
    on conflict (student_id) do nothing;

    select balance.total_xp, balance.points_balance
    into v_old_xp, v_old_points
    from public.student_gamification_balances balance
    where balance.student_id = p_student_id
    for update;

    select session.* into v_session
    from public.listening_coverage_sessions session
    where session.id = p_session_id
      and session.student_id = p_student_id
      and session.track_id = p_track_id
    for update;

    if not found
       or v_session.completed_at is not null
       or v_session.count_recorded is true
       or v_session.eligible_for_count is not true then
        raise exception 'LISTENING_SESSION_UNAVAILABLE';
    end if;

    update public.listening_coverage_sessions session
    set completed_at = v_now,
        covered_ranges = p_covered_ranges,
        covered_seconds = round(p_covered_seconds, 2),
        coverage_percent = round(p_coverage_percent, 2),
        count_recorded = true,
        updated_at = v_now
    where session.id = p_session_id;

    select progress.result_track_id,
           progress.play_count,
           progress.completed,
           progress.daily_count,
           progress.monthly_count,
           progress.total_count
    into v_result_track_id,
         v_play_count,
         v_completed,
         v_daily_count,
         v_monthly_count,
         v_total_count
    from public.record_student_music_play_v2(p_student_id, p_track_id, 1) progress;

    select count(*)::integer into v_rewarded_before
    from public.student_gamification_ledger ledger
    where ledger.student_id = p_student_id
      and ledger.source_type = 'listening_daily'
      and ledger.created_at >= v_day_start;

    if v_rewarded_before < 10 then
        v_listening_points := case when mod(v_rewarded_before + 1, 5) = 0 then 1 else 0 end;
        v_reward_granted := private.ae_gamification_grant_v2(
            p_student_id,
            5,
            v_listening_points,
            'listening_daily',
            concat('track:', p_track_id, ':', v_day),
            '完成今日有效聆聽',
            jsonb_build_object(
                'track_id', p_track_id,
                'activity_date', v_day,
                'session_id', p_session_id,
                'coverage_percent', round(p_coverage_percent, 2)
            )
        );
    end if;

    v_assignment_updates := private.ae_record_assignment_listening_v2(
        p_student_id,
        p_track_id,
        p_session_id,
        v_now
    );

    select count(*)::integer into v_rewarded_after
    from public.student_gamification_ledger ledger
    where ledger.student_id = p_student_id
      and ledger.source_type = 'listening_daily'
      and ledger.created_at >= v_day_start;

    select balance.total_xp, balance.points_balance
    into v_new_xp, v_new_points
    from public.student_gamification_balances balance
    where balance.student_id = p_student_id;

    v_old_level := private.ae_level_for_xp(v_old_xp);
    v_new_level := private.ae_level_for_xp(v_new_xp);
    if v_new_level > v_old_level then
        for v_level in (v_old_level + 1)..v_new_level loop
            v_level_points := private.ae_level_reward_points(v_level);
            v_level_points_total := v_level_points_total + v_level_points;
            v_levels := v_levels || jsonb_build_array(
                jsonb_build_object('level', v_level, 'points', v_level_points)
            );
        end loop;
    end if;

    return query select
        v_result_track_id,
        v_play_count,
        v_completed,
        v_daily_count,
        v_monthly_count,
        v_total_count,
        v_reward_granted,
        case when v_reward_granted then coalesce((select l.xp_delta from public.student_gamification_ledger l where l.student_id=p_student_id and l.source_type='listening_daily' and l.source_key=concat('track:',p_track_id,':',v_day)),0) else 0 end,
        case when v_reward_granted then coalesce((select l.points_delta from public.student_gamification_ledger l where l.student_id=p_student_id and l.source_type='listening_daily' and l.source_key=concat('track:',p_track_id,':',v_day)),0) else 0 end,
        greatest(0, v_new_xp - v_old_xp),
        greatest(0, v_new_points - v_old_points),
        v_level_points_total,
        v_old_level,
        v_new_level,
        v_levels,
        v_rewarded_after,
        10,
        case
            when v_rewarded_after >= 10 then 0
            when mod(v_rewarded_after, 5) = 0 then 5
            else 5 - mod(v_rewarded_after, 5)
        end,
        v_rewarded_after >= 10,
        v_new_xp,
        v_new_points,
        v_assignment_updates;
end;
$$;

create or replace function public.complete_listening_reward_session_v3(
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
        'listening_xp_added', case when v_granted then coalesce((select l.xp_delta from public.student_gamification_ledger l where l.student_id=p_student_id and l.source_type='listening_mastery' and l.source_key=concat('track:',p_track_id)),0) else 0 end,
        'listening_points_added', case when v_granted then coalesce((select l.points_delta from public.student_gamification_ledger l where l.student_id=p_student_id and l.source_type='listening_mastery' and l.source_key=concat('track:',p_track_id)),0) else 0 end,
        'total_xp_added', v_new_xp - v_old_xp, 'total_points_added', v_new_points - v_old_points,
        'level_points_added', v_level_points, 'level_before', v_old_level, 'level_after', v_new_level,
        'levels_gained', v_levels, 'daily_rewarded_tracks', v_daily, 'daily_track_limit', 3,
        'reward_limit_reached', v_daily >= 3, 'total_xp', v_new_xp, 'points_balance', v_new_points,
        'assignment_updates', v_assignment_updates);
end;
$$;
commit;
