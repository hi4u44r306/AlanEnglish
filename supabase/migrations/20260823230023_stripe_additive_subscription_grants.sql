-- Store Stripe subscription state on the additive grant itself. This keeps an
-- AI add-on independent from the student's base membership and academy access.

alter table public.student_access_grants
    add column if not exists stripe_customer_id text,
    add column if not exists stripe_subscription_id text,
    add column if not exists stripe_checkout_session_id text,
    add column if not exists stripe_subscription_status text,
    add column if not exists current_period_end timestamptz,
    add column if not exists cancel_at_period_end boolean not null default false,
    add column if not exists last_payment_at timestamptz;

comment on column public.student_access_grants.stripe_subscription_id is
    'Stripe subscription that owns this additive access grant.';

comment on column public.student_access_grants.current_period_end is
    'Latest Stripe billing-period end. The grant ends_at follows this value.';

create unique index if not exists student_access_grants_stripe_subscription_key
    on public.student_access_grants (stripe_subscription_id);

create unique index if not exists student_access_grants_stripe_checkout_session_key
    on public.student_access_grants (stripe_checkout_session_id);

create index if not exists student_access_grants_stripe_customer_idx
    on public.student_access_grants (stripe_customer_id)
    where stripe_customer_id is not null;

alter table public.payment_transactions
    add column if not exists access_grant_id bigint;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.payment_transactions'::regclass
          and conname = 'payment_transactions_access_grant_id_fkey'
    ) then
        alter table public.payment_transactions
            add constraint payment_transactions_access_grant_id_fkey
            foreign key (access_grant_id)
            references public.student_access_grants(id)
            on delete set null;
    end if;
end;
$$;

create index if not exists payment_transactions_access_grant_idx
    on public.payment_transactions (access_grant_id, occurred_at desc)
    where access_grant_id is not null;

-- Public signups historically used the all-access plan while their membership
-- status said trialing. Point only non-Stripe trial history at the dedicated
-- trial plan so its 7-use AI allowance can be enforced consistently. The
-- existing membership-to-grant trigger keeps the additive ledger in sync.
update public.memberships as memberships
set plan_id = trial_plan.id,
    updated_at = now()
from public.subscription_plans as trial_plan
where trial_plan.code = 'trial_7_day'
  and memberships.source = 'public_signup'
  and memberships.status in ('pending_verification', 'trialing', 'expired')
  and memberships.plan_id is distinct from trial_plan.id;
