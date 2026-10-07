-- Service-only snapshots contain aggregate costs/usage, never credentials or customer data.
begin;
create table public.cost_service_settings (
    provider_id text primary key,
    fixed_monthly_usd numeric check (fixed_monthly_usd between 0 and 1000000),
    enabled boolean not null default true,
    effective_month date not null default date_trunc('month',now() at time zone 'Asia/Taipei')::date,
    updated_at timestamptz not null default now()
);
insert into public.cost_service_settings(provider_id) values
 ('openai'),('google_tts'),('firebase'),('google_other'),('azure'),('supabase'),
 ('cloudflare_r2'),('cloudflare_workers'),('resend'),('stripe'),('github'),('netlify'),('domain'),('other');
create table public.cost_service_fixed_fees (
 provider_id text not null references public.cost_service_settings(provider_id),
 effective_month date not null check(extract(day from effective_month)=1),
 amount_usd numeric check(amount_usd between 0 and 1000000),
 primary key(provider_id,effective_month)
);
create table public.cost_service_snapshots (
    provider_id text not null references public.cost_service_settings(provider_id),
    month date not null check (extract(day from month)=1),
    cost_usd numeric, -- NULL is unknown; credits can produce a negative net amount.
    source text not null check (source in ('billing','usage','manual')),
    includes_fixed boolean not null default true,
    metrics jsonb not null default '[]',
    period_start timestamptz,
    period_end timestamptz,
    collected_at timestamptz,
    attempted_at timestamptz not null default now(),
    next_refresh_at timestamptz not null default now(),
    claim_token uuid,
    error_code text,
    primary key(provider_id,month)
);
create index cost_service_refresh_idx on public.cost_service_snapshots(next_refresh_at);
alter table public.cost_service_settings enable row level security;
alter table public.cost_service_fixed_fees enable row level security;
alter table public.cost_service_snapshots enable row level security;
revoke all on public.cost_service_settings,public.cost_service_fixed_fees,public.cost_service_snapshots from public,anon,authenticated;
grant select,insert,update on public.cost_service_settings,public.cost_service_fixed_fees,public.cost_service_snapshots to service_role;

create function public.claim_cost_service_refresh_v1(p_month date,p_providers text[])
returns setof public.cost_service_snapshots language plpgsql set search_path=public,pg_temp as $$
begin
 if extract(day from p_month)<>1 then raise exception 'Invalid month'; end if;
 insert into public.cost_service_snapshots(provider_id,month,source)
 select provider_id,p_month,'usage' from public.cost_service_settings
 where provider_id=any(p_providers) and enabled on conflict do nothing;
 return query update public.cost_service_snapshots a set
    claim_token=gen_random_uuid(),attempted_at=now(),next_refresh_at=now()+interval '5 minutes'
 from (select s.provider_id,s.month from public.cost_service_snapshots s
       join public.cost_service_settings c using(provider_id)
       where s.month=p_month and s.provider_id=any(p_providers) and c.enabled
         and s.next_refresh_at<=now() and s.source<>'manual'
       for update of s skip locked) due
 where a.provider_id=due.provider_id and a.month=due.month returning a.*;
end;
$$;

