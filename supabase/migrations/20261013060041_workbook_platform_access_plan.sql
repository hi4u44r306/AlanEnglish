-- Workbook platform plan: one purchased Workbook plus listening and the speaking
-- challenge for that book only, sold through activation codes (180 or 365 days).
-- Additive: no existing plan, grant or entitlement is modified.

insert into public.subscription_plans (
    code, name, description, price_twd, billing_interval, trial_days, ai_daily_limit,
    stripe_price_id, features, is_public, enabled, sort_order, access_model
) values (
    'workbook_platform_access',
    '習作本平台方案',
    '購買一本習作本附贈的平台使用權：有效期間可使用該本習作本的聽力教材與口說大挑戰，不包含 AI 教材生成與班級作業。自啟用碼兌換日起算，不自動續費；習作本擁有權永久保留。',
    null, 'month', 0, 0, null,
    jsonb_build_object(
        'listening', true,
        'review', true,
        'pronunciation', true,
        'pronunciation_practice', true,
        'ai_materials', false,
        'conversation', false,
        'assignments', false,
        'requires_book_entitlement', true
    ),
    false, true, 91, 'textbook'
)
on conflict (code) do nothing;

-- Same aggregation as before, plus a `pronunciation` feature so a plan can grant the
-- speaking challenge without granting AI materials. Callers that ignore the new key
-- are unaffected; plans without the key keep resolving to false.
create or replace function public.get_student_effective_access(
    p_student_id bigint,
    p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
    target_student record;
    active_grants jsonb := '[]'::jsonb;
    plan_codes text[] := array[]::text[];
    active_count integer := 0;
    has_unlimited boolean := false;
    maximum_end timestamptz;
    listening_allowed boolean := false;
    ai_allowed boolean := false;
    pronunciation_allowed boolean := false;
    conversation_allowed boolean := false;
    assignments_allowed boolean := false;
    review_allowed boolean := false;
    requires_book_entitlement boolean := false;
    maximum_ai_daily_limit integer := 0;
    calculated_days_remaining integer;
begin
    select id, role, learner_type
    into target_student
    from public.students
    where id = p_student_id;

    if not found then
        raise exception 'student_not_found';
    end if;

    if target_student.role in ('teacher', 'admin') then
        return jsonb_build_object(
            'student_id', target_student.id,
            'role', target_student.role,
            'learner_type', target_student.learner_type,
            'is_active', true,
            'effective_access_end', null,
            'days_remaining', null,
            'ai_daily_limit', 10,
            'plan_codes', jsonb_build_array('staff_unlimited'),
            'features', jsonb_build_object(
                'listening', true,
                'ai_materials', true,
                'pronunciation', true,
                'conversation', true,
                'assignments', true,
                'review', true,
                'requires_book_entitlement', false
            ),
            'grants', '[]'::jsonb
        );
    end if;

    with valid_grants as (
        select
            grants.id,
            grants.plan_id,
            grants.source,
            grants.source_reference_type,
            grants.source_reference_id,
            grants.status,
            grants.starts_at,
            grants.ends_at,
            plans.code as plan_code,
            plans.name as plan_name,
            plans.access_model,
            plans.ai_daily_limit,
            plans.features
        from public.student_access_grants grants
        join public.subscription_plans plans
          on plans.id = grants.plan_id
        where grants.student_id = p_student_id
          and grants.status = 'active'
          and grants.starts_at <= p_as_of
          and (grants.ends_at is null or grants.ends_at > p_as_of)
          and plans.enabled = true
    )
    select
        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'plan_id', plan_id,
                    'plan_code', plan_code,
                    'plan_name', plan_name,
                    'access_model', access_model,
                    'source', source,
                    'source_reference_type', source_reference_type,
                    'source_reference_id', source_reference_id,
                    'starts_at', starts_at,
                    'ends_at', ends_at
                )
                order by starts_at, id
            ),
            '[]'::jsonb
        ),
        coalesce(array_agg(distinct plan_code order by plan_code), array[]::text[]),
        count(*)::integer,
        coalesce(bool_or(ends_at is null), false),
        max(ends_at),
        coalesce(bool_or(coalesce((features ->> 'listening')::boolean, false)), false),
        coalesce(bool_or(coalesce((features ->> 'ai_materials')::boolean, false)), false),
        coalesce(bool_or(
            coalesce((features ->> 'pronunciation')::boolean, false)
            or coalesce((features ->> 'pronunciation_practice')::boolean, false)
        ), false),
        coalesce(bool_or(coalesce((features ->> 'conversation')::boolean, false)), false),
        coalesce(bool_or(coalesce((features ->> 'assignments')::boolean, false)), false),
        coalesce(bool_or(coalesce((features ->> 'review')::boolean, false)), false),
        coalesce(bool_and(coalesce((features ->> 'requires_book_entitlement')::boolean, false)), false),
        coalesce(max(ai_daily_limit), 0)
    into
        active_grants,
        plan_codes,
        active_count,
        has_unlimited,
        maximum_end,
        listening_allowed,
        ai_allowed,
        pronunciation_allowed,
        conversation_allowed,
        assignments_allowed,
        review_allowed,
        requires_book_entitlement,
        maximum_ai_daily_limit
    from valid_grants;

    -- Defense in depth: assignments always require an academy student account,
    -- even if a non-academy plan is accidentally configured incorrectly.
    assignments_allowed := assignments_allowed
        and target_student.learner_type = 'academy_student';

    if active_count = 0 or has_unlimited then
        calculated_days_remaining := null;
    else
        calculated_days_remaining := greatest(
            0,
            ceil(extract(epoch from (maximum_end - p_as_of)) / 86400.0)::integer
        );
    end if;

    return jsonb_build_object(
        'student_id', target_student.id,
        'role', target_student.role,
        'learner_type', target_student.learner_type,
        'is_active', active_count > 0,
        'effective_access_end', case
            when has_unlimited then null
            else maximum_end
        end,
        'days_remaining', calculated_days_remaining,
        'ai_daily_limit', maximum_ai_daily_limit,
        'plan_codes', to_jsonb(plan_codes),
        'features', jsonb_build_object(
            'listening', listening_allowed,
            'ai_materials', ai_allowed,
            'pronunciation', pronunciation_allowed,
            'conversation', conversation_allowed,
            'assignments', assignments_allowed,
            'review', review_allowed,
            'requires_book_entitlement', requires_book_entitlement
        ),
        'grants', active_grants
    );
end;
$$;
