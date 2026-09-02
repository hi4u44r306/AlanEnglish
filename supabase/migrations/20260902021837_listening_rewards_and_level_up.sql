-- Replace the legacy 7/100-listen challenge with bounded rewards for each
-- server-verified listening session. All callable functions are service-role
-- only because Firebase authentication and entitlement checks live in the
-- Edge Functions.

alter table public.listening_coverage_sessions
    add column if not exists ineligibility_reason text;

alter table public.rewards
    add column if not exists fulfillment_type text not null default 'physical';

alter table public.reward_redemptions
    add column if not exists fulfillment_type text not null default 'physical';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'rewards_fulfillment_type_check'
          and conrelid = 'public.rewards'::regclass
    ) then
        alter table public.rewards
            add constraint rewards_fulfillment_type_check
            check (fulfillment_type in ('physical', 'digital'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'reward_redemptions_fulfillment_type_check'
          and conrelid = 'public.reward_redemptions'::regclass
    ) then
        alter table public.reward_redemptions
            add constraint reward_redemptions_fulfillment_type_check
            check (fulfillment_type in ('physical', 'digital'));
    end if;
end;
$$;

comment on column public.rewards.fulfillment_type is
    'physical rewards share a 30-day redemption cooldown; digital rewards do not.';

comment on column public.reward_redemptions.fulfillment_type is
    'Snapshot of the reward fulfillment type when the redemption was requested.';

comment on column public.listening_coverage_sessions.ineligibility_reason is
    'Server-only reason why a listening session cannot record progress or rewards.';

-- Existing unfinished sessions are short-lived. Close them before enforcing a
-- single reward-eligible session per student so the index can be added safely.
update public.listening_coverage_sessions
set eligible_for_count = false,
    completed_at = coalesce(completed_at, now()),
    ineligibility_reason = coalesce(ineligibility_reason, 'migration_restarted'),
    updated_at = now()
where completed_at is null
  and count_recorded is false;

create unique index if not exists listening_coverage_sessions_one_open_reward_idx
    on public.listening_coverage_sessions (student_id)
    where completed_at is null
      and count_recorded is false
      and eligible_for_count is true;

create or replace function private.ae_level_for_xp(p_xp integer)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
    select case
        when greatest(coalesce(p_xp, 0), 0) < 100 then 1
        when p_xp < 250 then 2
        when p_xp < 450 then 3
        when p_xp < 700 then 4
        when p_xp < 1000 then 5
        when p_xp < 1400 then 6
        when p_xp < 1900 then 7
        when p_xp < 2500 then 8
        when p_xp < 3200 then 9
        when p_xp < 4000 then 10
        when p_xp < 5000 then 11
        when p_xp < 6200 then 12
        when p_xp < 7600 then 13
        when p_xp < 9200 then 14
        when p_xp < 11000 then 15
        when p_xp < 13000 then 16
        when p_xp < 15200 then 17
        when p_xp < 17600 then 18
        when p_xp < 20200 then 19
        else 20 + floor((greatest(p_xp, 20200) - 20200) / 3000.0)::integer
    end;
$$;

create or replace function private.ae_level_reward_points(p_level integer)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
    select case
        when p_level between 2 and 5 then 5
        when p_level between 6 and 10 then 10
        when p_level between 11 and 20 then 15
        when p_level >= 21 then 20
        else 0
    end;
$$;

revoke all on function private.ae_level_for_xp(integer) from public, anon, authenticated;
revoke all on function private.ae_level_reward_points(integer) from public, anon, authenticated;
grant execute on function private.ae_level_for_xp(integer) to service_role;
grant execute on function private.ae_level_reward_points(integer) to service_role;

create or replace function private.ae_gamification_grant(
    p_student_id bigint,
    p_xp_delta integer,
    p_points_delta integer,
    p_source_type text,
    p_source_key text,
    p_description text default null,
    p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_inserted integer := 0;
    v_old_xp integer := 0;
    v_old_points integer := 0;
    v_new_xp integer := 0;
    v_old_level integer := 1;
    v_new_level integer := 1;
    v_level integer;
    v_level_points integer := 0;
    v_level_points_total integer := 0;
begin
    if p_student_id is null
       or coalesce(trim(p_source_type), '') = ''
       or coalesce(trim(p_source_key), '') = '' then
        return false;
    end if;
    if coalesce(p_xp_delta, 0) = 0 and coalesce(p_points_delta, 0) = 0 then
        return false;
    end if;

    insert into public.student_gamification_balances (student_id)
    values (p_student_id)
    on conflict (student_id) do nothing;

    select balance.total_xp, balance.points_balance
    into v_old_xp, v_old_points
    from public.student_gamification_balances balance
    where balance.student_id = p_student_id
    for update;

    insert into public.student_gamification_ledger (
        student_id, xp_delta, points_delta, source_type, source_key, description, metadata
    ) values (
        p_student_id,
        coalesce(p_xp_delta, 0),
        coalesce(p_points_delta, 0),
        trim(p_source_type),
        trim(p_source_key),
        nullif(trim(coalesce(p_description, '')), ''),
        coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (student_id, source_type, source_key) do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
        return false;
    end if;

    v_new_xp := greatest(0, v_old_xp + coalesce(p_xp_delta, 0));
    v_old_level := private.ae_level_for_xp(v_old_xp);
    v_new_level := private.ae_level_for_xp(v_new_xp);

    if coalesce(p_xp_delta, 0) > 0 and v_new_level > v_old_level then
        for v_level in (v_old_level + 1)..v_new_level loop
            v_level_points := private.ae_level_reward_points(v_level);
            if v_level_points <= 0 then
                continue;
            end if;

            insert into public.student_gamification_ledger (
                student_id, xp_delta, points_delta, source_type, source_key, description, metadata
            ) values (
                p_student_id,
                0,
                v_level_points,
                'level_up',
                concat('level:', v_level),
                concat('首次升到 Lv.', v_level),
                jsonb_build_object('level', v_level)
            )
            on conflict (student_id, source_type, source_key) do nothing;

            get diagnostics v_inserted = row_count;
            if v_inserted > 0 then
                v_level_points_total := v_level_points_total + v_level_points;
            end if;
        end loop;
    end if;

    update public.student_gamification_balances
    set total_xp = v_new_xp,
        points_balance = greatest(0, v_old_points + coalesce(p_points_delta, 0) + v_level_points_total),
        updated_at = now()
    where student_id = p_student_id;

    return true;
end;
$$;

revoke all on function private.ae_gamification_grant(bigint, integer, integer, text, text, text, jsonb)
    from public, anon, authenticated;
grant execute on function private.ae_gamification_grant(bigint, integer, integer, text, text, text, jsonb)
    to service_role;

-- Listening rewards are now granted only by the atomic completion RPC below.
-- This trigger remains responsible for checking assignment completion after a
-- valid play increments student_track_progress.
create or replace function private.ae_gamification_track_progress_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_assignment_id bigint;
begin
    for v_assignment_id in
        select ati.assignment_id
        from public.assignment_track_items ati
        where ati.track_id = new.track_id
        union
        select assignment.id
        from public.assignments assignment
        where assignment.track_id = new.track_id
          and not exists (
              select 1
              from public.assignment_track_items item
              where item.assignment_id = assignment.id
          )
    loop
        perform private.ae_try_grant_assignment_completion(
            new.student_id,
            v_assignment_id
        );
    end loop;

    return new;
end;
$$;

-- High scores continue to add XP, but only assignment completion grants points.
create or replace function private.ae_gamification_assignment_progress_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.best_score >= 90
       and (tg_op = 'INSERT' or coalesce(old.best_score, 0) < 90) then
        perform private.ae_gamification_grant(
            new.student_id,
            20,
            0,
            'assignment_90',
            concat('assignment:', new.assignment_id),
            '作業達成 90 分以上',
            jsonb_build_object('assignment_id', new.assignment_id, 'score', new.best_score)
        );
    end if;

    if new.best_score >= 100
       and (tg_op = 'INSERT' or coalesce(old.best_score, 0) < 100) then
        perform private.ae_gamification_grant(
            new.student_id,
            10,
            0,
            'assignment_100',
            concat('assignment:', new.assignment_id),
            '作業滿分獎勵',
            jsonb_build_object('assignment_id', new.assignment_id, 'score', new.best_score)
        );
    end if;

    perform private.ae_try_grant_assignment_completion(new.student_id, new.assignment_id);
    return new;
end;
$$;

create or replace function public.record_student_music_play(
    p_student_id bigint,
    p_track_id bigint,
    p_required_plays integer default 1
) returns table(
    result_track_id bigint,
    play_count integer,
    completed boolean,
    daily_count integer,
    monthly_count integer,
    total_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_today date := (v_now at time zone 'Asia/Taipei')::date;
    v_month_start date := date_trunc('month', v_now at time zone 'Asia/Taipei')::date;
    v_play_count integer;
    v_completed boolean;
    v_daily_count integer;
    v_monthly_count integer;
    v_total_count integer;
begin
    if p_required_plays < 1 then
        raise exception 'required plays must be at least 1';
    end if;

    if not exists (
        select 1 from public.students student
        where student.id = p_student_id and student.role = 'student'
    ) then
        raise exception 'student not found';
    end if;
    if not exists (
        select 1 from public.music_tracks track
        where track.id = p_track_id and track.enabled = true
    ) then
        raise exception 'track not found';
    end if;

    insert into public.student_track_progress as progress (
        student_id, track_id, play_count, completed, completed_at, last_played_at, updated_at
    ) values (
        p_student_id, p_track_id, 1, true, v_now, v_now, v_now
    )
    on conflict (student_id, track_id) do update set
        play_count = progress.play_count + 1,
        completed = true,
        completed_at = coalesce(progress.completed_at, v_now),
        last_played_at = v_now,
        updated_at = v_now
    returning progress.play_count, progress.completed
    into v_play_count, v_completed;

    insert into public.student_listening_daily as daily (
        student_id, activity_date, play_count, updated_at
    ) values (p_student_id, v_today, 1, v_now)
    on conflict (student_id, activity_date) do update set
        play_count = daily.play_count + 1,
        updated_at = v_now
    returning daily.play_count into v_daily_count;

    insert into public.student_listening_monthly as monthly (
        student_id, month_start, play_count, updated_at
    ) values (p_student_id, v_month_start, 1, v_now)
    on conflict (student_id, month_start) do update set
        play_count = monthly.play_count + 1,
        updated_at = v_now
    returning monthly.play_count into v_monthly_count;

    update public.students student
    set total_time_played = coalesce(student.total_time_played, 0) + 1,
        current_time_played = coalesce(student.current_time_played, 0) + 1,
        updated_at = v_now
    where student.id = p_student_id
    returning student.total_time_played into v_total_count;

    return query select p_track_id, v_play_count, v_completed, v_daily_count, v_monthly_count, v_total_count;
end;
$$;

revoke all on function public.record_student_music_play(bigint, bigint, integer)
    from public, anon, authenticated;
grant execute on function public.record_student_music_play(bigint, bigint, integer)
    to service_role;

create or replace function public.start_listening_reward_session(
    p_student_id bigint,
    p_track_id bigint,
    p_duration_seconds numeric
) returns table(id uuid, duration_seconds numeric, started_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_now timestamptz := now();
begin
    if p_duration_seconds <= 0 or p_duration_seconds > 3600 then
        raise exception 'INVALID_DURATION';
    end if;

    perform 1
    from public.students student
    where student.id = p_student_id and student.role = 'student'
    for update;
    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;

    if not exists (
        select 1 from public.music_tracks track
        where track.id = p_track_id and track.enabled = true
    ) then
        raise exception 'TRACK_NOT_FOUND';
    end if;

    update public.listening_coverage_sessions session
    set eligible_for_count = false,
        completed_at = coalesce(session.completed_at, v_now),
        ineligibility_reason = coalesce(session.ineligibility_reason, 'superseded_by_new_session'),
        updated_at = v_now
    where session.student_id = p_student_id
      and session.completed_at is null
      and session.count_recorded is false;

    return query
    insert into public.listening_coverage_sessions (
        student_id, track_id, duration_seconds, started_at
    ) values (
        p_student_id, p_track_id, round(p_duration_seconds, 2), v_now
    )
    returning listening_coverage_sessions.id,
              listening_coverage_sessions.duration_seconds,
              listening_coverage_sessions.started_at;
end;
$$;

revoke all on function public.start_listening_reward_session(bigint, bigint, numeric)
    from public, anon, authenticated;
grant execute on function public.start_listening_reward_session(bigint, bigint, numeric)
    to service_role;

create or replace function public.complete_listening_reward_session(
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
    points_balance integer
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
    from public.record_student_music_play(p_student_id, p_track_id, 1) progress;

    select count(*)::integer into v_rewarded_before
    from public.student_gamification_ledger ledger
    where ledger.student_id = p_student_id
      and ledger.source_type = 'listening_daily'
      and ledger.created_at >= v_day_start;

    if v_rewarded_before < 10 then
        v_listening_points := case when mod(v_rewarded_before + 1, 5) = 0 then 1 else 0 end;
        v_reward_granted := private.ae_gamification_grant(
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
        case when v_reward_granted then 5 else 0 end,
        case when v_reward_granted then v_listening_points else 0 end,
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
        v_new_points;
end;
$$;

revoke all on function public.complete_listening_reward_session(bigint, bigint, uuid, jsonb, numeric, numeric)
    from public, anon, authenticated;
grant execute on function public.complete_listening_reward_session(bigint, bigint, uuid, jsonb, numeric, numeric)
    to service_role;

-- Trial students can earn XP and points, but they cannot redeem rewards until
-- they become an eligible member. Physical rewards share a rolling 30-day
-- cooldown to keep fulfillment cost predictable.
create or replace function public.request_reward_redemption(
    p_student_id bigint,
    p_reward_id bigint
) returns table(redemption_id bigint, status text, points_balance integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_reward public.rewards%rowtype;
    v_student public.students%rowtype;
    v_balance public.student_gamification_balances%rowtype;
    v_count integer := 0;
    v_redemption_id bigint;
begin
    select student.* into v_student
    from public.students student
    where student.id = p_student_id and student.role = 'student'
    for update;
    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
    if v_student.learner_type = 'trial_user' then
        raise exception 'TRIAL_REDEMPTION_LOCKED';
    end if;

    select reward.* into v_reward
    from public.rewards reward
    where reward.id = p_reward_id
    for update;
    if not found or v_reward.enabled is not true then raise exception 'REWARD_UNAVAILABLE'; end if;
    if v_reward.stock_quantity <= 0 then raise exception 'OUT_OF_STOCK'; end if;
    if cardinality(v_reward.applicable_classes) > 0
       and not (coalesce(v_student.class, '') = any(v_reward.applicable_classes)) then
        raise exception 'CLASS_NOT_ELIGIBLE';
    end if;

    if v_reward.fulfillment_type = 'physical'
       and exists (
           select 1
           from public.reward_redemptions redemption
           where redemption.student_id = p_student_id
             and redemption.fulfillment_type = 'physical'
             and redemption.status <> 'cancelled'
             and redemption.requested_at >= now() - interval '30 days'
       ) then
        raise exception 'PHYSICAL_REDEMPTION_COOLDOWN';
    end if;

    if v_reward.per_student_limit is not null then
        select count(*) into v_count
        from public.reward_redemptions redemption
        where redemption.student_id = p_student_id
          and redemption.reward_id = p_reward_id
          and redemption.status <> 'cancelled';
        if v_count >= v_reward.per_student_limit then raise exception 'REDEMPTION_LIMIT_REACHED'; end if;
    end if;

    insert into public.student_gamification_balances(student_id)
    values (p_student_id)
    on conflict (student_id) do nothing;

    select balance.* into v_balance
    from public.student_gamification_balances balance
    where balance.student_id = p_student_id
    for update;
    if v_balance.points_balance < v_reward.points_cost then raise exception 'INSUFFICIENT_POINTS'; end if;

    insert into public.reward_redemptions(
        student_id, reward_id, reward_name, points_cost, fulfillment_type
    ) values (
        p_student_id, v_reward.id, v_reward.name, v_reward.points_cost, v_reward.fulfillment_type
    )
    returning id into v_redemption_id;

    update public.student_gamification_balances balance
    set points_balance = balance.points_balance - v_reward.points_cost,
        updated_at = now()
    where balance.student_id = p_student_id;

    insert into public.student_gamification_ledger(
        student_id, xp_delta, points_delta, source_type, source_key, description, metadata
    ) values (
        p_student_id,
        0,
        -v_reward.points_cost,
        'reward_redemption',
        concat('redemption:', v_redemption_id),
        concat('兌換獎品：', v_reward.name),
        jsonb_build_object(
            'reward_id', v_reward.id,
            'redemption_id', v_redemption_id,
            'fulfillment_type', v_reward.fulfillment_type
        )
    );

    update public.rewards reward
    set stock_quantity = reward.stock_quantity - 1,
        updated_at = now()
    where reward.id = v_reward.id;

    return query
    select v_redemption_id, 'pending'::text, (v_balance.points_balance - v_reward.points_cost)::integer;
end;
$$;

revoke all on function public.request_reward_redemption(bigint, bigint)
    from public, anon, authenticated;
grant execute on function public.request_reward_redemption(bigint, bigint)
    to service_role;

-- Keep game XP, but cap all game AE Points at 2 per Taipei day.
create or replace function public.record_game_gamification(
    p_student_id bigint,
    p_game_key text,
    p_session_key text,
    p_won boolean default false
) returns table(xp_added integer, points_added integer, total_xp integer, points_balance integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_start timestamptz;
    v_xp_today integer := 0;
    v_points_today integer := 0;
    v_xp integer := case when p_won then 10 else 5 end;
    v_points integer := case when p_won then 2 else 1 end;
    v_granted boolean := false;
    v_balance public.student_gamification_balances%rowtype;
begin
    if coalesce(trim(p_game_key), '') = '' or coalesce(trim(p_session_key), '') = '' then
        raise exception 'INVALID_GAME_SESSION';
    end if;

    v_start := (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei');
    select coalesce(sum(ledger.xp_delta), 0)::integer,
           coalesce(sum(ledger.points_delta), 0)::integer
    into v_xp_today, v_points_today
    from public.student_gamification_ledger ledger
    where ledger.student_id = p_student_id
      and ledger.source_type = 'game'
      and ledger.created_at >= v_start;

    v_xp := least(v_xp, greatest(0, 30 - v_xp_today));
    v_points := least(v_points, greatest(0, 2 - v_points_today));

    if v_xp > 0 or v_points > 0 then
        v_granted := private.ae_gamification_grant(
            p_student_id,
            v_xp,
            v_points,
            'game',
            concat(trim(p_game_key), ':', trim(p_session_key)),
            case when p_won then '完成遊戲並獲勝' else '完成遊戲' end,
            jsonb_build_object('game_key', trim(p_game_key), 'won', p_won)
        );
    end if;

    select balance.* into v_balance
    from public.student_gamification_balances balance
    where balance.student_id = p_student_id;

    return query select
        case when v_granted then v_xp else 0 end,
        case when v_granted then v_points else 0 end,
        coalesce(v_balance.total_xp, 0),
        coalesce(v_balance.points_balance, 0);
end;
$$;

revoke all on function public.record_game_gamification(bigint, text, text, boolean)
    from public, anon, authenticated;
grant execute on function public.record_game_gamification(bigint, text, text, boolean)
    to service_role;
