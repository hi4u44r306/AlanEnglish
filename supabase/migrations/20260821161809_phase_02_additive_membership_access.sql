begin;

-- =========================================================
-- Alan English - Phase 02
-- Additive membership access and non-destructive activation
-- =========================================================

-- This migration keeps public.memberships as the primary account/billing
-- record used by the current website. New access sources are stored in
-- public.student_access_grants so academy, trial, purchase and subscription
-- access can coexist without overwriting one another.

-- 1. Classify subscription plans by access model.

alter table public.subscription_plans
    add column if not exists access_model text not null default 'subscription';

comment on column public.subscription_plans.access_model is
    'subscription, academy, textbook or trial. Determines how access is granted and displayed.';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.subscription_plans'::regclass
          and conname = 'subscription_plans_access_model_check'
    ) then
        alter table public.subscription_plans
            add constraint subscription_plans_access_model_check
            check (access_model in ('subscription', 'academy', 'textbook', 'trial'));
    end if;
end;
$$;

update public.subscription_plans
set access_model = 'subscription'
where access_model is distinct from 'subscription'
  and code in ('listening_monthly', 'all_access_monthly');

-- 2. Create the three internal plans required by the new account model.

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
values
    (
        'academy_internal',
        '英文班在學方案',
        '提供在學英文班學生使用；包含班級作業、聽力、AI 教材、會話與智慧複習。',
        null,
        'month',
        0,
        10,
        null,
        jsonb_build_object(
            'listening', true,
            'ai_materials', true,
            'conversation', true,
            'assignments', true,
            'review', true,
            'requires_book_entitlement', false
        ),
        false,
        true,
        1,
        'academy',
        now()
    ),
    (
        'textbook_access',
        '網購教材聽力方案',
        '提供購買教材的顧客使用；只開放所購買教材，不包含班級作業。',
        null,
        'month',
        0,
        0,
        null,
        jsonb_build_object(
            'listening', true,
            'ai_materials', false,
            'conversation', false,
            'assignments', false,
            'review', true,
            'requires_book_entitlement', true
        ),
        false,
        true,
        2,
        'textbook',
        now()
    ),
    (
        'trial_7_day',
        '七天免費試用',
        '公開註冊後的七天試用；不包含班級作業，AI 教材每日最多五次。',
        null,
        'month',
        7,
        5,
        null,
        jsonb_build_object(
            'listening', true,
            'ai_materials', true,
            'conversation', true,
            'assignments', false,
            'review', true,
            'requires_book_entitlement', false
        ),
        false,
        true,
        3,
        'trial',
        now()
    )
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    price_twd = excluded.price_twd,
    billing_interval = excluded.billing_interval,
    trial_days = excluded.trial_days,
    ai_daily_limit = excluded.ai_daily_limit,
    stripe_price_id = excluded.stripe_price_id,
    features = excluded.features,
    is_public = excluded.is_public,
    enabled = excluded.enabled,
    sort_order = excluded.sort_order,
    access_model = excluded.access_model,
    updated_at = now();

-- Only academy students may receive class assignments. Existing commercial
-- subscription plans remain usable, but assignments are removed from them.
update public.subscription_plans
set features = jsonb_set(
        coalesce(features, '{}'::jsonb),
        '{assignments}',
        'false'::jsonb,
        true
    ),
    updated_at = now()
where access_model <> 'academy';

update public.subscription_plans
set features = jsonb_set(
        coalesce(features, '{}'::jsonb),
        '{assignments}',
        'true'::jsonb,
        true
    ),
    updated_at = now()
where access_model = 'academy';

-- 3. Allow academy_enrollment as a primary membership source.

alter table public.memberships
    drop constraint if exists memberships_source_check;

alter table public.memberships
    add constraint memberships_source_check
    check (
        source in (
            'public_signup',
            'stripe',
            'activation_code',
            'material_purchase',
            'academy_enrollment',
            'admin_grant',
            'legacy'
        )
    );

