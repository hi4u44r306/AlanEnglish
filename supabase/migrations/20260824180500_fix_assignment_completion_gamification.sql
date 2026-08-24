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
            30,
            5,
            'assignment_complete',
            concat('assignment:', p_assignment_id),
            '完成老師作業',
            jsonb_build_object('assignment_id', p_assignment_id)
        );
    end if;

    return false;
end;
$$;

grant execute on function private.ae_try_grant_assignment_completion(bigint, bigint) to service_role;

create or replace function private.ae_gamification_assignment_progress_trigger()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
    if new.best_score >= 90
       and (
           tg_op = 'INSERT'
           or coalesce(old.best_score, 0) < 90
       ) then
        perform private.ae_gamification_grant(
            new.student_id,
            20,
            5,
            'assignment_90',
            concat('assignment:', new.assignment_id),
            '作業達成 90 分以上',
            jsonb_build_object('assignment_id', new.assignment_id, 'score', new.best_score)
        );
    end if;

    if new.best_score >= 100
       and (
           tg_op = 'INSERT'
           or coalesce(old.best_score, 0) < 100
       ) then
        perform private.ae_gamification_grant(
            new.student_id,
            10,
            5,
            'assignment_100',
            concat('assignment:', new.assignment_id),
            '作業滿分獎勵',
            jsonb_build_object('assignment_id', new.assignment_id, 'score', new.best_score)
        );
    end if;

    perform private.ae_try_grant_assignment_completion(
        new.student_id,
        new.assignment_id
    );

    return new;
end;
$$;

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
            '完成音檔 7 次挑戰',
            jsonb_build_object('track_id', new.track_id)
        );
    end if;

    for v_assignment_id in
        select ati.assignment_id
        from public.assignment_track_items ati
        where ati.track_id = new.track_id
        union
        select a.id
        from public.assignments a
        where a.track_id = new.track_id
          and not exists (
              select 1
              from public.assignment_track_items ati2
              where ati2.assignment_id = a.id
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