-- Keep paid memberships tied to their actual plan. Academy access is managed
-- independently by academy_enrollments and must not replace Stripe grants.

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
       and target_student.learner_type = 'academy_student'
       and new.source = 'legacy' then
        -- Academy access is sourced only from academy_enrollments. Older
        -- membership mirrors must not create a second academy grant.
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
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                'academy_membership_mirror_retired_at', now()
            ),
            updated_at = now()
        where student_id = new.student_id
          and source_reference_type = 'membership'
          and source_reference_id = new.id;

        return new;
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
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
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
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
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

-- Retire old membership-backed academy mirrors. The corresponding
-- academy_enrollment grants remain untouched.
update public.memberships
set plan_id = public.memberships.plan_id
from public.students
where public.students.id = public.memberships.student_id
  and public.students.role = 'student'
  and public.students.learner_type = 'academy_student'
  and public.memberships.source = 'legacy'
  and exists (
      select 1
      from public.student_access_grants
      where student_access_grants.student_id = public.memberships.student_id
        and student_access_grants.source_reference_type = 'membership'
        and student_access_grants.source_reference_id = public.memberships.id
        and student_access_grants.status in ('pending', 'active', 'paused')
  );

-- Re-run the corrected trigger for non-legacy memberships whose active grant
-- was previously replaced with an academy plan/source solely by learner_type.
with expected_membership_grants as (
    select
        memberships.id as membership_id,
        case
            when memberships.source = 'public_signup' then trial_plan.id
            else memberships.plan_id
        end as expected_plan_id,
        case
            when memberships.source = 'public_signup' then 'public_signup'
            else memberships.source
        end as expected_source
    from public.memberships
    join public.students
      on public.students.id = memberships.student_id
    left join public.subscription_plans trial_plan
        on trial_plan.code = 'trial_7_day'
    where not (
        public.students.role = 'student'
        and public.students.learner_type = 'academy_student'
        and memberships.source = 'legacy'
    )
), mismatched_memberships as (
    select distinct expected_membership_grants.membership_id
    from expected_membership_grants
    join public.student_access_grants
      on student_access_grants.source_reference_type = 'membership'
     and student_access_grants.source_reference_id = expected_membership_grants.membership_id
    where student_access_grants.status in ('pending', 'active', 'paused')
      and (
          student_access_grants.plan_id is distinct from expected_membership_grants.expected_plan_id
          or student_access_grants.source is distinct from expected_membership_grants.expected_source
      )
)
update public.memberships
set plan_id = public.memberships.plan_id
from mismatched_memberships
where public.memberships.id = mismatched_memberships.membership_id;

-- If a correct grant already existed, the trigger updates it in place. Expire
-- any remaining mismatched historical grant so it cannot add false access.
with expected_membership_grants as (
    select
        memberships.id as membership_id,
        case
            when memberships.source = 'public_signup' then trial_plan.id
            else memberships.plan_id
        end as expected_plan_id,
        case
            when memberships.source = 'public_signup' then 'public_signup'
            else memberships.source
        end as expected_source
    from public.memberships
    join public.students
      on public.students.id = memberships.student_id
    left join public.subscription_plans trial_plan
        on trial_plan.code = 'trial_7_day'
    where not (
        public.students.role = 'student'
        and public.students.learner_type = 'academy_student'
        and memberships.source = 'legacy'
    )
)
update public.student_access_grants
set status = case
        when student_access_grants.status in ('pending', 'active', 'paused') then 'expired'
        else student_access_grants.status
    end,
    ends_at = case
        when student_access_grants.status in ('pending', 'active', 'paused')
            then greatest(
                coalesce(student_access_grants.ends_at, now()),
                student_access_grants.starts_at + interval '1 second'
            )
        else student_access_grants.ends_at
    end,
    metadata = coalesce(student_access_grants.metadata, '{}'::jsonb) || jsonb_build_object(
        'membership_plan_sync_repaired_at', now()
    ),
    updated_at = now()
from expected_membership_grants
where student_access_grants.source_reference_type = 'membership'
  and student_access_grants.source_reference_id = expected_membership_grants.membership_id
  and student_access_grants.status in ('pending', 'active', 'paused')
  and (
      student_access_grants.plan_id is distinct from expected_membership_grants.expected_plan_id
      or student_access_grants.source is distinct from expected_membership_grants.expected_source
  );

do $$
begin
    if exists (
        select 1
        from public.student_access_grants
        join public.memberships
          on student_access_grants.source_reference_type = 'membership'
         and student_access_grants.source_reference_id = memberships.id
        join public.students
          on public.students.id = memberships.student_id
        left join public.subscription_plans trial_plan
          on trial_plan.code = 'trial_7_day'
        where student_access_grants.status in ('pending', 'active', 'paused')
          and (
              (
                  public.students.role = 'student'
                  and public.students.learner_type = 'academy_student'
                  and memberships.source = 'legacy'
              )
              or (
                  not (
                      public.students.role = 'student'
                      and public.students.learner_type = 'academy_student'
                      and memberships.source = 'legacy'
                  )
                  and (
                      student_access_grants.plan_id is distinct from case
                          when memberships.source = 'public_signup' then trial_plan.id
                          else memberships.plan_id
                      end
                      or student_access_grants.source is distinct from case
                          when memberships.source = 'public_signup' then 'public_signup'
                          else memberships.source
                      end
                  )
              )
          )
    ) then
        raise exception 'active_membership_grant_sync_mismatch';
    end if;
end;
$$;
