-- A track is only complete after ten server-validated listening sessions.
-- Reward allocation already uses the same ten-listen mastery threshold.

create or replace function public.record_student_music_play_v2(
    p_student_id bigint,
    p_track_id bigint,
    p_required_plays integer default 10
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
    v_required_plays integer := greatest(p_required_plays, 10);
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
        p_student_id, p_track_id, 1, 1 >= v_required_plays,
        case when 1 >= v_required_plays then v_now else null end,
        v_now, v_now
    )
    on conflict (student_id, track_id) do update set
        play_count = progress.play_count + 1,
        completed = progress.play_count + 1 >= v_required_plays,
        completed_at = case
            when progress.play_count + 1 >= v_required_plays then coalesce(progress.completed_at, v_now)
            else null
        end,
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

-- Preserve the exact pre-change rows for an operator rollback. These private
-- snapshots contain only internal ids and progress/flag state, never secrets.
create table private.listening_completion_backup_20260929 as
select student_id, track_id, completed, completed_at, updated_at
from public.student_track_progress
where play_count < 10
  and completed is true;
alter table private.listening_completion_backup_20260929
    add primary key (student_id, track_id);

create table private.listening_rollout_backup_20260929 as
select student_id, feature_key, enabled, enabled_at, disabled_at, created_at, updated_at
from public.student_feature_rollouts
where feature_key = 'listening_rewards_v2';
alter table private.listening_rollout_backup_20260929
    add primary key (student_id, feature_key);

-- Correct only false-positive completion flags created by the former one-listen rule.
-- Listening counts, mastery rewards and ledgers remain unchanged.
update public.student_track_progress
set completed = false,
    completed_at = null,
    updated_at = now()
where play_count < 10
  and completed is true;

-- The ten-listen mastery policy is now the normal student policy instead of a
-- named-account canary. Existing students enter V3 without reward backfill;
-- new student rows receive the same server-side flag automatically.
insert into public.student_feature_rollouts as rollout (
    student_id, feature_key, enabled, enabled_at, disabled_at, updated_at
)
select student.id, 'listening_rewards_v2', true, now(), null, now()
from public.students student
where student.role = 'student'
on conflict (student_id, feature_key) do update set
    enabled = true,
    enabled_at = coalesce(rollout.enabled_at, excluded.enabled_at),
    disabled_at = null,
    updated_at = now();

create or replace function private.ae_enable_listening_mastery_for_new_student()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.role = 'student' then
        insert into public.student_feature_rollouts (
            student_id, feature_key, enabled, enabled_at, disabled_at, updated_at
        ) values (
            new.id, 'listening_rewards_v2', true, now(), null, now()
        ) on conflict (student_id, feature_key) do update set
            enabled = true,
            enabled_at = coalesce(public.student_feature_rollouts.enabled_at, excluded.enabled_at),
            disabled_at = null,
            updated_at = now();
    end if;
    return new;
end;
$$;

drop trigger if exists ae_enable_listening_mastery_for_new_student on public.students;
create trigger ae_enable_listening_mastery_for_new_student
after insert on public.students
for each row execute function private.ae_enable_listening_mastery_for_new_student();

comment on table public.student_feature_rollouts is
    'Service-role-only feature flags. Listening rewards V3 is enabled for all student accounts from 2026-09-29.';

revoke all on function public.record_student_music_play_v2(bigint, bigint, integer)
    from public, anon, authenticated;
grant execute on function public.record_student_music_play_v2(bigint, bigint, integer)
    to service_role;
