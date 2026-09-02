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

-- Production canary rollout. The migration is safe to apply without enabling
-- the new listening economy for every student. Only service-role code may add
-- or change rollout rows after a named test account has been selected.
create table if not exists public.student_feature_rollouts (
    student_id bigint not null references public.students(id) on delete cascade,
    feature_key text not null,
    enabled boolean not null default false,
    enabled_at timestamptz,
    disabled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (student_id, feature_key),
    constraint student_feature_rollouts_key_check
        check (feature_key in ('listening_rewards_v2'))
);

create index if not exists student_feature_rollouts_enabled_idx
    on public.student_feature_rollouts (feature_key, student_id)
    where enabled is true;

alter table public.student_feature_rollouts enable row level security;
revoke all on table public.student_feature_rollouts from public, anon, authenticated;
grant select, insert, update, delete on table public.student_feature_rollouts to service_role;

comment on table public.student_feature_rollouts is
    'Service-role-only production canary flags. Missing rows always mean disabled.';

-- A valid listen remains one shared learning event, but assignment progress is
-- counted separately from lifetime student_track_progress. This prevents old
-- listens from instantly completing an assignment published later.
create table if not exists public.assignment_listening_progress (
    assignment_id bigint not null references public.assignments(id) on delete cascade,
    student_id bigint not null references public.students(id) on delete cascade,
    track_id bigint not null references public.music_tracks(id) on delete cascade,
    valid_listen_count integer not null default 0,
    completed boolean not null default false,
    first_listened_at timestamptz,
    last_listened_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (assignment_id, student_id, track_id),
    constraint assignment_listening_progress_count_check
        check (valid_listen_count >= 0)
);

create table if not exists public.assignment_listening_events (
    assignment_id bigint not null references public.assignments(id) on delete cascade,
    student_id bigint not null references public.students(id) on delete cascade,
    track_id bigint not null references public.music_tracks(id) on delete cascade,
    session_id uuid not null references public.listening_coverage_sessions(id) on delete cascade,
    listened_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    primary key (assignment_id, session_id)
);

create index if not exists assignment_listening_progress_student_idx
    on public.assignment_listening_progress (student_id, assignment_id);
create index if not exists assignment_listening_progress_track_idx
    on public.assignment_listening_progress (track_id);
create index if not exists assignment_listening_events_student_idx
    on public.assignment_listening_events (student_id, assignment_id, track_id);
create index if not exists assignment_listening_events_track_idx
    on public.assignment_listening_events (track_id);
create index if not exists assignment_listening_events_session_idx
    on public.assignment_listening_events (session_id);

alter table public.assignment_listening_progress enable row level security;
alter table public.assignment_listening_events enable row level security;
revoke all on table public.assignment_listening_progress from public, anon, authenticated;
revoke all on table public.assignment_listening_events from public, anon, authenticated;
grant select, insert, update, delete on table public.assignment_listening_progress to service_role;
grant select, insert, update, delete on table public.assignment_listening_events to service_role;

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

