alter table public.assignments
    add column if not exists estimated_seconds integer,
    add column if not exists completion_xp integer not null default 30,
    add column if not exists completion_ae_points integer not null default 5;

alter table public.assignments
    drop constraint if exists assignments_estimated_seconds_check,
    add constraint assignments_estimated_seconds_check
        check (estimated_seconds is null or estimated_seconds > 0),
    drop constraint if exists assignments_completion_xp_check,
    add constraint assignments_completion_xp_check
        check (completion_xp between 1 and 70),
    drop constraint if exists assignments_completion_ae_points_check,
    add constraint assignments_completion_ae_points_check
        check (completion_ae_points between 1 and 14);

comment on column public.assignments.estimated_seconds is
    'Server-calculated estimate from selected audio duration, required listens, and fixed task buffers. Null means one or more source durations are unavailable.';

comment on column public.assignments.completion_xp is
    'Server-calculated one-time XP reward granted when the complete assignment requirement is met.';

comment on column public.assignments.completion_ae_points is
    'Server-calculated one-time AE Points reward granted when the complete assignment requirement is met.';

create or replace function private.ae_try_grant_assignment_completion(
    p_student_id bigint,
    p_assignment_id bigint
) returns boolean
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
    v_assignment public.assignments%rowtype;
    v_student_class text;
    v_ai_completed boolean := true;
    v_listening_completed boolean := true;
    v_total_tracks integer := 0;
    v_completed_tracks integer := 0;
    v_play_count integer := 0;
begin
    select a.* into v_assignment
    from public.assignments a
    where a.id = p_assignment_id;

    if not found or v_assignment.enabled is not true then
        return false;
    end if;

    if v_assignment.assigned_date > (now() at time zone 'Asia/Taipei')::date then
        return false;
    end if;

    select s.class into v_student_class
    from public.students s
    where s.id = p_student_id
      and s.role = 'student'
      and s.archived_at is null;

    if not found then
        return false;
    end if;

    if v_assignment.target_class is not null
       and v_assignment.target_class <> v_student_class then
        return false;
    end if;

    if v_assignment.source_type in ('ai_material', 'mission_pack') then
        select coalesce(ap.completed, false)
        into v_ai_completed
        from public.assignment_progress ap
        where ap.assignment_id = p_assignment_id
          and ap.student_id = p_student_id;

        if not found then
            v_ai_completed := false;
        end if;
    end if;

    if v_assignment.source_type in ('music_track', 'mission_pack') then
        select
            count(*)::integer,
            count(*) filter (
                where coalesce(stp.play_count, 0) >= coalesce(ati.required_listens, v_assignment.required_listens, 3)
            )::integer
        into v_total_tracks, v_completed_tracks
        from public.assignment_track_items ati
        left join public.student_track_progress stp
          on stp.track_id = ati.track_id
         and stp.student_id = p_student_id
        where ati.assignment_id = p_assignment_id;

        if v_total_tracks > 0 then
            v_listening_completed := v_completed_tracks = v_total_tracks;
        elsif v_assignment.track_id is not null then
            select coalesce(stp.play_count, 0)
            into v_play_count
            from public.student_track_progress stp
            where stp.track_id = v_assignment.track_id
              and stp.student_id = p_student_id;

            if not found then
                v_play_count := 0;
            end if;

            v_listening_completed := v_play_count >= coalesce(v_assignment.required_listens, 3);
        else
            v_listening_completed := false;
        end if;
    end if;

    if v_ai_completed and v_listening_completed then
        return private.ae_gamification_grant(
            p_student_id,
            coalesce(v_assignment.completion_xp, 30),
            coalesce(v_assignment.completion_ae_points, 5),
            'assignment_complete',
            concat('assignment:', p_assignment_id),
            '完成老師作業',
            jsonb_build_object(
                'assignment_id', p_assignment_id,
                'estimated_seconds', v_assignment.estimated_seconds,
                'completion_xp', coalesce(v_assignment.completion_xp, 30),
                'completion_ae_points', coalesce(v_assignment.completion_ae_points, 5)
            )
        );
    end if;

    return false;
end;
$$;

grant execute on function private.ae_try_grant_assignment_completion(bigint, bigint) to service_role;
