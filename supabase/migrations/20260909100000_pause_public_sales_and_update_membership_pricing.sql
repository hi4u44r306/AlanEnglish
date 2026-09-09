-- Public product sales are paused while the catalogue and fulfilment flow are prepared.
-- Existing grants, subscriptions, orders and historical prices are intentionally retained.

begin;

update public.subscription_plans
set
    name = '自主學習平台',
    description = '自主學習平台月費。僅提供既有教材與平台學習功能；AI 教材需另外加購。',
    price_twd = 299,
    is_public = true,
    enabled = true,
    updated_at = now()
where code = 'basic_membership_monthly';

update public.subscription_plans
set
    name = 'AI 教材加購',
    description = '自主學習平台的 AI 教材加購，每月 NT$299。重新開放付款前必須先設定並驗證相同金額的 Stripe Price。',
    price_twd = 299,
    is_public = true,
    enabled = true,
    updated_at = now()
where code = 'ai_materials_general_monthly';

update public.subscription_plans
set
    name = '英文班在學方案',
    description = '英文班內部方案，包含班級教材、作業、聽力、AI 教材、會話與智慧複習；不在公開網站販售。',
    price_twd = 599,
    features = jsonb_build_object(
        'listening', true,
        'ai_materials', true,
        'ai_monthly_limit', 150,
        'conversation', true,
        'assignments', true,
        'review', true,
        'requires_book_entitlement', false
    ),
    ai_daily_limit = 5,
    is_public = false,
    enabled = true,
    updated_at = now()
where code = 'academy_internal';

-- The old academy add-on stays enabled only so existing grants remain readable.
-- It must not be offered to new customers after AI became part of academy_internal.
update public.subscription_plans
set
    name = '舊版英文班 AI 加購（停售）',
    is_public = false,
    updated_at = now()
where code = 'ai_materials_addon_monthly';

-- Keep all package records and entitlements, but prevent any package from being
-- returned as a public, purchasable product when this migration is applied.
update public.material_packages
set
    status = 'draft',
    updated_at = now()
where status = 'published';

commit;
