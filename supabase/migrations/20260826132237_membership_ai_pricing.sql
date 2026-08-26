begin;

-- The basic membership keeps existing book entitlements usable. AI generation
-- remains a separate add-on and never grants class assignments or new books.
insert into public.subscription_plans (
    code,
    name,
    description,
    price_twd,
    billing_interval,
    trial_days,
    ai_daily_limit,
    stripe_price_id,
    features,
    is_public,
    enabled,
    sort_order,
    access_model,
    updated_at
)
values (
    'basic_membership_monthly',
    '基本自主學習會員',
    '適合一般會員、教材三個月權限到期者與英文班離校生；延續已購或已開通教材的自主學習功能，不包含 AI 教材。',
    299,
    'month',
    0,
    0,
    null,
    jsonb_build_object(
        'listening', true,
        'ai_materials', false,
        'conversation', true,
        'assignments', false,
        'review', true,
        'requires_book_entitlement', true
    ),
    true,
    true,
    4,
    'subscription',
    now()
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    price_twd = excluded.price_twd,
    billing_interval = excluded.billing_interval,
    trial_days = excluded.trial_days,
    ai_daily_limit = excluded.ai_daily_limit,
    features = excluded.features,
    is_public = excluded.is_public,
    enabled = excluded.enabled,
    sort_order = excluded.sort_order,
    access_model = excluded.access_model,
    updated_at = now();

-- Keep the already-created Stripe Price ID for the existing NT$99 plan.
-- It is now the academy/alumni rate: active academy students may buy it
-- directly; alumni must also have an active NT$299 basic membership.
update public.subscription_plans
set name = '英文班／離校生 AI 加購',
    description = '英文班在校生與離校生優惠；每日最多 5 次、每月最多 150 次。離校生需同時保有基本自主學習會員。',
    price_twd = 99,
    billing_interval = 'month',
    trial_days = 0,
    ai_daily_limit = 5,
    features = jsonb_build_object(
        'listening', false,
        'ai_materials', true,
        'ai_monthly_limit', 150,
        'conversation', false,
        'assignments', false,
        'review', false,
        'requires_book_entitlement', false
    ),
    is_public = true,
    enabled = true,
    sort_order = 5,
    access_model = 'addon',
    updated_at = now()
where code = 'ai_materials_addon_monthly';

insert into public.subscription_plans (
    code,
    name,
    description,
    price_twd,
    billing_interval,
    trial_days,
    ai_daily_limit,
    stripe_price_id,
    features,
    is_public,
    enabled,
    sort_order,
    access_model,
    updated_at
)
values (
    'ai_materials_general_monthly',
    '一般會員 AI 加購',
    '一般會員專用 AI 教材加購；每日最多 5 次、每月最多 150 次，需搭配有效的基本自主學習會員。',
    129,
    'month',
    0,
    5,
    null,
    jsonb_build_object(
        'listening', false,
        'ai_materials', true,
        'ai_monthly_limit', 150,
        'conversation', false,
        'assignments', false,
        'review', false,
        'requires_book_entitlement', false
    ),
    true,
    true,
    6,
    'addon',
    now()
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    price_twd = excluded.price_twd,
    billing_interval = excluded.billing_interval,
    trial_days = excluded.trial_days,
    ai_daily_limit = excluded.ai_daily_limit,
    features = excluded.features,
    is_public = excluded.is_public,
    enabled = excluded.enabled,
    sort_order = excluded.sort_order,
    access_model = excluded.access_model,
    updated_at = now();

-- Keep legacy rows and grants for history, but stop selling the old public
-- monthly plans. Existing entitlements are not deleted or overwritten.
update public.subscription_plans
set is_public = false,
    updated_at = now()
where code in ('listening_monthly', 'all_access_monthly');

do $$
declare
    invalid_plan_count integer;
begin
    select count(*)
    into invalid_plan_count
    from public.subscription_plans
    where (code = 'basic_membership_monthly' and (price_twd <> 299 or access_model <> 'subscription'))
       or (code = 'ai_materials_addon_monthly' and (price_twd <> 99 or access_model <> 'addon'))
       or (code = 'ai_materials_general_monthly' and (price_twd <> 129 or access_model <> 'addon'));

    if invalid_plan_count <> 0 then
        raise exception 'Membership pricing migration validation failed';
    end if;

    if (
        select count(*)
        from public.subscription_plans
        where code in (
            'basic_membership_monthly',
            'ai_materials_addon_monthly',
            'ai_materials_general_monthly'
        )
    ) <> 3 then
        raise exception 'Membership pricing plans are incomplete';
    end if;
end;
$$;

commit;