-- Every local ledger is aggregated without a UI row cap. Provider totals replace,
-- rather than add to, the same provider's local estimate to prevent double counting.
create function public.unified_cost_month_v1(p_month date) returns jsonb
language plpgsql set search_path=public,pg_temp as $$
declare v_start timestamptz; v_end timestamptz; v_rows jsonb; v_total numeric;
begin
 if extract(day from p_month)<>1 then raise exception 'Invalid month'; end if;
 v_start:=p_month::timestamp at time zone 'Asia/Taipei';
 v_end:=(p_month+interval '1 month')::timestamp at time zone 'Asia/Taipei';
 with local_cost as (
  select 'openai' id,
   (select coalesce(sum(estimated_cost_usd),0) from public.ai_api_usage_logs where created_at>=v_start and created_at<v_end)
   +(select coalesce(sum(coalesce(input_tokens,0)*0.25+coalesce(output_tokens,0)*2),0)/1000000 from public.speaking_generation_jobs where created_at>=v_start and created_at<v_end)
   +(select coalesce(sum(coalesce(input_tokens,0)*0.25+coalesce(output_tokens,0)*2),0)/1000000 from public.speaking_source_chunks where created_at>=v_start and created_at<v_end) cost
  union all select 'google_tts',coalesce(sum(used_characters),0)*30/1000000 from public.speaking_tts_assets where created_at>=v_start and created_at<v_end
  -- Same conservative $1/audio-hour basis as the released alphabet cost RPC.
  -- Reservations/failures included; browser-only local requests live in another table.
  union all select 'azure',coalesce(sum(audio_seconds),0)::numeric/3600 from public.speaking_pronunciation_requests
   where provider='azure_alphabet_basic' and created_at>=v_start and created_at<v_end
 ), usage as (
  select coalesce(sum(coalesce(audio_seconds,case when interaction_type in ('alphabet','alphabet_round') then 12 else 25 end)),0) seconds,
    count(*) requests from public.speaking_pronunciation_requests where created_at>=v_start and created_at<v_end and status<>'reserved'
 ), rows as (
  select c.provider_id,c.enabled,
   f.amount_usd fixed_monthly_usd,
   s.cost_usd reported_cost_usd,l.cost local_cost_usd,
   case when not c.enabled then null
     when s.cost_usd is not null then s.cost_usd+case when s.includes_fixed then 0 else coalesce(f.amount_usd,0) end
     else coalesce(l.cost,0)+coalesce(f.amount_usd,0) end known_cost_usd,
   (c.enabled and (s.cost_usd is null or (not s.includes_fixed and f.amount_usd is null))) incomplete,
   s.source,s.collected_at,s.attempted_at,s.next_refresh_at,s.error_code,s.period_start,s.period_end,
   case when c.provider_id='azure' then coalesce(s.metrics,'[]'::jsonb)||jsonb_build_array(
     jsonb_build_object('name','已結束錄音請求秒數（含失敗；非帳單）','used',u.seconds,'unit','秒','limit',null))
   when c.provider_id='supabase' and p_month=date_trunc('month',now() at time zone 'Asia/Taipei')::date then coalesce(s.metrics,'[]'::jsonb)||jsonb_build_array(
     jsonb_build_object('name','目前資料庫大小（非月計費量）','used',pg_database_size(current_database()),'unit','bytes','limit',null))
   else coalesce(s.metrics,'[]'::jsonb) end metrics
  from public.cost_service_settings c left join public.cost_service_snapshots s on s.provider_id=c.provider_id and s.month=p_month
  left join lateral (select amount_usd from public.cost_service_fixed_fees where provider_id=c.provider_id and effective_month<=p_month order by effective_month desc limit 1) f on true
  left join local_cost l on l.id=c.provider_id cross join usage u
 ) select jsonb_agg(to_jsonb(r) order by r.provider_id),coalesce(sum(known_cost_usd),0) into v_rows,v_total from rows r;
 return jsonb_build_object('month',p_month,'providers',v_rows,'total_cost_usd',round(v_total,8),'calculated_at',now());
end;
$$;
revoke all on function public.claim_cost_service_refresh_v1(date,text[]),public.unified_cost_month_v1(date) from public,anon,authenticated;
grant execute on function public.claim_cost_service_refresh_v1(date,text[]),public.unified_cost_month_v1(date) to service_role;

create function public.save_cost_service_v1(p_provider text,p_month date,p_fixed numeric,p_total numeric,p_enabled boolean)
returns void language plpgsql set search_path=public,pg_temp as $$
begin
 if extract(day from p_month)<>1 or p_fixed<0 or p_fixed>1000000 or p_total<0 or p_total>1000000 then raise exception 'Invalid cost setting'; end if;
 update public.cost_service_settings set fixed_monthly_usd=p_fixed,enabled=p_enabled,updated_at=now()
 where provider_id=p_provider;
 if not found then raise exception 'Unknown provider'; end if;
 insert into public.cost_service_fixed_fees(provider_id,effective_month,amount_usd)
 values(p_provider,date_trunc('month',now() at time zone 'Asia/Taipei')::date,p_fixed)
 on conflict(provider_id,effective_month) do update set amount_usd=excluded.amount_usd;
 if p_total is not null then
  insert into public.cost_service_snapshots(provider_id,month,cost_usd,source,collected_at)
  values(p_provider,p_month,p_total,'manual',now()) on conflict(provider_id,month) do update set
    cost_usd=excluded.cost_usd,source='manual',includes_fixed=true,collected_at=now(),error_code=null,claim_token=null;
 else
  update public.cost_service_snapshots set cost_usd=null,source='usage',collected_at=null,metrics='[]',error_code=null,claim_token=null,next_refresh_at=now()
  where provider_id=p_provider and month=p_month and source='manual';
 end if;
end;
$$;
revoke all on function public.save_cost_service_v1(text,date,numeric,numeric,boolean) from public,anon,authenticated;
grant execute on function public.save_cost_service_v1(text,date,numeric,numeric,boolean) to service_role;
-- Replaced below in this additive migration; acknowledgement/claim state is preserved.

create or replace function public.reconcile_api_cost_alert_v1() returns void
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
    v_cost := (public.unified_cost_month_v1(v_month)->>'total_cost_usd')::numeric;
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
commit;