create or replace function private.ae_gamification_grant_v2(
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

revoke all on function private.ae_gamification_grant_v2(bigint, integer, integer, text, text, text, jsonb)
    from public, anon, authenticated;
grant execute on function private.ae_gamification_grant_v2(bigint, integer, integer, text, text, text, jsonb)
    to service_role;

-- Preserve the legacy trigger behavior for every student outside the canary.
-- Canary students are settled atomically by complete_listening_reward_session_v2,
-- so the legacy 7-listen reward and lifetime-count assignment check must be
-- skipped for them to avoid duplicate rewards and pre-assignment progress.
create or replace function private.ae_gamification_track_progress_trigger()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
    v_day date;
    v_assignment_id bigint;
begin
    if exists (
        select 1
        from public.student_feature_rollouts rollout
        where rollout.student_id = new.student_id
          and rollout.feature_key = 'listening_rewards_v2'
          and rollout.enabled is true
    ) then
        return new;
    end if;

    v_day := (coalesce(new.last_played_at, now()) at time zone 'Asia/Taipei')::date;

    if (tg_op = 'INSERT' and new.play_count > 0)
       or (tg_op = 'UPDATE' and new.play_count > old.play_count) then
        perform private.ae_gamification_grant(
            new.student_id,
            5,
            1,
            'listening_daily',
            concat('track:', new.track_id, ':', v_day),
            '完成今日聽力練習',
            jsonb_build_object('track_id', new.track_id, 'activity_date', v_day)
        );
    end if;

    if new.completed = true
       and (tg_op = 'INSERT' or old.completed is distinct from true) then
        perform private.ae_gamification_grant(
            new.student_id,
            20,
            5,
            'listening_complete',
            concat('track:', new.track_id),
            '完成音檔7次挑戰',
            jsonb_build_object('track_id', new.track_id)
        );
    end if;

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

create or replace function public.record_student_music_play_v2(
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

revoke all on function public.record_student_music_play_v2(bigint, bigint, integer)
    from public, anon, authenticated;
grant execute on function public.record_student_music_play_v2(bigint, bigint, integer)
    to service_role;

create or replace function public.start_listening_reward_session_v2(
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
        select 1
        from public.student_feature_rollouts rollout
        where rollout.student_id = p_student_id
          and rollout.feature_key = 'listening_rewards_v2'
          and rollout.enabled is true
    ) then
        raise exception 'LISTENING_REWARDS_V2_DISABLED';
    end if;

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

revoke all on function public.start_listening_reward_session_v2(bigint, bigint, numeric)
    from public, anon, authenticated;
grant execute on function public.start_listening_reward_session_v2(bigint, bigint, numeric)
    to service_role;

create or replace function private.ae_try_grant_assignment_completion_v2(
    p_student_id bigint,
    p_assignment_id bigint
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_assignment public.assignments%rowtype;
    v_total_tracks integer := 0;
    v_completed_tracks integer := 0;
    v_valid_listens integer := 0;
begin
    select assignment.* into v_assignment
    from public.assignments assignment
    where assignment.id = p_assignment_id
      and assignment.enabled is true;

    if not found
       or v_assignment.source_type <> 'music_track'
       or v_assignment.assigned_date > (now() at time zone 'Asia/Taipei')::date
       or (v_assignment.due_at is not null and v_assignment.due_at < now()) then
        return false;
    end if;

    if not exists (
        select 1
        from public.academy_enrollments enrollment
        join public.academy_classes class_row on class_row.id = enrollment.class_id
        where enrollment.student_id = p_student_id
          and enrollment.status = 'active'
          and enrollment.enrolled_at <= (now() at time zone 'Asia/Taipei')::date
          and (enrollment.access_ends_at is null or enrollment.access_ends_at >= (now() at time zone 'Asia/Taipei')::date)
          and (enrollment.scheduled_departure_at is null or enrollment.scheduled_departure_at > (now() at time zone 'Asia/Taipei')::date)
          and class_row.code = v_assignment.target_class
    ) then
        return false;
    end if;

    select
        count(*)::integer,
        count(*) filter (
            where coalesce(progress.valid_listen_count, 0)
                >= coalesce(item.required_listens, v_assignment.required_listens, 3)
        )::integer
    into v_total_tracks, v_completed_tracks
    from public.assignment_track_items item
    left join public.assignment_listening_progress progress
      on progress.assignment_id = item.assignment_id
     and progress.student_id = p_student_id
     and progress.track_id = item.track_id
    where item.assignment_id = p_assignment_id;

    if v_total_tracks = 0 and v_assignment.track_id is not null then
        select coalesce(progress.valid_listen_count, 0) into v_valid_listens
        from public.assignment_listening_progress progress
        where progress.assignment_id = p_assignment_id
          and progress.student_id = p_student_id
          and progress.track_id = v_assignment.track_id;
        if not found then v_valid_listens := 0; end if;
        v_total_tracks := 1;
        v_completed_tracks := case
            when v_valid_listens >= coalesce(v_assignment.required_listens, 3) then 1
            else 0
        end;
    end if;

    if v_total_tracks > 0 and v_completed_tracks = v_total_tracks then
        return private.ae_gamification_grant_v2(
            p_student_id,
            30,
            5,
            'assignment_complete',
            concat('assignment:', p_assignment_id),
            '完成老師聽力作業',
            jsonb_build_object('assignment_id', p_assignment_id, 'assignment_type', 'listening')
        );
    end if;

    return false;
end;
$$;

create or replace function private.ae_record_assignment_listening_v2(
    p_student_id bigint,
    p_track_id bigint,
    p_session_id uuid,
    p_listened_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_candidate record;
    v_inserted integer := 0;
    v_count integer := 0;
    v_completed boolean := false;
    v_reward_granted boolean := false;
    v_updates jsonb := '[]'::jsonb;
begin
    for v_candidate in
        select distinct on (assignment.id)
            assignment.id as assignment_id,
            least(10, greatest(1, coalesce(item.required_listens, assignment.required_listens, 3)))::integer as required_listens
        from public.assignments assignment
        join public.academy_enrollments enrollment
          on enrollment.student_id = p_student_id
         and enrollment.status = 'active'
        join public.academy_classes class_row
          on class_row.id = enrollment.class_id
         and class_row.code = assignment.target_class
        left join public.assignment_track_items item
          on item.assignment_id = assignment.id
         and item.track_id = p_track_id
        where assignment.enabled is true
          and assignment.source_type = 'music_track'
          and assignment.assigned_date <= (p_listened_at at time zone 'Asia/Taipei')::date
          and (assignment.due_at is null or assignment.due_at >= p_listened_at)
          and enrollment.enrolled_at <= (p_listened_at at time zone 'Asia/Taipei')::date
          and (enrollment.access_ends_at is null or enrollment.access_ends_at >= (p_listened_at at time zone 'Asia/Taipei')::date)
          and (enrollment.scheduled_departure_at is null or enrollment.scheduled_departure_at > (p_listened_at at time zone 'Asia/Taipei')::date)
          and p_listened_at >= greatest(
              assignment.created_at,
              assignment.assigned_date::timestamp at time zone 'Asia/Taipei'
          )
          and (
              item.track_id is not null
              or (
                  assignment.track_id = p_track_id
                  and not exists (
                      select 1
                      from public.assignment_track_items existing_item
                      where existing_item.assignment_id = assignment.id
                  )
              )
          )
        order by assignment.id, item.sort_order nulls last
    loop
        insert into public.assignment_listening_events (
            assignment_id, student_id, track_id, session_id, listened_at
        ) values (
            v_candidate.assignment_id,
            p_student_id,
            p_track_id,
            p_session_id,
            p_listened_at
        )
        on conflict (assignment_id, session_id) do nothing;

        get diagnostics v_inserted = row_count;
        if v_inserted = 0 then
            continue;
        end if;

        insert into public.assignment_listening_progress as progress (
            assignment_id,
            student_id,
            track_id,
            valid_listen_count,
            completed,
            first_listened_at,
            last_listened_at,
            completed_at,
            updated_at
        ) values (
            v_candidate.assignment_id,
            p_student_id,
            p_track_id,
            1,
            v_candidate.required_listens <= 1,
            p_listened_at,
            p_listened_at,
            case when v_candidate.required_listens <= 1 then p_listened_at else null end,
            p_listened_at
        )
        on conflict (assignment_id, student_id, track_id) do update set
            valid_listen_count = progress.valid_listen_count + 1,
            completed = progress.valid_listen_count + 1 >= v_candidate.required_listens,
            first_listened_at = coalesce(progress.first_listened_at, p_listened_at),
            last_listened_at = p_listened_at,
            completed_at = case
                when progress.valid_listen_count + 1 >= v_candidate.required_listens
                    then coalesce(progress.completed_at, p_listened_at)
                else null
            end,
            updated_at = p_listened_at
        returning assignment_listening_progress.valid_listen_count,
                  assignment_listening_progress.completed
        into v_count, v_completed;

        v_reward_granted := private.ae_try_grant_assignment_completion_v2(
            p_student_id,
            v_candidate.assignment_id
        );

        v_updates := v_updates || jsonb_build_array(jsonb_build_object(
            'assignment_id', v_candidate.assignment_id,
            'track_id', p_track_id,
            'valid_listen_count', v_count,
            'required_listens', v_candidate.required_listens,
            'track_completed', v_completed,
            'completion_reward_granted', v_reward_granted
        ));
    end loop;

    return v_updates;
end;
$$;

revoke all on function private.ae_try_grant_assignment_completion_v2(bigint, bigint)
    from public, anon, authenticated;
revoke all on function private.ae_record_assignment_listening_v2(bigint, bigint, uuid, timestamptz)
    from public, anon, authenticated;
grant execute on function private.ae_try_grant_assignment_completion_v2(bigint, bigint)
    to service_role;
grant execute on function private.ae_record_assignment_listening_v2(bigint, bigint, uuid, timestamptz)
    to service_role;

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
        v_new_points,
        v_assignment_updates;
end;
$$;

revoke all on function public.complete_listening_reward_session_v2(bigint, bigint, uuid, jsonb, numeric, numeric)
    from public, anon, authenticated;
grant execute on function public.complete_listening_reward_session_v2(bigint, bigint, uuid, jsonb, numeric, numeric)
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
        v_granted := private.ae_gamification_grant_v2(
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
