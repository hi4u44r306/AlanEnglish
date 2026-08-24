create or replace function public.request_reward_redemption(
    p_student_id bigint,
    p_reward_id bigint
) returns table(redemption_id bigint, status text, points_balance integer)
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
    v_reward public.rewards%rowtype;
    v_student public.students%rowtype;
    v_balance public.student_gamification_balances%rowtype;
    v_count integer := 0;
    v_redemption_id bigint;
begin
    select * into v_student
    from public.students
    where id = p_student_id and role = 'student'
    for update;
    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;

    select * into v_reward
    from public.rewards
    where id = p_reward_id
    for update;
    if not found or v_reward.enabled is not true then raise exception 'REWARD_UNAVAILABLE'; end if;
    if v_reward.stock_quantity <= 0 then raise exception 'OUT_OF_STOCK'; end if;
    if cardinality(v_reward.applicable_classes) > 0
       and not (coalesce(v_student.class, '') = any(v_reward.applicable_classes)) then
        raise exception 'CLASS_NOT_ELIGIBLE';
    end if;

    if v_reward.per_student_limit is not null then
        select count(*) into v_count
        from public.reward_redemptions rr
        where rr.student_id = p_student_id
          and rr.reward_id = p_reward_id
          and rr.status <> 'cancelled';
        if v_count >= v_reward.per_student_limit then raise exception 'REDEMPTION_LIMIT_REACHED'; end if;
    end if;

    insert into public.student_gamification_balances(student_id)
    values (p_student_id)
    on conflict (student_id) do nothing;

    select b.* into v_balance
    from public.student_gamification_balances b
    where b.student_id = p_student_id
    for update;
    if v_balance.points_balance < v_reward.points_cost then raise exception 'INSUFFICIENT_POINTS'; end if;

    insert into public.reward_redemptions(student_id, reward_id, reward_name, points_cost)
    values (p_student_id, v_reward.id, v_reward.name, v_reward.points_cost)
    returning id into v_redemption_id;

    update public.student_gamification_balances as b
    set points_balance = b.points_balance - v_reward.points_cost,
        updated_at = now()
    where b.student_id = p_student_id;

    insert into public.student_gamification_ledger(
        student_id, xp_delta, points_delta, source_type, source_key, description, metadata
    ) values (
        p_student_id,
        0,
        -v_reward.points_cost,
        'reward_redemption',
        concat('redemption:', v_redemption_id),
        concat('兌換獎品：', v_reward.name),
        jsonb_build_object('reward_id', v_reward.id, 'redemption_id', v_redemption_id)
    );

    update public.rewards as r
    set stock_quantity = r.stock_quantity - 1,
        updated_at = now()
    where r.id = v_reward.id;

    return query
    select v_redemption_id, 'pending'::text, (v_balance.points_balance - v_reward.points_cost)::integer;
end;
$$;

create or replace function public.update_reward_redemption_status(
    p_redemption_id bigint,
    p_status text,
    p_admin_id bigint,
    p_note text default null
) returns table(redemption_id bigint, status text, points_balance integer)
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
    v_redemption public.reward_redemptions%rowtype;
    v_allowed boolean := false;
    v_balance integer := 0;
begin
    if p_status not in ('approved','ordered','ready','completed','cancelled') then
        raise exception 'INVALID_STATUS';
    end if;

    select rr.* into v_redemption
    from public.reward_redemptions rr
    where rr.id = p_redemption_id
    for update;
    if not found then raise exception 'REDEMPTION_NOT_FOUND'; end if;

    if v_redemption.status = p_status then
        select b.points_balance into v_balance
        from public.student_gamification_balances b
        where b.student_id = v_redemption.student_id;
        return query select v_redemption.id, v_redemption.status, coalesce(v_balance, 0);
        return;
    end if;

    v_allowed := case v_redemption.status
        when 'pending' then p_status in ('approved','cancelled')
        when 'approved' then p_status in ('ordered','ready','cancelled')
        when 'ordered' then p_status in ('ready','cancelled')
        when 'ready' then p_status in ('completed','cancelled')
        else false
    end;
    if not v_allowed then raise exception 'INVALID_STATUS_TRANSITION'; end if;

    if p_status = 'cancelled' then
        update public.student_gamification_balances as b
        set points_balance = b.points_balance + v_redemption.points_cost,
            updated_at = now()
        where b.student_id = v_redemption.student_id;

        insert into public.student_gamification_ledger(
            student_id, xp_delta, points_delta, source_type, source_key, description, metadata
        ) values (
            v_redemption.student_id,
            0,
            v_redemption.points_cost,
            'reward_refund',
            concat('redemption:', v_redemption.id),
            concat('取消兌換退回點數：', v_redemption.reward_name),
            jsonb_build_object('reward_id', v_redemption.reward_id, 'redemption_id', v_redemption.id)
        )
        on conflict (student_id, source_type, source_key) do nothing;

        update public.rewards as r
        set stock_quantity = r.stock_quantity + 1,
            updated_at = now()
        where r.id = v_redemption.reward_id;
    end if;

    update public.reward_redemptions as rr
    set status = p_status,
        admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), rr.admin_note),
        approved_at = case when p_status = 'approved' and rr.approved_at is null then now() else rr.approved_at end,
        ordered_at = case when p_status = 'ordered' and rr.ordered_at is null then now() else rr.ordered_at end,
        ready_at = case when p_status = 'ready' and rr.ready_at is null then now() else rr.ready_at end,
        completed_at = case when p_status = 'completed' and rr.completed_at is null then now() else rr.completed_at end,
        cancelled_at = case when p_status = 'cancelled' and rr.cancelled_at is null then now() else rr.cancelled_at end,
        updated_by = p_admin_id,
        updated_at = now()
    where rr.id = v_redemption.id;

    select b.points_balance into v_balance
    from public.student_gamification_balances b
    where b.student_id = v_redemption.student_id;

    return query select v_redemption.id, p_status, coalesce(v_balance, 0);
end;
$$;