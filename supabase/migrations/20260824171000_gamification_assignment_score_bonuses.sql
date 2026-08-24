create or replace function private.ae_gamification_assignment_progress_trigger()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
    if new.completed = true and (tg_op = 'INSERT' or old.completed is distinct from true) then
        perform private.ae_gamification_grant(
            new.student_id,
            30,
            5,
            'assignment_complete',
            concat('assignment:', new.assignment_id),
            '完成老師作業',
            jsonb_build_object('assignment_id', new.assignment_id, 'score', new.best_score)
        );
    end if;

    if new.completed = true
       and new.best_score >= 90
       and (
           tg_op = 'INSERT'
           or old.completed is distinct from true
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

    if new.completed = true
       and new.best_score >= 100
       and (
           tg_op = 'INSERT'
           or old.completed is distinct from true
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

    return new;
end;
$$;