-- Migrate existing public signups to the dedicated trial plan. Their existing
-- trial dates and verification status are preserved.
update public.memberships
set plan_id = (
        select id
        from public.subscription_plans
        where code = 'trial_7_day'
    ),
    updated_at = now()
where source = 'public_signup';

-- Migrate existing academy students to the internal academy plan. Staff and
-- online accounts are intentionally left untouched.
update public.memberships
set plan_id = (
        select id
        from public.subscription_plans
        where code = 'academy_internal'
    ),
    status = 'complimentary',
    source = 'academy_enrollment',
    access_started_at = coalesce(access_started_at, created_at, now()),
    access_ends_at = null,
    trial_started_at = null,
    trial_ends_at = null,
    current_period_end = null,
    cancel_at_period_end = false,
    updated_at = now()
where student_id in (
    select id
    from public.students
    where role = 'student'
      and learner_type = 'academy_student'
);

-- 4. Create additive access grants.

create table if not exists public.student_access_grants (
    id bigint generated by default as identity primary key,
    student_id bigint not null
        references public.students(id)
        on delete cascade,
    plan_id bigint not null
        references public.subscription_plans(id)
        on delete restrict,
    source text not null,
    source_reference_type text,
    source_reference_id bigint,
    status text not null default 'active',
    starts_at timestamptz not null default now(),
    ends_at timestamptz,
    revoked_at timestamptz,
    revoke_reason text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint student_access_grants_source_check
        check (
            source in (
                'public_signup',
                'stripe',
                'activation_code',
                'material_purchase',
                'academy_enrollment',
                'admin_grant',
                'legacy'
            )
        ),
    constraint student_access_grants_status_check
        check (status in ('pending', 'active', 'paused', 'expired', 'revoked')),
    constraint student_access_grants_date_order_check
        check (ends_at is null or ends_at > starts_at),
    constraint student_access_grants_source_reference_pair_check
        check (
            (source_reference_type is null and source_reference_id is null)
            or (
                nullif(btrim(source_reference_type), '') is not null
                and source_reference_id is not null
            )
        ),
    constraint student_access_grants_revoke_reason_length_check
        check (revoke_reason is null or char_length(revoke_reason) <= 1000)
);

comment on table public.student_access_grants is
    'Additive access ledger. Every trial, academy enrollment, purchase, activation code or subscription keeps its own historical row.';

comment on column public.student_access_grants.ends_at is
    'Exclusive access end timestamp. Null means unlimited until paused or revoked.';

comment on column public.student_access_grants.source_reference_type is
    'Origin table/type such as membership, academy_enrollment, activation_code, order or payment.';

create unique index if not exists student_access_grants_source_reference_key
    on public.student_access_grants (
        student_id,
        source,
        source_reference_type,
        source_reference_id
    )
    where source_reference_id is not null;

create unique index if not exists student_access_grants_one_public_trial_key
    on public.student_access_grants (student_id)
    where source = 'public_signup';

create index if not exists student_access_grants_student_status_idx
    on public.student_access_grants (student_id, status, starts_at, ends_at);

create index if not exists student_access_grants_plan_status_idx
    on public.student_access_grants (plan_id, status, student_id);

create index if not exists student_access_grants_expiration_idx
    on public.student_access_grants (ends_at)
    where status = 'active'
      and ends_at is not null;

drop trigger if exists student_access_grants_set_updated_at
    on public.student_access_grants;

create trigger student_access_grants_set_updated_at
before update on public.student_access_grants
for each row
execute function public.set_updated_at_now();

-- 5. Convert every existing primary membership into its first access grant.

