begin;

create or replace function public.get_student_account_deletion_eligibility(
    p_actor_id bigint,
    p_target_student_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor public.students%rowtype;
    v_target public.students%rowtype;
    v_blockers text[] := array[]::text[];
    v_has_reward_history boolean := false;
begin
    select * into v_actor
    from public.students
    where id = p_actor_id;

    if v_actor.id is null
       or v_actor.role <> 'admin'
       or coalesce(v_actor.account_status, 'active') <> 'active' then
        raise exception using errcode = '42501', message = 'admin_required';
    end if;

    select * into v_target
    from public.students
    where id = p_target_student_id
    for update;

    if v_target.id is null then
        raise exception using errcode = 'P0002', message = 'student_account_not_found';
    end if;
    if v_target.id = v_actor.id then
        raise exception using errcode = '42501', message = 'cannot_delete_current_admin';
    end if;
    if v_target.role <> 'student' then
        raise exception using errcode = '42501', message = 'staff_account_delete_forbidden';
    end if;

    if exists (
        select 1 from public.payment_transactions where student_id = v_target.id
    ) or exists (
        select 1 from public.activation_code_redemptions where student_id = v_target.id
    ) or exists (
        select 1
        from public.student_access_grants
        where student_id = v_target.id
          and source in ('stripe', 'activation_code', 'material_purchase', 'admin_grant')
    ) then
        v_blockers := array_append(v_blockers, 'payment_or_access_history');
    end if;

    if v_target.last_learning_at is not null
       or exists (select 1 from public.student_track_progress where student_id = v_target.id)
       or exists (select 1 from public.listening_coverage_sessions where student_id = v_target.id)
       or exists (select 1 from public.student_listening_daily where student_id = v_target.id)
       or exists (select 1 from public.student_listening_monthly where student_id = v_target.id)
       or exists (select 1 from public.assignment_progress where student_id = v_target.id)
       or exists (select 1 from public.assignment_attempts where student_id = v_target.id)
       or exists (select 1 from public.conversation_progress where student_id = v_target.id)
       or exists (select 1 from public.review_items where student_id = v_target.id)
       or exists (select 1 from public.review_attempts where student_id = v_target.id)
       or exists (select 1 from public.ai_generated_materials where student_id = v_target.id)
       or exists (select 1 from public.ai_material_progress where student_id = v_target.id)
       or exists (select 1 from public.ai_material_attempts where student_id = v_target.id)
       or exists (select 1 from public.ai_usage_daily where student_id = v_target.id)
       or exists (select 1 from public.ai_api_usage_logs where student_id = v_target.id)
       or exists (select 1 from public.student_activity_events where student_id = v_target.id)
       or exists (select 1 from public.promotion_exam_attempts where student_id = v_target.id) then
        v_blockers := array_append(v_blockers, 'learning_history');
    end if;

    if exists (
        select 1 from public.academy_placement_decisions where student_id = v_target.id
    ) or exists (
        select 1 from public.academy_class_movement_history where student_id = v_target.id
    ) then
        v_blockers := array_append(v_blockers, 'academic_history');
    end if;

    -- These tables are created by the later gamification migration. Dynamic SQL
    -- keeps a fresh migration run valid while still enforcing the blocker once
    -- the tables exist in an upgraded environment.
    if to_regclass('public.student_gamification_ledger') is not null
       and to_regclass('public.reward_redemptions') is not null then
        execute $reward_history$
            select exists (
                select 1 from public.student_gamification_ledger where student_id = $1
            ) or exists (
                select 1 from public.reward_redemptions where student_id = $1
            )
        $reward_history$
        into v_has_reward_history
        using v_target.id;
    end if;

    if v_has_reward_history then
        v_blockers := array_append(v_blockers, 'reward_history');
    end if;

    if exists (
        select 1 from public.support_tickets where student_id = v_target.id
    ) then
        v_blockers := array_append(v_blockers, 'support_history');
    end if;

    if exists (
        select 1 from public.students where account_created_by = v_target.id
    ) or exists (
        select 1 from public.academy_account_invitations where created_by = v_target.id
    ) or exists (
        select 1 from public.academy_placement_cycles where created_by = v_target.id
    ) or exists (
        select 1 from public.academy_student_import_batches where created_by = v_target.id
    ) then
        v_blockers := array_append(v_blockers, 'staff_created_records');
    end if;

    return jsonb_build_object(
        'student_id', v_target.id,
        'email', v_target.email,
        'firebase_uid', v_target.firebase_uid,
        'account_status', coalesce(v_target.account_status, 'active'),
        'must_change_password', coalesce(v_target.must_change_password, false),
        'can_delete', coalesce(array_length(v_blockers, 1), 0) = 0,
        'blockers', to_jsonb(v_blockers)
    );
end;
$$;

comment on function public.get_student_account_deletion_eligibility(bigint, bigint) is
    'Admin-only preflight for permanent deletion of unstarted test or pending student accounts.';

revoke all on function public.get_student_account_deletion_eligibility(bigint, bigint)
    from public, anon, authenticated;
grant execute on function public.get_student_account_deletion_eligibility(bigint, bigint)
    to service_role;

create or replace function public.delete_unstarted_student_account(
    p_actor_id bigint,
    p_target_student_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_eligibility jsonb;
    v_email text;
    v_firebase_uid text;
    v_deleted_count integer;
begin
    v_eligibility := public.get_student_account_deletion_eligibility(
        p_actor_id,
        p_target_student_id
    );

    if not coalesce((v_eligibility ->> 'can_delete')::boolean, false) then
        raise exception using
            errcode = 'P0001',
            message = 'account_delete_blocked:' || coalesce(v_eligibility -> 'blockers', '[]'::jsonb)::text;
    end if;

    v_email := nullif(v_eligibility ->> 'email', '');
    v_firebase_uid := nullif(v_eligibility ->> 'firebase_uid', '');

    delete from public.academy_account_invitations
    where lower(invited_email) = lower(v_email)
      and status in ('active', 'claimed', 'completed', 'expired', 'revoked');

    delete from public.students
    where id = p_target_student_id;
    get diagnostics v_deleted_count = row_count;

    if v_deleted_count <> 1 then
        raise exception using errcode = 'P0002', message = 'student_account_not_found';
    end if;

    return jsonb_build_object(
        'student_id', p_target_student_id,
        'email', v_email,
        'firebase_uid', v_firebase_uid,
        'deleted', true
    );
end;
$$;

comment on function public.delete_unstarted_student_account(bigint, bigint) is
    'Permanently deletes a student only after the admin-only eligibility checks pass.';

revoke all on function public.delete_unstarted_student_account(bigint, bigint)
    from public, anon, authenticated;
grant execute on function public.delete_unstarted_student_account(bigint, bigint)
    to service_role;

commit;
