begin;

-- Propagate an already verified Stripe mode from each membership to the
-- membership-backed access grant. This repairs the missing test-mode marker
-- without trusting client input or weakening the account-deletion guard.
update public.student_access_grants as access_grant
set
    stripe_livemode = membership.stripe_livemode,
    updated_at = now()
from public.memberships as membership
where access_grant.student_id = membership.student_id
  and access_grant.source = 'stripe'
  and access_grant.source_reference_type = 'membership'
  and access_grant.source_reference_id = membership.id
  and access_grant.stripe_livemode is null
  and membership.stripe_livemode is not null;

-- One confirmed test student received two paid test-mode physical-store
-- orders during sandbox verification. The project owner explicitly approved
-- permanent removal on 2026-09-29. The opaque Firebase UID digest makes this
-- cleanup a no-op in any database where student id 7 is a different person.
do $$
declare
    v_target_student_id constant bigint := 7;
    v_expected_uid_digest constant text := 'fc13cabd076f1b2071784df87f4b1e02';
    v_order_count integer;
    v_access_grant_count integer;
    v_book_entitlement_count integer;
begin
    if not exists (
        select 1
        from public.students
        where id = v_target_student_id
          and role = 'student'
          and learner_type = 'textbook_customer'
          and md5(coalesce(firebase_uid, '')) = v_expected_uid_digest
    ) then
        return;
    end if;

    select count(*)
    into v_order_count
    from public.store_orders
    where claimed_by_student_id = v_target_student_id
      and payment_status = 'paid'
      and fulfillment_status = 'preparing'
      and stripe_livemode is false;

    if v_order_count <> 2 or exists (
        select 1
        from public.store_orders
        where claimed_by_student_id = v_target_student_id
          and (
              payment_status <> 'paid'
              or fulfillment_status <> 'preparing'
              or stripe_livemode is distinct from false
          )
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'confirmed_test_cleanup_store_order_guard_failed';
    end if;

    select count(*)
    into v_access_grant_count
    from public.student_access_grants as access_grant
    join public.subscription_plans as plan
      on plan.id = access_grant.plan_id
    join public.store_orders as store_order
      on store_order.id = access_grant.source_reference_id
     and store_order.claimed_by_student_id = v_target_student_id
     and store_order.stripe_livemode is false
    where access_grant.student_id = v_target_student_id
      and access_grant.source = 'material_purchase'
      and access_grant.source_reference_type = 'store_order'
      and access_grant.status = 'active'
      and plan.code = 'textbook_access';

    if v_access_grant_count <> 2 or exists (
        select 1
        from public.student_access_grants
        where student_id = v_target_student_id
          and source in ('material_purchase', 'activation_code')
          and not (
              source = 'material_purchase'
              and source_reference_type = 'store_order'
              and status = 'active'
          )
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'confirmed_test_cleanup_access_grant_guard_failed';
    end if;

    select count(*)
    into v_book_entitlement_count
    from public.student_book_entitlements as entitlement
    join public.store_order_items as order_item
      on order_item.id = entitlement.source_reference_id
    join public.store_orders as store_order
      on store_order.id = order_item.order_id
     and store_order.claimed_by_student_id = v_target_student_id
     and store_order.stripe_livemode is false
    where entitlement.student_id = v_target_student_id
      and entitlement.source = 'material_purchase'
      and entitlement.source_reference_type = 'store_order_item'
      and entitlement.status = 'active'
      and entitlement.is_permanent is true;

    if v_book_entitlement_count <> 4 or exists (
        select 1
        from public.student_book_entitlements
        where student_id = v_target_student_id
          and source in ('material_purchase', 'activation_code')
          and not (
              source = 'material_purchase'
              and source_reference_type = 'store_order_item'
              and status = 'active'
              and is_permanent is true
          )
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'confirmed_test_cleanup_book_entitlement_guard_failed';
    end if;

    if exists (
        select 1
        from public.payment_transactions as payment_row
        left join public.payment_events as event
          on event.stripe_event_id = payment_row.stripe_event_id
        where payment_row.student_id = v_target_student_id
          and event.livemode is distinct from false
    ) or exists (
        select 1
        from public.material_purchases
        where student_id = v_target_student_id
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'confirmed_test_cleanup_payment_guard_failed';
    end if;

    delete from public.student_book_entitlements as entitlement
    where entitlement.student_id = v_target_student_id
      and entitlement.source = 'material_purchase'
      and entitlement.source_reference_type = 'store_order_item'
      and exists (
          select 1
          from public.store_order_items as order_item
          join public.store_orders as store_order
            on store_order.id = order_item.order_id
          where order_item.id = entitlement.source_reference_id
            and store_order.claimed_by_student_id = v_target_student_id
            and store_order.stripe_livemode is false
      );

    delete from public.student_access_grants as access_grant
    where access_grant.student_id = v_target_student_id
      and access_grant.source = 'material_purchase'
      and access_grant.source_reference_type = 'store_order'
      and exists (
          select 1
          from public.store_orders as store_order
          where store_order.id = access_grant.source_reference_id
            and store_order.claimed_by_student_id = v_target_student_id
            and store_order.stripe_livemode is false
      );

    insert into public.store_order_status_history (
        order_id,
        payment_status,
        fulfillment_status,
        note,
        changed_by
    )
    select
        id,
        'refunded',
        'cancelled',
        'Confirmed sandbox account cleanup (2026-09-29)',
        'system'
    from public.store_orders
    where claimed_by_student_id = v_target_student_id
      and stripe_livemode is false;

    update public.store_orders
    set
        payment_status = 'refunded',
        fulfillment_status = 'cancelled',
        claimed_by_student_id = null,
        claimed_at = null,
        inventory_released_at = coalesce(inventory_released_at, now()),
        updated_at = now()
    where claimed_by_student_id = v_target_student_id
      and stripe_livemode is false;
end;
$$;

commit;
