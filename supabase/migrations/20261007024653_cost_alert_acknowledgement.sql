-- Additive, service-only cost reminders. No student or learning data is changed.
begin;

create table public.api_cost_notification_settings (
    id smallint primary key default 1 check (id = 1),
    recipient_student_id bigint references public.students(id),
    updated_at timestamptz not null default now()
);
insert into public.api_cost_notification_settings(id) values (1);

create table public.api_cost_alerts (
    id uuid primary key default gen_random_uuid(),
    recipient_student_id bigint not null references public.students(id),
    month date not null,
    level text not null check (level in ('warning', 'critical')),
    generation integer not null default 1,
    cost_usd numeric not null check (cost_usd >= 0),
    monthly_budget_usd numeric not null check (monthly_budget_usd > 0),
    warning_percent integer not null check (warning_percent between 50 and 100),
    created_at timestamptz not null default now(),
    acknowledged_at timestamptz,
    next_attempt_at timestamptz not null default now(),
    delivery_token uuid,
    last_attempt_at timestamptz,
    last_sent_at timestamptz,
    attempt_count integer not null default 0,
    last_error text,
    unique (recipient_student_id, month)
);
create index api_cost_alerts_due_idx on public.api_cost_alerts(next_attempt_at)
    where acknowledged_at is null;
alter table public.api_cost_notification_settings enable row level security;
alter table public.api_cost_alerts enable row level security;
revoke all on public.api_cost_notification_settings, public.api_cost_alerts from public, anon, authenticated;
grant select, insert, update on public.api_cost_notification_settings, public.api_cost_alerts to service_role;

-- Keep the same tracked cost scope/rates as generate-ai-material/cost_dashboard.
-- SUM operates on all rows, unlike the dashboard's bounded detail list.
create function public.reconcile_api_cost_alert_v1() returns void
language plpgsql set search_path = public, pg_temp as $$
declare
    v_month date := date_trunc('month', now() at time zone 'Asia/Taipei')::date;
    v_start timestamptz;
    v_end timestamptz;
    v_recipient bigint;
    v_budget public.ai_api_budget_settings%rowtype;
    v_cost numeric;
    v_level text;
begin
    select c.recipient_student_id into v_recipient
    from public.api_cost_notification_settings c join public.students s on s.id=c.recipient_student_id
    where c.id=1 and s.role='admin' and coalesce(s.account_status,'active')='active';
    if v_recipient is null then return; end if;
    select * into v_budget from public.ai_api_budget_settings where id=1;
    if not found or v_budget.monthly_budget_usd <= 0 then
        raise exception 'Cost budget unavailable';
    end if;
    v_start := v_month::timestamp at time zone 'Asia/Taipei';
    v_end := (v_month + interval '1 month')::timestamp at time zone 'Asia/Taipei';
    select round(sum(cost),8) into v_cost from (
        select coalesce(sum(estimated_cost_usd),0) cost from public.ai_api_usage_logs where created_at >= v_start and created_at < v_end
        union all select coalesce(sum(coalesce(input_tokens,0)*0.25 + coalesce(output_tokens,0)*2),0)/1000000 from public.speaking_generation_jobs where created_at >= v_start and created_at < v_end
        union all select coalesce(sum(coalesce(input_tokens,0)*0.25 + coalesce(output_tokens,0)*2),0)/1000000 from public.speaking_source_chunks where created_at >= v_start and created_at < v_end
        union all select coalesce(sum(used_characters),0)*30/1000000 from public.speaking_tts_assets where created_at >= v_start and created_at < v_end
    ) costs;
    -- Compare unrounded percentages so values just below the line do not alert.
    if v_cost*100 < v_budget.monthly_budget_usd*v_budget.warning_percent then return; end if;
    v_level := case when v_cost >= v_budget.monthly_budget_usd then 'critical' else 'warning' end;
    insert into public.api_cost_alerts as a(recipient_student_id,month,level,cost_usd,monthly_budget_usd,warning_percent)
    values(v_recipient,v_month,v_level,v_cost,v_budget.monthly_budget_usd,v_budget.warning_percent)
    on conflict(recipient_student_id,month) do update set
        cost_usd=excluded.cost_usd, monthly_budget_usd=excluded.monthly_budget_usd, warning_percent=excluded.warning_percent,
        -- Acknowledgement covers the entire month, including later budget overruns.
        -- Updating the displayed severity must never rearm or unlock a delivery.
        level=case when a.level='critical' then a.level else excluded.level end;
end;
$$;

-- Atomic claim plus a five-minute slot prevents duplicate sends by overlapping workers.
create function public.claim_api_cost_alerts_v1() returns setof public.api_cost_alerts
language sql set search_path = public, pg_temp as $$
    update public.api_cost_alerts a set
        delivery_token=gen_random_uuid(), last_attempt_at=now(), attempt_count=a.attempt_count+1,
        next_attempt_at=date_bin(interval '5 minutes',now(),'2000-01-01'::timestamptz)+interval '5 minutes'
    from (
        select a.id from public.api_cost_alerts a
        join public.api_cost_notification_settings c on c.id=1 and c.recipient_student_id=a.recipient_student_id
        join public.students s on s.id=a.recipient_student_id
        where a.acknowledged_at is null and a.next_attempt_at <= now()
          and s.role='admin' and coalesce(s.account_status,'active')='active'
        order by a.next_attempt_at limit 12 for update of a skip locked
    ) due where a.id=due.id returning a.*;
$$;

create function public.acknowledge_api_cost_alert_v1(p_alert_id uuid,p_student_id bigint,p_generation integer)
returns boolean language plpgsql set search_path = public, pg_temp as $$
begin
    update public.api_cost_alerts a set acknowledged_at=coalesce(a.acknowledged_at,now()), delivery_token=null
    where a.id=p_alert_id and a.recipient_student_id=p_student_id and a.generation=p_generation
      and exists(select 1 from public.students s where s.id=p_student_id and s.role='admin' and coalesce(s.account_status,'active')='active');
    return found;
end;
$$;
revoke all on function public.reconcile_api_cost_alert_v1(), public.claim_api_cost_alerts_v1(), public.acknowledge_api_cost_alert_v1(uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.reconcile_api_cost_alert_v1(), public.claim_api_cost_alerts_v1(), public.acknowledge_api_cost_alert_v1(uuid,bigint,integer) to service_role;

-- Reuse the existing Vault cron credential. Never copy it into source or job text.
do $$
begin
    if not exists(select 1 from vault.secrets where name='guardian_email_project_url')
       or not exists(select 1 from vault.secrets where name='guardian_email_cron_secret') then
        raise exception 'Existing guardian cron Vault configuration is required';
    end if;
end;
$$;
select cron.schedule('alan-english-api-cost-alerts','*/5 * * * *',$job$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='guardian_email_project_url') || '/functions/v1/cost-alert-manager',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='guardian_email_cron_secret')),
        body := '{"action":"run_due"}'::jsonb,
        timeout_milliseconds := 60000
    );
$job$);
commit;
