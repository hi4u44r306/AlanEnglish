begin;

-- Narrow XP step: only the shared V2 grant is replaced, keeping its row lock,
-- source uniqueness, points eligibility, level rewards and return contract.
create or replace function private.ae_birthday_xp_multiplier(p_student_id bigint,p_at timestamptz default now())
returns integer language sql stable security invoker set search_path = '' as $$
    select case when exists(select 1 from public.birthday_reward_settings where enabled)
        and private.ae_birthday_month_eligible(p_student_id,p_at) then 2 else 1 end;
$$;
revoke all on function private.ae_birthday_xp_multiplier(bigint,timestamptz) from public,anon,authenticated;
grant execute on function private.ae_birthday_xp_multiplier(bigint,timestamptz) to service_role;

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
    v_xp integer := coalesce(p_xp_delta,0);
    v_multiplier integer := 1;
    v_old_xp integer := 0;
    v_old_points integer := 0;
    v_new_xp integer := 0;
    v_old_level integer := 1;
    v_new_level integer := 1;
    v_level integer;
    v_level_points integer := 0;
    v_level_points_total integer := 0;
    v_can_earn_points boolean := false;
    v_effective_points_delta integer := 0;
begin
    if p_student_id is null
       or coalesce(trim(p_source_type), '') = ''
       or coalesce(trim(p_source_key), '') = '' then
        return false;
    end if;

    if v_xp > 0 and trim(p_source_type) in (
        'listening_daily','listening_complete','listening_mastery','assignment_complete',
        'assignment_90','assignment_100','game','speaking_challenge_complete'
    ) then
        v_multiplier := private.ae_birthday_xp_multiplier(p_student_id);
        v_xp := v_xp * v_multiplier;
    end if;
    v_can_earn_points := private.ae_student_can_earn_points(p_student_id);
    v_effective_points_delta := case
        when coalesce(p_points_delta, 0) > 0 and not v_can_earn_points then 0
        else coalesce(p_points_delta, 0)
    end;
    if v_xp = 0 and v_effective_points_delta = 0 then
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
        v_xp,
        v_effective_points_delta,
        trim(p_source_type),
        trim(p_source_key),
        nullif(trim(coalesce(p_description, '')), ''),
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('ae_points_eligible', v_can_earn_points, 'base_xp', coalesce(p_xp_delta,0), 'xp_multiplier', v_multiplier)
    )
    on conflict (student_id, source_type, source_key) do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
        return false;
    end if;

    v_new_xp := greatest(0, v_old_xp + v_xp);
    v_old_level := private.ae_level_for_xp(v_old_xp);
    v_new_level := private.ae_level_for_xp(v_new_xp);

    if v_can_earn_points and v_xp > 0 and v_new_level > v_old_level then
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
                jsonb_build_object('level', v_level, 'ae_points_eligible', true)
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
        points_balance = greatest(0, v_old_points + v_effective_points_delta + v_level_points_total),
        updated_at = now()
    where student_id = p_student_id;

    return true;
end;
$$;
revoke all on function private.ae_gamification_grant_v2(bigint,integer,integer,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function private.ae_gamification_grant_v2(bigint,integer,integer,text,text,text,jsonb) to service_role;
commit;
