begin;

-- Additive birthday settings only; existing reward functions are unchanged.
create table public.birthday_reward_settings (
    singleton boolean primary key default true check (singleton),
    enabled boolean not null default true,
    gift_points integer not null default 100 check (gift_points between 0 and 10000),
    version integer not null default 1,
    updated_by bigint references public.students(id),
    updated_at timestamptz not null default now()
);
insert into public.birthday_reward_settings(singleton) values (true);
create table public.birthday_reward_settings_history (
    id bigint generated always as identity primary key,
    admin_id bigint not null references public.students(id),
    previous_settings jsonb not null,
    new_settings jsonb not null,
    created_at timestamptz not null default now()
);
create index birthday_reward_settings_history_admin_idx on public.birthday_reward_settings_history(admin_id);
alter table public.birthday_reward_settings enable row level security;
alter table public.birthday_reward_settings_history enable row level security;
revoke all on public.birthday_reward_settings, public.birthday_reward_settings_history from public,anon,authenticated;
grant select,insert,update on public.birthday_reward_settings to service_role;
grant select,insert on public.birthday_reward_settings_history to service_role;
grant usage,select on sequence public.birthday_reward_settings_history_id_seq to service_role;

create or replace function private.ae_birthday_month_eligible(p_student_id bigint,p_at timestamptz default now())
returns boolean language sql stable security invoker set search_path = '' as $$
    select exists (
        select 1 from public.students s where s.id=p_student_id and s.role='student'
        and s.archived_at is null and coalesce(s.account_status,'active')='active'
        and s.date_of_birth <= (p_at at time zone 'Asia/Taipei')::date
        and extract(month from s.date_of_birth)=extract(month from p_at at time zone 'Asia/Taipei')
        and (public.get_student_effective_access(s.id,p_at)->>'is_active')::boolean is true
    );
$$;
revoke all on function private.ae_birthday_month_eligible(bigint,timestamptz) from public,anon,authenticated;
grant execute on function private.ae_birthday_month_eligible(bigint,timestamptz) to service_role;

create or replace function public.save_birthday_reward_settings_v1(
    p_admin_id bigint,p_gift_points integer,p_enabled boolean,p_expected_version integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    v_old public.birthday_reward_settings%rowtype;
    v_new public.birthday_reward_settings%rowtype;
begin
    if not exists(select 1 from public.students where id=p_admin_id and role='admin'
        and archived_at is null and coalesce(account_status,'active')='active') then
        raise exception 'BIRTHDAY_ADMIN_REQUIRED';
    end if;
    if p_gift_points is null or p_gift_points<0 or p_gift_points>10000 or p_enabled is null then
        raise exception 'INVALID_BIRTHDAY_SETTINGS';
    end if;
    select * into strict v_old from public.birthday_reward_settings where singleton for update;
    if p_expected_version is distinct from v_old.version then raise exception 'BIRTHDAY_SETTINGS_CHANGED'; end if;
    update public.birthday_reward_settings set gift_points=p_gift_points,enabled=p_enabled,
        version=version+1,updated_by=p_admin_id,updated_at=now()
        where singleton returning * into v_new;
    insert into public.birthday_reward_settings_history(admin_id,previous_settings,new_settings)
        values(p_admin_id,to_jsonb(v_old),to_jsonb(v_new));
    return to_jsonb(v_new);
end;
$$;
revoke all on function public.save_birthday_reward_settings_v1(bigint,integer,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_birthday_reward_settings_v1(bigint,integer,boolean,integer) to service_role;

-- Only the Firebase-authenticated Edge Function calls this service-only RPC.
-- Existing grant_v2 provides atomic balance updates and yearly ledger deduplication.
create or replace function public.claim_student_birthday_reward_v1(p_student_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    v_day date := (now() at time zone 'Asia/Taipei')::date;
    v_key text := concat('year:',extract(year from v_day)::integer);
    v_settings public.birthday_reward_settings%rowtype;
    v_month boolean;
    v_points_eligible boolean;
    v_granted boolean := false;
    v_gift integer;
begin
    select * into strict v_settings from public.birthday_reward_settings where singleton for share;
    v_month := private.ae_birthday_month_eligible(p_student_id);
    v_points_eligible := v_month and private.ae_student_can_earn_points(p_student_id);
    if v_settings.enabled and v_points_eligible and v_settings.gift_points>0 then
        v_granted := private.ae_gamification_grant_v2(p_student_id,0,v_settings.gift_points,
            'birthday_gift',v_key,'生日月禮物',jsonb_build_object('reward_year',extract(year from v_day)::integer,
                'settings_version',v_settings.version));
    end if;
    select points_delta into v_gift from public.student_gamification_ledger
        where student_id=p_student_id and source_type='birthday_gift' and source_key=v_key;
    return jsonb_build_object(
        'evaluated_on',v_day,'is_birthday_month',v_month,'enabled',v_settings.enabled,
        'starts_on',date_trunc('month',v_day::timestamp)::date,
        'ends_on',(date_trunc('month',v_day::timestamp)+interval '1 month - 1 day')::date,
        'gift_points',coalesce(v_gift,v_settings.gift_points),
        'gift_status',case when v_gift is not null then 'received'
            when not v_month then 'not_birthday_month'
            when not v_settings.enabled or v_settings.gift_points=0 then 'disabled'
            when not v_points_eligible then 'not_eligible' else 'pending' end,
        'just_granted',v_granted);
end;
$$;
revoke all on function public.claim_student_birthday_reward_v1(bigint) from public,anon,authenticated;
grant execute on function public.claim_student_birthday_reward_v1(bigint) to service_role;

commit;