insert into public.student_access_grants (
    student_id,
    plan_id,
    source,
    source_reference_type,
    source_reference_id,
    status,
    starts_at,
    ends_at,
    metadata
)
select
    memberships.student_id,
    memberships.plan_id,
    memberships.source,
    'membership',
    memberships.id,
    case
        when memberships.status = 'pending_verification' then 'pending'
        when memberships.status in ('trialing', 'active', 'complimentary') then 'active'
        when memberships.status = 'cancelled'
             and greatest(
                 memberships.access_ends_at,
                 memberships.trial_ends_at,
                 memberships.current_period_end
             ) > now() then 'active'
        when memberships.status in ('past_due', 'suspended') then 'paused'
        else 'expired'
    end,
    coalesce(
        memberships.access_started_at,
        memberships.trial_started_at,
        memberships.created_at,
        now()
    ),
    case
        when memberships.status = 'complimentary' then null
        else greatest(
            memberships.access_ends_at,
            memberships.trial_ends_at,
            memberships.current_period_end
        )
    end,
    jsonb_build_object(
        'migrated_from_membership', true,
        'membership_status', memberships.status
    )
from public.memberships
where memberships.plan_id is not null
on conflict (
    student_id,
    source,
    source_reference_type,
    source_reference_id
)
where source_reference_id is not null
do update
set plan_id = excluded.plan_id,
    status = excluded.status,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    metadata = public.student_access_grants.metadata || excluded.metadata,
    updated_at = now();

-- 6. Keep grants synchronized while legacy Edge Functions still write the
--    primary memberships table during the transition.

create or replace function public.sync_access_grant_from_membership()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    target_student public.students%rowtype;
    target_plan_id bigint;
    target_source text;
    target_status text;
    target_start timestamptz;
    target_end timestamptz;
    existing_grant_id bigint;
begin
    select *
    into target_student
    from public.students
    where id = new.student_id;

    if not found then
        raise exception 'membership_student_not_found';
    end if;

    if target_student.role = 'student'
       and target_student.learner_type = 'academy_student' then
        select id
        into target_plan_id
        from public.subscription_plans
        where code = 'academy_internal';
        target_source := 'academy_enrollment';
    elsif new.source = 'public_signup' then
        select id
        into target_plan_id
        from public.subscription_plans
        where code = 'trial_7_day';
        target_source := 'public_signup';
    else
        target_plan_id := new.plan_id;
        target_source := new.source;
    end if;

    if target_plan_id is null then
        return new;
    end if;

    target_start := coalesce(
        new.access_started_at,
        new.trial_started_at,
        new.created_at,
        now()
    );

    target_end := case
        when new.status = 'complimentary' then null
        else greatest(
            new.access_ends_at,
            new.trial_ends_at,
            new.current_period_end
        )
    end;

    target_status := case
        when new.status = 'pending_verification' then 'pending'
        when new.status in ('trialing', 'active', 'complimentary') then 'active'
        when new.status = 'cancelled'
             and target_end is not null
             and target_end > now() then 'active'
        when new.status in ('past_due', 'suspended') then 'paused'
        else 'expired'
    end;

    select id
    into existing_grant_id
    from public.student_access_grants
    where student_id = new.student_id
      and source = target_source
      and source_reference_type = 'membership'
      and source_reference_id = new.id
    for update;

    if found then
        update public.student_access_grants
        set plan_id = target_plan_id,
            source = target_source,
            status = target_status,
            starts_at = target_start,
            ends_at = target_end,
            metadata = metadata || jsonb_build_object(
                'membership_status', new.status,
                'synced_at', now()
            ),
            updated_at = now()
        where id = existing_grant_id;
    else
        -- Preserve the previous source as history when a primary membership
        -- changes from trial to Stripe, admin grant, or another source.
        update public.student_access_grants
        set status = case
                when status in ('pending', 'active', 'paused') then 'expired'
                else status
            end,
            ends_at = case
                when status in ('pending', 'active', 'paused')
                    then greatest(
                        coalesce(ends_at, now()),
                        starts_at + interval '1 second'
                    )
                else ends_at
            end,
            metadata = metadata || jsonb_build_object(
                'membership_source_replaced_at', now(),
                'replacement_source', target_source
            ),
            updated_at = now()
        where student_id = new.student_id
          and source_reference_type = 'membership'
          and source_reference_id = new.id
          and source <> target_source;

        insert into public.student_access_grants (
            student_id,
            plan_id,
            source,
            source_reference_type,
            source_reference_id,
            status,
            starts_at,
            ends_at,
            metadata
        )
        values (
            new.student_id,
            target_plan_id,
            target_source,
            'membership',
            new.id,
            target_status,
            target_start,
            target_end,
            jsonb_build_object(
                'membership_status', new.status,
                'created_by_membership_sync', true
            )
        );
    end if;

    return new;
