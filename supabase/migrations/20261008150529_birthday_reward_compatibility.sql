begin;

-- Retain the legacy rollout path and its reward policy; only XP amount changes.
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
set search_path = public, private, pg_temp
as $$
declare
    v_inserted integer := 0;
    v_xp integer := coalesce(p_xp_delta,0);
    v_multiplier integer := 1;
begin
    if p_student_id is null or coalesce(trim(p_source_type), '') = '' or coalesce(trim(p_source_key), '') = '' then
        return false;
    end if;
    if v_xp > 0 and trim(p_source_type) in ('listening_daily','listening_complete','assignment_complete','assignment_90','assignment_100') then
        v_multiplier := private.ae_birthday_xp_multiplier(p_student_id);
        v_xp := v_xp * v_multiplier;
    end if;
    if v_xp = 0 and coalesce(p_points_delta, 0) = 0 then
        return false;
    end if;

    insert into public.student_gamification_ledger (
        student_id, xp_delta, points_delta, source_type, source_key, description, metadata
    ) values (
        p_student_id,
        v_xp,
        coalesce(p_points_delta, 0),
        trim(p_source_type),
        trim(p_source_key),
        nullif(trim(coalesce(p_description, '')), ''),
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('base_xp',coalesce(p_xp_delta,0),'xp_multiplier',v_multiplier)
    )
    on conflict (student_id, source_type, source_key) do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then return false; end if;

    insert into public.student_gamification_balances (student_id, total_xp, points_balance, updated_at)
    values (
        p_student_id,
        greatest(0, v_xp),
        greatest(0, coalesce(p_points_delta, 0)),
        now()
    )
    on conflict (student_id) do update set
        total_xp = greatest(0, public.student_gamification_balances.total_xp + excluded.total_xp),
        points_balance = greatest(0, public.student_gamification_balances.points_balance + excluded.points_balance),
        updated_at = now();

    return true;
end;
$$;

-- The daily game limit stays 30 base XP / 2 points; birthday XP can reach 60.
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

    perform pg_advisory_xact_lock(hashtextextended(concat('game-rewards:',p_student_id),0));
    v_start := (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei');
    select coalesce(sum(coalesce((ledger.metadata->>'base_xp')::integer,ledger.xp_delta)), 0)::integer,
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
        case when v_granted then coalesce((select l.xp_delta from public.student_gamification_ledger l where l.student_id=p_student_id and l.source_type='game' and l.source_key=concat(trim(p_game_key), ':', trim(p_session_key))),0) else 0 end,
        case when v_granted then coalesce((select l.points_delta from public.student_gamification_ledger l where l.student_id=p_student_id and l.source_type='game' and l.source_key=concat(trim(p_game_key), ':', trim(p_session_key))),0) else 0 end,
        coalesce(v_balance.total_xp, 0),
        coalesce(v_balance.points_balance, 0);
end;
$$;

-- Only the returned XP value changes; speaking completion and daily limits remain intact.
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
        'xp_awarded', case when v_reward_granted then coalesce((select l.xp_delta from public.student_gamification_ledger l where l.student_id=p_student_id and l.source_type='speaking_challenge_complete' and l.source_key=v_source_key),0) else 0 end,
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
commit;
