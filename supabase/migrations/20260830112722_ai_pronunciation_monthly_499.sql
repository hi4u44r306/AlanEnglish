begin;

-- Both eligibility paths sell the same AI + pronunciation bundle. Keep the
-- existing plan codes so academy/alumni/general eligibility remains isolated.
-- The database intentionally maps each plan to a unique Stripe Price, while
-- both Prices belong to the same Product and charge the same amount.
do $$
begin
    if exists (
        select 1
        from public.memberships memberships
        join public.subscription_plans plans on plans.id = memberships.plan_id
        where plans.code in (
            'ai_materials_addon_monthly',
            'ai_materials_general_monthly'
        )
          and memberships.status in ('active', 'trialing', 'past_due')
    ) then
        raise exception 'AI plan pricing change blocked because an active AI membership exists';
    end if;
end;
$$;

update public.subscription_plans
set name = 'AI 教材與發音練習',
    description = '包含 AI 教材生成與發音練習；AI 教材每日最多 5 次、每月最多 150 次。一般會員與離校生需同時保有基本自主學習會員。',
    price_twd = 499,
    billing_interval = 'month',
    trial_days = 0,
    ai_daily_limit = 5,
    stripe_price_id = case code
        when 'ai_materials_addon_monthly' then 'price_1UA77m0HG4ffktlqXYkqQqrQ'
        when 'ai_materials_general_monthly' then 'price_1UA79o0HG4ffktlqNe5ofIgE'
    end,
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
    access_model = 'addon',
    updated_at = now()
where code in (
    'ai_materials_addon_monthly',
    'ai_materials_general_monthly'
);

do $$
declare
    valid_plan_count integer;
begin
    select count(*)
    into valid_plan_count
    from public.subscription_plans
    where code in (
        'ai_materials_addon_monthly',
        'ai_materials_general_monthly'
    )
      and name = 'AI 教材與發音練習'
      and price_twd = 499
      and billing_interval = 'month'
      and access_model = 'addon'
      and features ->> 'ai_materials' = 'true'
      and (
          (code = 'ai_materials_addon_monthly' and stripe_price_id = 'price_1UA77m0HG4ffktlqXYkqQqrQ')
          or
          (code = 'ai_materials_general_monthly' and stripe_price_id = 'price_1UA79o0HG4ffktlqNe5ofIgE')
      );

    if valid_plan_count <> 2 then
        raise exception 'AI materials and pronunciation pricing migration validation failed';
    end if;
end;
$$;

commit;