end;
$$;

revoke all on function public.sync_access_grant_from_membership()
    from public, anon, authenticated;

grant execute on function public.sync_access_grant_from_membership()
    to service_role;

drop trigger if exists memberships_sync_access_grant
    on public.memberships;

create trigger memberships_sync_access_grant
after insert or update of
    student_id,
    plan_id,
    status,
    source,
    trial_started_at,
    trial_ends_at,
    access_started_at,
    access_ends_at,
    current_period_end
on public.memberships
for each row
execute function public.sync_access_grant_from_membership();

-- 7. Synchronize official academy enrollment records with academy grants.

create or replace function public.sync_access_grant_from_academy_enrollment()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    academy_plan_id bigint;
    target_status text;
    target_start timestamptz;
    target_end timestamptz;
    existing_grant_id bigint;
begin
    select id
    into academy_plan_id
    from public.subscription_plans
    where code = 'academy_internal';

    if academy_plan_id is null then
        raise exception 'academy_internal_plan_not_found';
    end if;

    if tg_op = 'DELETE' then
        update public.student_access_grants
        set status = 'revoked',
            ends_at = case
                when ends_at is null or ends_at > now() then greatest(
                    now(),
                    starts_at + interval '1 second'
                )
                else ends_at
            end,
            revoked_at = now(),
            revoke_reason = 'Academy enrollment record deleted.',
            updated_at = now()
        where student_id = old.student_id
          and source = 'academy_enrollment'
          and source_reference_type = 'academy_enrollment'
          and source_reference_id = old.id;
        return old;
    end if;

    target_status := case new.status
        when 'active' then 'active'
        when 'paused' then 'paused'
        when 'graduated' then 'expired'
        else 'revoked'
    end;

    target_start := new.enrolled_at::timestamptz;
    target_end := case
        when new.access_ends_at is null then null
        else (new.access_ends_at + 1)::timestamptz
    end;

    select id
    into existing_grant_id
    from public.student_access_grants
    where student_id = new.student_id
      and source = 'academy_enrollment'
      and source_reference_type = 'academy_enrollment'
      and source_reference_id = new.id
    for update;

    if found then
        update public.student_access_grants
        set plan_id = academy_plan_id,
            status = target_status,
            starts_at = target_start,
            ends_at = case
                when target_status in ('expired', 'revoked')
                    then greatest(
                        coalesce(target_end, now()),
                        target_start + interval '1 second'
                    )
                else target_end
            end,
            revoked_at = case
                when target_status = 'revoked' then coalesce(revoked_at, now())
                else null
            end,
            revoke_reason = case
                when target_status = 'revoked' then 'Academy enrollment withdrawn.'
                else null
            end,
            metadata = metadata || jsonb_build_object(
                'academy_enrollment_status', new.status,
                'class_id', new.class_id
            ),
            updated_at = now()
        where id = existing_grant_id;
    else
        insert into public.student_access_grants (
            student_id,
            plan_id,
            source,
            source_reference_type,
            source_reference_id,
            status,
            starts_at,
            ends_at,
            revoked_at,
            revoke_reason,
            metadata
        )
        values (
            new.student_id,
            academy_plan_id,
            'academy_enrollment',
            'academy_enrollment',
            new.id,
            target_status,
            target_start,
            case
                when target_status in ('expired', 'revoked')
                    then greatest(
                        coalesce(target_end, now()),
                        target_start + interval '1 second'
                    )
                else target_end
            end,
            case when target_status = 'revoked' then now() else null end,
            case when target_status = 'revoked' then 'Academy enrollment withdrawn.' else null end,
            jsonb_build_object(
                'academy_enrollment_status', new.status,
                'class_id', new.class_id
            )
        );
    end if;

    if new.status in ('active', 'paused') then
        update public.students
        set learner_type = 'academy_student',
            updated_at = now()
        where id = new.student_id
          and role = 'student';
    end if;

    return new;
