begin;

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

    with target_purchase_entitlements as materialized (
        select
            purchase_entitlement.id as link_id,
            purchase_entitlement.book_entitlement_id
        from public.material_purchase_entitlements as purchase_entitlement
        join public.material_purchases as purchase
          on purchase.id = purchase_entitlement.purchase_id
        join public.student_book_entitlements as book_entitlement
          on book_entitlement.id = purchase_entitlement.book_entitlement_id
         and book_entitlement.student_id = p_target_student_id
        where purchase.student_id = p_target_student_id
          and purchase.stripe_livemode is false
    ), deleted_purchase_entitlement_links as (
        delete from public.material_purchase_entitlements as purchase_entitlement
        using target_purchase_entitlements as target
        where purchase_entitlement.id = target.link_id
        returning target.book_entitlement_id
    )
    delete from public.student_book_entitlements as book_entitlement
    using deleted_purchase_entitlement_links as deleted_link
    where book_entitlement.id = deleted_link.book_entitlement_id
      and book_entitlement.student_id = p_target_student_id;

    delete from public.material_purchases
    where student_id = p_target_student_id
      and stripe_livemode is false;

    -- These two request/session ledgers intentionally use ON DELETE RESTRICT.
    -- For an admin-confirmed test-account deletion, remove only rows owned by
    -- the exact target student before the parent account is deleted.
    delete from public.speaking_pronunciation_requests
    where student_id = p_target_student_id;

    delete from public.speaking_challenge_sessions
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
    'Permanently deletes an admin-confirmed student test account, including explicit Stripe test-mode subscriptions, material purchases, owned speaking request/session ledgers, and payment rows, while preserving live and unknown payment evidence.';

revoke all on function public.delete_unstarted_student_account(bigint, bigint)
    from public, anon, authenticated;
grant execute on function public.delete_unstarted_student_account(bigint, bigint)
    to service_role;

commit;
