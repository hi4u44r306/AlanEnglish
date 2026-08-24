begin;

-- AI generation is a paid add-on for academy students.  It intentionally
-- remains an independent grant so it never replaces academy enrolment,
-- assignments, purchased books, or other existing access sources.

alter table public.subscription_plans
    drop constraint if exists subscription_plans_access_model_check;

alter table public.subscription_plans
    add constraint subscription_plans_access_model_check
    check (access_model in ('subscription', 'academy', 'textbook', 'trial', 'addon'));

update public.subscription_plans
set features = jsonb_set(
        coalesce(features, '{}'::jsonb),
        '{ai_materials}',
        'false'::jsonb,
        true
    ),
    ai_daily_limit = 0,
    description = '提供在學英文班學生使用；包含班級作業、聽力、會話與智慧複習，不包含 AI 教材生成。',
    updated_at = now()
where code = 'academy_internal';

-- A free trial can experience AI materials in a deliberately small allowance:
-- at most two per day and seven across its seven-day trial.
update public.subscription_plans
set features = jsonb_set(
        coalesce(features, '{}'::jsonb),
        '{ai_materials}',
        'true'::jsonb,
        true
    ),
    ai_daily_limit = 2,
    description = '公開註冊後的七天試用；可生成 AI 教材共 7 次、每日最多 2 次，不包含班級作業。',
    updated_at = now()
where code = 'trial_7_day';

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
    'ai_materials_addon_monthly',
    'AI 教材加購',
    '在學英文班學生的 AI 教材生成加購方案；每日可生成 5 次專屬練習。',
    99,
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
    4,
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

commit;
