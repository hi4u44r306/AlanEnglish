-- Simplify the current commercial offers and make the three-book bundle rule
-- explicit without rewriting earlier migration history.

-- NT$299 is now the single self-study platform subscription. It unlocks every
-- enabled formal listening title, while assignments and AI remain separate.
update public.subscription_plans
set
    name = '基本自主學習會員',
    description = '每月 NT$299，可使用全部正式聽力教材、情境會話與智慧複習；不包含英文班作業、實體教材或 AI Premium。',
    price_twd = 299,
    billing_interval = 'month',
    features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
        'listening', true,
        'conversation', true,
        'review', true,
        'assignments', false,
        'ai_materials', false,
        'requires_book_entitlement', false
    ),
    is_public = true,
    enabled = true,
    access_model = 'subscription',
    updated_at = now()
where code = 'basic_membership_monthly';

-- The academy platform access is included in the NT$2,800 class tuition and
-- uses the same full formal listening catalog. Class assignments continue to
-- be checked independently by active enrollment and target class.
update public.subscription_plans
set
    description = '英文班在校期間由 NT$2,800 月費包含平台使用，可使用全部正式聽力教材及所屬班級作業。',
    features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
        'listening', true,
        'conversation', true,
        'review', true,
        'assignments', true,
        'ai_materials', false,
        'requires_book_entitlement', false
    ),
    is_public = false,
    enabled = true,
    updated_at = now()
where code = 'academy_internal';

-- Keep one current AI offer for every eligible student. The old general code
-- remains as an inactive history row so receipts and audit records stay
-- readable; it cannot be purchased, granted, or republished accidentally.
update public.subscription_plans
set
    name = 'AI 教材與發音練習',
    description = 'AI Premium：AI 教材生成與 AI 發音練習，每日最多 5 次、每月最多 150 次。英文班在校生可直接加購；其他學生須搭配基本會員。',
    price_twd = 499,
    billing_interval = 'month',
    ai_daily_limit = 5,
    features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
        'listening', false,
        'conversation', false,
        'review', false,
        'assignments', false,
        'ai_materials', true,
        'ai_monthly_limit', 150,
        'pronunciation_practice', true,
        'requires_book_entitlement', false
    ),
    is_public = true,
    enabled = true,
    access_model = 'addon',
    updated_at = now()
where code = 'ai_materials_addon_monthly';

update public.subscription_plans
set
    name = '歷史 AI 加購（已整併）',
    description = '歷史方案代碼，只保留既有帳務與稽核紀錄；新訂閱統一使用 AI 教材與發音練習。',
    is_public = false,
    enabled = false,
    updated_at = now()
where code = 'ai_materials_general_monthly';

update public.subscription_plans
set is_public = false, enabled = false, updated_at = now()
where code in ('listening_monthly', 'all_access_monthly');

-- Existing two-book test packages are moved back to draft before the new
-- three-book invariant is installed. No paid order or entitlement is deleted.
update public.material_packages p
set status = 'draft', updated_at = now()
where p.status = 'published'
  and not (
      (select count(*) from public.material_package_books b where b.package_id=p.id and b.role='workbook') = 1
      and (select count(*) from public.material_package_books b where b.package_id=p.id and b.role='listening_book') = 1
      and (select count(*) from public.material_package_books b where b.package_id=p.id and b.role='textbook') = 1
  );

-- A sellable package has one public price. Every paid package keeps permanent
-- book ownership and receives the configured 90-day platform grant.
update public.material_packages
set
    member_price_twd = null,
    stripe_member_price_id = null,
    includes_90_day_access = true,
    updated_at = now();

alter table public.material_package_books
    drop constraint if exists material_package_books_role_check;
alter table public.material_package_books
    add constraint material_package_books_role_check
    check (role in ('textbook', 'workbook', 'listening_book', 'web_material'));

create or replace function private.enforce_material_package_publishable()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
    textbook_count integer;
    workbook_count integer;
    listening_count integer;
begin
    if new.status <> 'published' then
        return new;
    end if;

    select
        count(*) filter(where role='textbook'),
        count(*) filter(where role='workbook'),
        count(*) filter(where role='listening_book')
    into textbook_count,workbook_count,listening_count
    from public.material_package_books
    where package_id=new.id;

    if new.standard_price_twd is null
       or nullif(btrim(coalesce(new.stripe_product_id,'')),'') is null
       or nullif(btrim(coalesce(new.stripe_standard_price_id,'')),'') is null
       or new.stripe_livemode <> false
       or new.includes_90_day_access <> true
       or textbook_count <> 1
       or workbook_count <> 1
       or listening_count <> 1 then
        raise exception using errcode='23514', message='material_package_incomplete';
    end if;
    return new;
end;
$$;

revoke all on function private.enforce_material_package_publishable()
from public,anon,authenticated;
grant execute on function private.enforce_material_package_publishable()
to service_role;

drop trigger if exists material_packages_publishable on public.material_packages;
create trigger material_packages_publishable
before insert or update on public.material_packages
for each row execute function private.enforce_material_package_publishable();

create or replace function private.guard_published_material_package_books()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
    package_id_to_check bigint;
    package_status text;
    textbook_count integer;
    workbook_count integer;
    listening_count integer;
begin
    foreach package_id_to_check in array array[
        case when tg_op <> 'INSERT' then old.package_id end,
        case when tg_op <> 'DELETE' then new.package_id end
    ] loop
        if package_id_to_check is null then
            continue;
        end if;

        select status into package_status
        from public.material_packages
        where id=package_id_to_check;

        if package_status='published' then
            select
                count(*) filter(where role='textbook'),
                count(*) filter(where role='workbook'),
                count(*) filter(where role='listening_book')
            into textbook_count,workbook_count,listening_count
            from public.material_package_books
            where package_id=package_id_to_check;

            if textbook_count <> 1 or workbook_count <> 1 or listening_count <> 1 then
                raise exception using errcode='23514', message='material_package_incomplete';
            end if;
        end if;
    end loop;

    if tg_op='DELETE' then
        return old;
    end if;
    return new;
end;
$$;

revoke all on function private.guard_published_material_package_books()
from public,anon,authenticated;
grant execute on function private.guard_published_material_package_books()
to service_role;

comment on column public.material_package_books.role is
'Commercial bundle role. A published bundle contains exactly one textbook, one workbook and one listening_book; web_material is optional.';

-- Include the textbook when an already-paid independent store order is linked
-- to a newly created learning-platform account.
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
             and mpb.role in ('textbook', 'workbook', 'listening_book', 'web_material')
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

revoke all on function public.claim_paid_store_orders_for_student(bigint, text)
from public, anon, authenticated;
grant execute on function public.claim_paid_store_orders_for_student(bigint, text)
to service_role;
