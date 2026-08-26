begin;

alter table public.memberships
    add column if not exists stripe_livemode boolean;

alter table public.student_access_grants
    add column if not exists stripe_livemode boolean;

comment on column public.memberships.stripe_livemode is
    'False for Stripe test-mode objects, true for live-mode objects, null when not verified.';

comment on column public.student_access_grants.stripe_livemode is
    'False for Stripe test-mode objects, true for live-mode objects, null when not verified.';

update public.memberships as membership
set stripe_livemode = history.stripe_livemode
from (
    select
        payment_row.membership_id,
        case
            when bool_or(event.livemode is true) then true
            when bool_and(event.livemode is false) then false
            else null
        end as stripe_livemode
    from public.payment_transactions as payment_row
    left join public.payment_events as event
        on event.stripe_event_id = payment_row.stripe_event_id
    where payment_row.membership_id is not null
    group by payment_row.membership_id
) as history
where membership.id = history.membership_id
  and membership.stripe_livemode is null;

update public.student_access_grants as access_grant
set stripe_livemode = history.stripe_livemode
from (
    select
        payment_row.access_grant_id,
        case
            when bool_or(event.livemode is true) then true
            when bool_and(event.livemode is false) then false
            else null
        end as stripe_livemode
    from public.payment_transactions as payment_row
    left join public.payment_events as event
        on event.stripe_event_id = payment_row.stripe_event_id
    where payment_row.access_grant_id is not null
    group by payment_row.access_grant_id
) as history
where access_grant.id = history.access_grant_id
  and access_grant.stripe_livemode is null;

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
    v_test_customer_ids text[] := array[]::text[];
    v_test_subscription_ids text[] := array[]::text[];
    v_has_test_payment_history boolean := false;
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

    -- Purchases and redemptions remain protected regardless of Stripe mode.
    if exists (
        select 1 from public.activation_code_redemptions where student_id = v_target.id
    ) or exists (
        select 1
        from public.memberships
        where student_id = v_target.id
          and source in ('activation_code', 'material_purchase')
    ) or exists (
        select 1
        from public.student_access_grants
        where student_id = v_target.id
          and source in ('activation_code', 'material_purchase')
    ) then
        v_blockers := array_append(v_blockers, 'payment_or_access_history');
    end if;

    -- A transaction is deletable only when its signed Stripe event explicitly
    -- says livemode=false. Missing or live evidence is protected by default.
    if exists (
        select 1
        from public.payment_transactions as payment_row
        left join public.payment_events as event
            on event.stripe_event_id = payment_row.stripe_event_id
        where payment_row.student_id = v_target.id
          and event.livemode is distinct from false
    ) or exists (
        select 1
        from public.memberships
        where student_id = v_target.id
          and (
              source = 'stripe'
              or stripe_customer_id is not null
              or stripe_subscription_id is not null
          )
          and stripe_livemode is distinct from false
    ) or exists (
        select 1
        from public.student_access_grants
        where student_id = v_target.id
          and (
              source = 'stripe'
              or stripe_customer_id is not null
              or stripe_subscription_id is not null
              or stripe_checkout_session_id is not null
          )
          and stripe_livemode is distinct from false
    ) then
        if not ('payment_or_access_history' = any(v_blockers)) then
            v_blockers := array_append(v_blockers, 'payment_or_access_history');
        end if;
    end if;

    select coalesce(array_agg(distinct stripe_id), array[]::text[])
    into v_test_customer_ids
    from (
        select stripe_customer_id as stripe_id
        from public.memberships
        where student_id = v_target.id
          and stripe_livemode is false
          and stripe_customer_id is not null
        union
        select stripe_customer_id
        from public.student_access_grants
        where student_id = v_target.id
          and stripe_livemode is false
          and stripe_customer_id is not null
    ) as test_customers;

    select coalesce(array_agg(distinct stripe_id), array[]::text[])
    into v_test_subscription_ids
    from (
        select stripe_subscription_id as stripe_id
        from public.memberships
        where student_id = v_target.id
          and stripe_livemode is false
          and stripe_subscription_id is not null
        union
        select stripe_subscription_id
        from public.student_access_grants
        where student_id = v_target.id
          and stripe_livemode is false
          and stripe_subscription_id is not null
    ) as test_subscriptions;

    select exists (
        select 1
        from public.payment_transactions as payment_row
        join public.payment_events as event
            on event.stripe_event_id = payment_row.stripe_event_id
        where payment_row.student_id = v_target.id
          and event.livemode is false
    ) or coalesce(array_length(v_test_customer_ids, 1), 0) > 0
      or coalesce(array_length(v_test_subscription_ids, 1), 0) > 0
    into v_has_test_payment_history;

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
        'login_username', v_target.login_username,
        'authentication_method', v_target.authentication_method,
        'firebase_uid', v_target.firebase_uid,
        'account_status', coalesce(v_target.account_status, 'active'),
        'must_change_password', coalesce(v_target.must_change_password, false),
        'can_delete', coalesce(array_length(v_blockers, 1), 0) = 0,
        'blockers', to_jsonb(v_blockers),
        'has_test_payment_history', v_has_test_payment_history,
        'test_stripe_customer_ids', to_jsonb(v_test_customer_ids),
        'test_stripe_subscription_ids', to_jsonb(v_test_subscription_ids)
    );
end;
$$;

comment on function public.get_student_account_deletion_eligibility(bigint, bigint) is
    'Admin-only preflight. Test-mode Stripe history may be cleaned up; live, unknown, purchase, and redemption evidence blocks deletion.';

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
    where lower(invited_email) = lower(v_email);

    delete from public.support_tickets
    where student_id = p_target_student_id;

    delete from public.academy_student_import_results
    where student_id = p_target_student_id;

    with deleted_transactions as (
        delete from public.payment_transactions as payment_row
        where payment_row.student_id = p_target_student_id
          and exists (
              select 1
              from public.payment_events as event
              where event.stripe_event_id = payment_row.stripe_event_id
                and event.livemode is false
          )
        returning payment_row.stripe_event_id
    )
    delete from public.payment_events as event
    using deleted_transactions
    where event.stripe_event_id = deleted_transactions.stripe_event_id
      and event.livemode is false;

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
        'deleted', true,
        'test_payment_history_deleted', coalesce((v_eligibility ->> 'has_test_payment_history')::boolean, false)
    );
end;
$$;

comment on function public.delete_unstarted_student_account(bigint, bigint) is
    'Permanently deletes an admin-confirmed student test account, including explicit Stripe test-mode records, while preserving live and unknown payment evidence.';

revoke all on function public.delete_unstarted_student_account(bigint, bigint)
    from public, anon, authenticated;
grant execute on function public.delete_unstarted_student_account(bigint, bigint)
    to service_role;

commit;