end;
$$;

revoke all on function public.sync_access_grant_from_academy_enrollment()
    from public, anon, authenticated;

grant execute on function public.sync_access_grant_from_academy_enrollment()
    to service_role;

drop trigger if exists academy_enrollments_sync_access_grant
    on public.academy_enrollments;

create trigger academy_enrollments_sync_access_grant
after insert or update or delete
on public.academy_enrollments
for each row
execute function public.sync_access_grant_from_academy_enrollment();

-- Backfill any official academy enrollments that already exist.
insert into public.student_access_grants (
    student_id,
    plan_id,
    source,
    source_reference_type,
    source_reference_id,
    status,
    starts_at,
    ends_at,
    revoked_at,
    revoke_reason,
    metadata
)
select
    academy_enrollments.student_id,
    subscription_plans.id,
    'academy_enrollment',
    'academy_enrollment',
    academy_enrollments.id,
    case academy_enrollments.status
        when 'active' then 'active'
        when 'paused' then 'paused'
        when 'graduated' then 'expired'
        else 'revoked'
    end,
    academy_enrollments.enrolled_at::timestamptz,
    case
        when academy_enrollments.status in ('withdrawn', 'graduated')
            then greatest(
                coalesce(
                    (academy_enrollments.access_ends_at + 1)::timestamptz,
                    academy_enrollments.status_changed_at,
                    now()
                ),
                academy_enrollments.enrolled_at::timestamptz + interval '1 second'
            )
        when academy_enrollments.access_ends_at is not null
            then (academy_enrollments.access_ends_at + 1)::timestamptz
        else null
    end,
    case when academy_enrollments.status = 'withdrawn' then academy_enrollments.status_changed_at else null end,
    case when academy_enrollments.status = 'withdrawn' then 'Academy enrollment withdrawn.' else null end,
    jsonb_build_object(
        'academy_enrollment_status', academy_enrollments.status,
        'class_id', academy_enrollments.class_id,
        'migrated_in_phase_02', true
    )
from public.academy_enrollments
join public.subscription_plans
  on subscription_plans.code = 'academy_internal'
on conflict (
    student_id,
    source,
    source_reference_type,
    source_reference_id
)
where source_reference_id is not null
do update
set plan_id = excluded.plan_id,
    status = excluded.status,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    revoked_at = excluded.revoked_at,
    revoke_reason = excluded.revoke_reason,
    metadata = public.student_access_grants.metadata || excluded.metadata,
    updated_at = now();

-- 8. Add the effective-access reader used by Edge Functions in this phase.

create or replace function public.get_student_effective_access(
    p_student_id bigint,
    p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
stable
security invoker
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
            'conversation', conversation_allowed,
            'assignments', assignments_allowed,
            'review', review_allowed,
            'requires_book_entitlement', requires_book_entitlement
        ),
        'grants', active_grants
    );
end;
$$;

revoke all on function public.get_student_effective_access(bigint, timestamptz)
    from public, anon, authenticated;

grant execute on function public.get_student_effective_access(bigint, timestamptz)
    to service_role;

-- 9. Link redemption history to the exact additive grant.

alter table public.activation_code_redemptions
    add column if not exists access_grant_id bigint;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.activation_code_redemptions'::regclass
          and conname = 'activation_code_redemptions_access_grant_id_fkey'
    ) then
        alter table public.activation_code_redemptions
            add constraint activation_code_redemptions_access_grant_id_fkey
            foreign key (access_grant_id)
            references public.student_access_grants(id)
            on delete restrict;
    end if;
end;
$$;

create unique index if not exists activation_code_redemptions_access_grant_key
    on public.activation_code_redemptions (access_grant_id)
    where access_grant_id is not null;

-- 10. Replace destructive activation-code redemption. The primary membership
--     row is read for compatibility but never updated.

