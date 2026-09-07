begin;

-- Atomically records one completed speaking question and settles the whole
-- published question set. The ledger's unique source key is the final guard
-- against retries, double-clicks, concurrent requests and alternate catalog
-- groupings awarding the same challenge twice.
create or replace function public.complete_speaking_challenge_question_v2(
    p_student_id bigint,
    p_question_set_id bigint,
    p_question_id bigint
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_now timestamptz := now();
    v_total_questions integer := 0;
    v_completed_questions integer := 0;
    v_reward_granted boolean := false;
    v_points_eligible boolean := false;
    v_before_xp integer := 0;
    v_before_points integer := 0;
    v_after_xp integer := 0;
    v_after_points integer := 0;
    v_level_before integer := 1;
    v_level_after integer := 1;
    v_challenge_points integer := 0;
    v_level_points integer := 0;
    v_levels jsonb := '[]'::jsonb;
    v_source_key text := concat('question_set:', p_question_set_id);
begin
    if p_student_id is null or p_question_set_id is null or p_question_id is null then
        raise exception 'INVALID_SPEAKING_CHALLENGE_COMPLETION';
    end if;

    if not exists (
        select 1 from public.students student
        where student.id = p_student_id
          and student.role = 'student'
          and student.archived_at is null
          and coalesce(student.account_status, 'active') <> 'archived'
    ) then
        raise exception 'STUDENT_NOT_ELIGIBLE';
    end if;

    if not exists (
        select 1
        from public.speaking_question_sets question_set
        join public.speaking_questions question
          on question.question_set_id = question_set.id
        where question_set.id = p_question_set_id
          and question_set.status = 'published'
          and question.id = p_question_id
    ) then
        raise exception 'SPEAKING_QUESTION_NOT_IN_PUBLISHED_SET';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        concat('speaking-challenge:', p_student_id, ':', p_question_set_id),
        0
    ));

    insert into public.speaking_challenge_question_progress as progress (
        student_id, question_set_id, question_id, status, opened_at, completed_at, updated_at
    ) values (
        p_student_id, p_question_set_id, p_question_id, 'completed', v_now, v_now, v_now
    )
    on conflict (student_id, question_id) do update
    set status = 'completed',
        completed_at = coalesce(progress.completed_at, excluded.completed_at),
        updated_at = excluded.updated_at
    where progress.question_set_id = excluded.question_set_id;

    select count(*)::integer
    into v_total_questions
    from public.speaking_questions question
    where question.question_set_id = p_question_set_id;

    select count(*)::integer
    into v_completed_questions
    from public.speaking_challenge_question_progress progress
    join public.speaking_questions question
      on question.id = progress.question_id
     and question.question_set_id = p_question_set_id
    where progress.student_id = p_student_id
      and progress.question_set_id = p_question_set_id
      and progress.status = 'completed';

    if v_total_questions > 0 and v_completed_questions = v_total_questions then
        insert into public.student_gamification_balances (student_id)
        values (p_student_id)
        on conflict (student_id) do nothing;

        select balance.total_xp, balance.points_balance
        into v_before_xp, v_before_points
        from public.student_gamification_balances balance
        where balance.student_id = p_student_id;

        v_level_before := private.ae_level_for_xp(v_before_xp);
        v_points_eligible := private.ae_student_can_earn_points(p_student_id);
        v_reward_granted := private.ae_gamification_grant_v2(
            p_student_id,
            30,
            3,
            'speaking_challenge_complete',
            v_source_key,
            '首次完成口說大挑戰',
            jsonb_build_object(
                'question_set_id', p_question_set_id,
                'question_count', v_total_questions,
                'reward_policy_version', 1
            )
        );

        select balance.total_xp, balance.points_balance
        into v_after_xp, v_after_points
        from public.student_gamification_balances balance
        where balance.student_id = p_student_id;

        v_level_after := private.ae_level_for_xp(v_after_xp);
        if v_reward_granted then
            v_challenge_points := case when v_points_eligible then 3 else 0 end;
            v_level_points := greatest(0, v_after_points - v_before_points - v_challenge_points);
            select coalesce(jsonb_agg(jsonb_build_object(
                'level', gained_level,
                'points', private.ae_level_reward_points(gained_level)
            ) order by gained_level), '[]'::jsonb)
            into v_levels
            from generate_series(v_level_before + 1, v_level_after) as gained_level;
        end if;
    else
        select coalesce(balance.total_xp, 0), coalesce(balance.points_balance, 0)
        into v_after_xp, v_after_points
        from public.student_gamification_balances balance
        where balance.student_id = p_student_id;
        v_level_after := private.ae_level_for_xp(coalesce(v_after_xp, 0));
        v_level_before := v_level_after;
    end if;

    return jsonb_build_object(
        'question_id', p_question_id,
        'status', 'completed',
        'completed_questions', v_completed_questions,
        'total_questions', v_total_questions,
        'challenge_complete', v_total_questions > 0 and v_completed_questions = v_total_questions,
        'reward_granted', v_reward_granted,
        'xp_awarded', case when v_reward_granted then 30 else 0 end,
        'ae_points_awarded', case when v_reward_granted then v_challenge_points else 0 end,
        'level_before', v_level_before,
        'level_after', v_level_after,
        'level_points_awarded', case when v_reward_granted then v_level_points else 0 end,
        'levels_gained', case when v_reward_granted then v_levels else '[]'::jsonb end,
        'total_xp', coalesce(v_after_xp, 0),
        'points_balance', coalesce(v_after_points, 0)
    );
end;
$$;

revoke all on function public.complete_speaking_challenge_question_v2(bigint, bigint, bigint)
    from public, anon, authenticated;
grant execute on function public.complete_speaking_challenge_question_v2(bigint, bigint, bigint)
    to service_role;

comment on function public.complete_speaking_challenge_question_v2(bigint, bigint, bigint) is
    'Service-role-only atomic speaking progress and idempotent whole-challenge reward settlement.';

comment on table public.speaking_challenge_question_progress is
    'Server-verified progress for published speaking questions. Whole-set rewards are settled atomically by complete_speaking_challenge_question_v2.';

commit;
