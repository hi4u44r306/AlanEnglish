-- 家長在週報信裡一鍵取消「每週學習週報」。
-- 只新增欄位、一張紀錄表與兩個函式，不改既有資料；函式只有 service_role（Edge Function）能執行。
--
-- 設計重點：
--   * 不使用 notification_enabled：它同時管付款失敗與到期提醒信，取消週報不該連帶關掉那些通知。
--   * 取消狀態放在專用欄位 weekly_report_opted_out_at；只有「取消」和「重新開啟」兩個動作會改它。
--   * 每次狀態改變都留一筆紀錄（誰、何時、從哪裡），重複點取消不會重複記錄。
--   * 重新開啟時 weekly_report_link_version + 1，舊信裡的取消連結隨之失效。
--
-- 回復方式：移除兩個函式、紀錄表與三個欄位即可（只有本功能使用）。

begin;

alter table public.guardian_contacts
    add column if not exists weekly_report_opted_out_at timestamptz,
    add column if not exists weekly_report_opted_out_source text
        check (weekly_report_opted_out_source in ('email_link', 'admin')),
    add column if not exists weekly_report_link_version integer not null default 1;

create table if not exists public.guardian_weekly_report_choices (
    id bigint generated always as identity primary key,
    student_id bigint not null references public.students(id) on delete cascade,
    guardian_contact_id bigint,
    choice text not null check (choice in ('opt_out', 're_enable')),
    source text not null check (source in ('email_link', 'admin')),
    actor_id bigint references public.students(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists guardian_weekly_report_choices_student_idx
    on public.guardian_weekly_report_choices (student_id, created_at desc);
create index if not exists guardian_weekly_report_choices_actor_idx
    on public.guardian_weekly_report_choices (actor_id)
    where actor_id is not null;

alter table public.guardian_weekly_report_choices enable row level security;
revoke all on table public.guardian_weekly_report_choices from public, anon, authenticated;
revoke all on sequence public.guardian_weekly_report_choices_id_seq from public, anon, authenticated;
grant select, insert on table public.guardian_weekly_report_choices to service_role;
grant usage, select on sequence public.guardian_weekly_report_choices_id_seq to service_role;

-- 取消：連結驗證通過後由 Edge Function 呼叫。已取消就什麼都不改。
create or replace function public.guardian_weekly_report_opt_out(
    p_student_id bigint,
    p_contact_id bigint,
    p_source text default 'email_link'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_changed integer;
begin
    if p_source not in ('email_link', 'admin') then
        raise exception 'invalid source';
    end if;

    update public.guardian_contacts
    set weekly_report_opted_out_at = now(),
        weekly_report_opted_out_source = p_source
    where id = p_contact_id
      and student_id = p_student_id
      and weekly_report_opted_out_at is null;
    get diagnostics v_changed = row_count;

    if v_changed = 0 then
        return jsonb_build_object('status', 'already');
    end if;

    insert into public.guardian_weekly_report_choices (student_id, guardian_contact_id, choice, source)
    values (p_student_id, p_contact_id, 'opt_out', p_source);
    return jsonb_build_object('status', 'opted_out');
end;
$$;

-- 重新開啟：老師或管理員在管理頁操作。連結版本 +1，舊信裡的取消連結失效。
create or replace function public.guardian_weekly_report_re_enable(
    p_student_id bigint,
    p_actor_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_contact_id bigint;
begin
    update public.guardian_contacts
    set weekly_report_opted_out_at = null,
        weekly_report_opted_out_source = null,
        weekly_report_link_version = weekly_report_link_version + 1
    where student_id = p_student_id
      and weekly_report_opted_out_at is not null
    returning id into v_contact_id;

    if v_contact_id is null then
        return jsonb_build_object('status', 'not_opted_out');
    end if;

    insert into public.guardian_weekly_report_choices (student_id, guardian_contact_id, choice, source, actor_id)
    values (p_student_id, v_contact_id, 're_enable', 'admin', p_actor_id);
    return jsonb_build_object('status', 're_enabled');
end;
$$;

revoke all on function public.guardian_weekly_report_opt_out(bigint, bigint, text) from public, anon, authenticated;
revoke all on function public.guardian_weekly_report_re_enable(bigint, bigint) from public, anon, authenticated;
grant execute on function public.guardian_weekly_report_opt_out(bigint, bigint, text) to service_role;
grant execute on function public.guardian_weekly_report_re_enable(bigint, bigint) to service_role;

commit;