create or replace function public.redeem_activation_code(
    p_student_id bigint,
    p_code_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    target_code public.activation_codes%rowtype;
    target_membership public.memberships%rowtype;
    target_plan public.subscription_plans%rowtype;
    existing_unlimited boolean := false;
    latest_plan_end timestamptz;
    next_start timestamptz;
    next_end timestamptz;
    redemption_id bigint;
    grant_id bigint;
begin
    if p_student_id is null or nullif(btrim(p_code_hash), '') is null then
        raise exception 'invalid_request';
    end if;

    if not exists (
        select 1
        from public.students
        where id = p_student_id
          and role = 'student'
    ) then
        raise exception 'student_not_found';
    end if;

    select *
    into target_code
    from public.activation_codes
    where code_hash = lower(btrim(p_code_hash))
    for update;

    if not found then
        raise exception 'code_not_found';
    end if;

    if target_code.status <> 'active' then
        raise exception 'code_not_active';
    end if;

    if target_code.expires_at is not null and target_code.expires_at <= now() then
        raise exception 'code_expired';
    end if;

    if target_code.redemption_count >= target_code.max_redemptions then
        update public.activation_codes
        set status = 'exhausted',
            updated_at = now()
        where id = target_code.id;
        raise exception 'code_exhausted';
    end if;

    if exists (
        select 1
        from public.activation_code_redemptions
        where activation_code_id = target_code.id
          and student_id = p_student_id
    ) then
        raise exception 'code_already_redeemed';
    end if;

    select *
    into target_membership
    from public.memberships
    where student_id = p_student_id
    for update;

    if not found then
        raise exception 'membership_not_found';
    end if;

    select *
    into target_plan
    from public.subscription_plans
    where id = coalesce(
        target_code.plan_id,
        (
            select id
            from public.subscription_plans
            where code = 'textbook_access'
        )
    )
      and enabled = true;

    if not found then
        raise exception 'activation_plan_not_found';
    end if;

    select
        coalesce(bool_or(ends_at is null), false),
        max(ends_at)
    into
        existing_unlimited,
        latest_plan_end
    from public.student_access_grants
    where student_id = p_student_id
      and plan_id = target_plan.id
      and status = 'active'
      and (ends_at is null or ends_at > now());

    if existing_unlimited then
        raise exception 'membership_already_unlimited';
    end if;

    next_start := now();
    next_end := greatest(coalesce(latest_plan_end, now()), now())
        + make_interval(days => target_code.duration_days);

    insert into public.student_access_grants (
        student_id,
        plan_id,
        source,
        source_reference_type,
        source_reference_id,
        status,
        starts_at,
        ends_at,
        metadata
    )
    values (
        p_student_id,
        target_plan.id,
        'activation_code',
        'activation_code',
        target_code.id,
        'active',
        next_start,
        next_end,
        jsonb_build_object(
            'duration_days', target_code.duration_days,
            'code_hint', target_code.code_hint
        )
    )
    returning id into grant_id;

    insert into public.activation_code_redemptions (
        activation_code_id,
        student_id,
        membership_id,
        access_grant_id,
        access_started_at,
        access_ends_at
    )
    values (
        target_code.id,
        p_student_id,
        target_membership.id,
        grant_id,
        next_start,
        next_end
    )
    returning id into redemption_id;

    update public.activation_codes
    set redemption_count = redemption_count + 1,
        status = case
            when redemption_count + 1 >= max_redemptions then 'exhausted'
            else status
        end,
        updated_at = now()
    where id = target_code.id;

    if target_plan.access_model = 'textbook' then
        update public.students
        set learner_type = case
                when learner_type = 'trial_user' then 'textbook_customer'
                else learner_type
            end,
            updated_at = now()
        where id = p_student_id;
    end if;

    return jsonb_build_object(
        'redemption_id', redemption_id,
        'membership_id', target_membership.id,
        'access_grant_id', grant_id,
        'primary_membership_unchanged', true,
        'status', 'active',
        'plan_id', target_plan.id,
        'plan_code', target_plan.code,
        'access_started_at', next_start,
        'access_ends_at', next_end,
        'duration_days', target_code.duration_days,
        'effective_access', public.get_student_effective_access(p_student_id, now())
    );
end;
$$;

revoke all on function public.redeem_activation_code(bigint, text)
    from public, anon, authenticated;

grant execute on function public.redeem_activation_code(bigint, text)
    to service_role;

-- 11. Secure the new access ledger. Firebase-authenticated users reach it only
--     through verified Edge Functions using the server-side service role.

alter table public.student_access_grants enable row level security;

revoke all on table public.student_access_grants
    from anon, authenticated;

revoke all on sequence public.student_access_grants_id_seq
    from anon, authenticated;

grant all on table public.student_access_grants
    to service_role;

grant usage, select on sequence public.student_access_grants_id_seq
    to service_role;

-- 12. Migration assertions. Any failure rolls back the whole transaction.

do $$
declare
    required_plan_count integer;
    invalid_assignment_plan_count integer;
    missing_membership_grant_count integer;
    academy_assignment_count integer;
    invalid_trial_membership_count integer;
begin
    select count(*)
    into required_plan_count
    from public.subscription_plans
    where code in ('academy_internal', 'textbook_access', 'trial_7_day')
      and enabled = true;

    if required_plan_count <> 3 then
        raise exception 'Phase 02 failed: internal access plans are incomplete';
    end if;

    select count(*)
    into invalid_assignment_plan_count
    from public.subscription_plans
    where access_model <> 'academy'
      and coalesce((features ->> 'assignments')::boolean, false) = true;

    if invalid_assignment_plan_count <> 0 then
        raise exception 'Phase 02 failed: % non-academy plans still allow assignments',
            invalid_assignment_plan_count;
    end if;

    select count(*)
    into academy_assignment_count
    from public.subscription_plans
    where access_model = 'academy'
      and coalesce((features ->> 'assignments')::boolean, false) = true;

    if academy_assignment_count <> 1 then
        raise exception 'Phase 02 failed: academy assignment plan is invalid';
    end if;

    select count(*)
    into missing_membership_grant_count
    from public.memberships
    where plan_id is not null
      and not exists (
          select 1
          from public.student_access_grants
          where student_access_grants.student_id = memberships.student_id
            and student_access_grants.source_reference_type = 'membership'
            and student_access_grants.source_reference_id = memberships.id
      );

    if missing_membership_grant_count <> 0 then
        raise exception 'Phase 02 failed: % memberships have no access grant',
            missing_membership_grant_count;
    end if;

    select count(*)
    into invalid_trial_membership_count
    from public.memberships
    join public.subscription_plans
      on subscription_plans.id = memberships.plan_id
    where memberships.source = 'public_signup'
      and subscription_plans.code <> 'trial_7_day';

    if invalid_trial_membership_count <> 0 then
        raise exception 'Phase 02 failed: % public signups are not using trial_7_day',
            invalid_trial_membership_count;
    end if;
end;
$$;

commit;

-- Verification result shown by the Supabase SQL editor after success.
select
    (
        select count(*)
        from public.subscription_plans
    ) as subscription_plan_count,
    (
        select count(*)
        from public.subscription_plans
        where coalesce((features ->> 'assignments')::boolean, false) = true
    ) as assignment_enabled_plan_count,
    (
        select count(*)
        from public.student_access_grants
    ) as access_grant_count,
    (
        select count(*)
        from public.student_access_grants
        where status = 'active'
          and starts_at <= now()
          and (ends_at is null or ends_at > now())
    ) as currently_active_grant_count,
    (
        select count(*)
        from public.student_access_grants grants
        join public.subscription_plans plans
          on plans.id = grants.plan_id
        where plans.access_model = 'academy'
    ) as academy_grant_count,
    (
        select count(*)
        from public.student_access_grants grants
        join public.subscription_plans plans
          on plans.id = grants.plan_id
        where plans.access_model = 'textbook'
    ) as textbook_grant_count,
    (
        select count(*)
        from public.student_access_grants grants
        join public.subscription_plans plans
          on plans.id = grants.plan_id
        where plans.access_model = 'trial'
    ) as trial_grant_count;
