-- A free-trial learner becomes a regular textbook customer after a paid
-- basic membership or material purchase is confirmed. Keep academy learners
-- unchanged because their current/previous enrollment is a separate identity.

create or replace function public.promote_paid_membership_learner_type()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.plan_id is null
       or new.student_id is null
       or not (
           new.status in ('active', 'complimentary')
           or new.last_payment_at is not null
       ) then
        return new;
    end if;

    update public.students as students
    set learner_type = 'textbook_customer',
        updated_at = now()
    where students.id = new.student_id
      and students.role = 'student'
      and students.learner_type = 'trial_user'
      and exists (
          select 1
          from public.subscription_plans as plans
          where plans.id = new.plan_id
            and plans.code = 'basic_membership_monthly'
      );

    return new;
end;
$$;

revoke all on function public.promote_paid_membership_learner_type()
    from public, anon, authenticated;
grant execute on function public.promote_paid_membership_learner_type()
    to service_role;

drop trigger if exists memberships_promote_paid_trial_user
    on public.memberships;

create trigger memberships_promote_paid_trial_user
after insert or update of student_id, plan_id, status, last_payment_at
on public.memberships
for each row
when (
    new.status in ('active', 'complimentary')
    or new.last_payment_at is not null
)
execute function public.promote_paid_membership_learner_type();

create or replace function public.promote_paid_material_learner_type()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.status <> 'paid' then
        return new;
    end if;

    update public.students as students
    set learner_type = 'textbook_customer',
        updated_at = now()
    where students.id = new.student_id
      and students.role = 'student'
      and students.learner_type = 'trial_user';

    return new;
end;
$$;

revoke all on function public.promote_paid_material_learner_type()
    from public, anon, authenticated;
grant execute on function public.promote_paid_material_learner_type()
    to service_role;

drop trigger if exists material_purchases_promote_paid_trial_user
    on public.material_purchases;

create trigger material_purchases_promote_paid_trial_user
after insert or update of student_id, status
on public.material_purchases
for each row
when (new.status = 'paid')
execute function public.promote_paid_material_learner_type();

-- Repair existing rows without targeting an account name or overwriting
-- academy/textbook identities.
update public.students as students
set learner_type = 'textbook_customer',
    updated_at = now()
where students.role = 'student'
  and students.learner_type = 'trial_user'
  and (
      exists (
          select 1
          from public.memberships as memberships
          join public.subscription_plans as plans
            on plans.id = memberships.plan_id
          where memberships.student_id = students.id
            and plans.code = 'basic_membership_monthly'
            and (
                memberships.status in ('active', 'complimentary')
                or memberships.last_payment_at is not null
            )
      )
      or exists (
          select 1
          from public.material_purchases as purchases
          where purchases.student_id = students.id
            and purchases.status = 'paid'
      )
  );

do $$
begin
    if exists (
        select 1
        from public.students as students
        where students.role = 'student'
          and students.learner_type = 'trial_user'
          and (
              exists (
                  select 1
                  from public.memberships as memberships
                  join public.subscription_plans as plans
                    on plans.id = memberships.plan_id
                  where memberships.student_id = students.id
                    and plans.code = 'basic_membership_monthly'
                    and (
                        memberships.status in ('active', 'complimentary')
                        or memberships.last_payment_at is not null
                    )
              )
              or exists (
                  select 1
                  from public.material_purchases as purchases
                  where purchases.student_id = students.id
                    and purchases.status = 'paid'
              )
          )
    ) then
        raise exception 'paid_trial_member_identity_promotion_failed';
    end if;
end;
$$;
