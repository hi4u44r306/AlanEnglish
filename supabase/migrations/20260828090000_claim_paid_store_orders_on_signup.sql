-- Link paid physical-store orders to a newly created Alan English student.
-- Store authentication remains separate; matching is by verified Firebase email.

alter table public.store_orders
    add column if not exists claimed_by_student_id bigint references public.students(id) on delete set null,
    add column if not exists claimed_at timestamptz;

create index if not exists store_orders_claimable_email_idx
    on public.store_orders(lower(customer_email), payment_status)
    where payment_status = 'paid' and claimed_by_student_id is null;

create or replace function public.claim_paid_store_orders_for_student(
    p_student_id bigint,
    p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    order_row record;
    item_row record;
    plan_id bigint;
    order_count integer := 0;
    book_count integer := 0;
    access_start timestamptz := now();
    access_end timestamptz := now() + interval '90 days';
    entitlement_id bigint;
begin
    if p_student_id is null or nullif(lower(btrim(p_email)), '') is null then
        raise exception 'invalid_claim_request';
    end if;

    if not exists (
        select 1 from public.students
        where id = p_student_id and role = 'student'
    ) then
        raise exception 'student_not_found';
    end if;

    select id into plan_id
    from public.subscription_plans
    where code = 'textbook_access' and enabled = true
    limit 1;

    for order_row in
        select id
        from public.store_orders
        where lower(customer_email) = lower(btrim(p_email))
          and payment_status = 'paid'
          and claimed_by_student_id is null
        order by paid_at nulls last, id
        for update skip locked
    loop
        for item_row in
            select oi.id as item_id, mpb.book_id
            from public.store_order_items oi
            join public.material_package_books mpb
              on mpb.package_id = oi.package_id
             and mpb.role in ('workbook', 'listening_book', 'web_material')
            where oi.order_id = order_row.id
        loop
            insert into public.student_book_entitlements (
                student_id, book_id, source, source_reference_type,
                source_reference_id, status, is_permanent, starts_at, metadata
            ) values (
                p_student_id, item_row.book_id, 'material_purchase',
                'store_order_item', item_row.item_id, 'active', true,
                access_start, jsonb_build_object('store_order_id', order_row.id)
            )
            on conflict (student_id, book_id, source, source_reference_type, source_reference_id)
            do update set status = 'active', updated_at = now()
            returning id into entitlement_id;
            book_count := book_count + 1;
        end loop;

        if plan_id is not null then
            insert into public.student_access_grants (
                student_id, plan_id, source, source_reference_type,
                source_reference_id, status, starts_at, ends_at, metadata
            ) values (
                p_student_id, plan_id, 'material_purchase', 'store_order',
                order_row.id, 'active', access_start, access_end,
                jsonb_build_object('store_order_id', order_row.id, 'duration_days', 90)
            ) on conflict do nothing;
        end if;

        update public.store_orders
        set claimed_by_student_id = p_student_id, claimed_at = now(), updated_at = now()
        where id = order_row.id and claimed_by_student_id is null;
        order_count := order_count + 1;
    end loop;

    update public.students
    set learner_type = case when learner_type = 'trial_user' then 'textbook_customer' else learner_type end,
        updated_at = now()
    where id = p_student_id and order_count > 0;

    return jsonb_build_object('claimed_orders', order_count, 'claimed_books', book_count);
end;
$$;

revoke all on function public.claim_paid_store_orders_for_student(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_paid_store_orders_for_student(bigint, text) to service_role;
