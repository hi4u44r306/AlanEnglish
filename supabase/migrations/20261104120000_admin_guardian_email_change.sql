-- 管理員直接更換學生的家長 Email（不需要驗證碼）。
--
-- 為什麼不要驗證碼：有些家庭離婚，信箱要從爸爸改掛媽媽，不可能叫爸爸去收驗證碼。
-- 管理員要先確認是家長本人要求更換（聯絡簿留言或電話），並寫下原因；系統記下是誰、改了什麼（只存遮蔽後的信箱）。
-- 管理員親自設定的信箱視為「已驗證」，也會留下記號（email_set_by_admin_id／email_set_by_admin_at，
-- 欄位由 20261104100000_guardian_password_reset.sql 新增），讓「寄重設連結到家長 Email」認得它。
--
-- 只新增資料表與函式，不改既有資料；函式只有 service_role（Edge Function）能執行。
-- 回復方式：移除稽核表與函式即可。

begin;

create table if not exists public.guardian_email_change_audit (
    id bigint generated always as identity primary key,
    student_id bigint not null references public.students(id) on delete cascade,
    admin_id bigint references public.students(id) on delete set null,
    event text not null check (event in ('changed')),
    previous_email_masked text,
    new_email_masked text not null,
    reason text not null,
    created_at timestamptz not null default now(),
    constraint guardian_email_change_audit_reason_check
        check (char_length(btrim(reason)) between 2 and 300)
);

create index if not exists guardian_email_change_audit_student_idx
    on public.guardian_email_change_audit (student_id, created_at desc);
create index if not exists guardian_email_change_audit_admin_idx
    on public.guardian_email_change_audit (admin_id);

alter table public.guardian_email_change_audit enable row level security;
revoke all on table public.guardian_email_change_audit from public, anon, authenticated;
revoke all on sequence public.guardian_email_change_audit_id_seq from public, anon, authenticated;
grant select, insert on table public.guardian_email_change_audit to service_role;
grant usage, select on sequence public.guardian_email_change_audit_id_seq to service_role;

create or replace function public.admin_set_guardian_email_v1(
    p_admin_id bigint,
    p_student_id bigint,
    p_new_email text,
    p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin public.students%rowtype;
    v_student public.students%rowtype;
    v_new text := lower(btrim(coalesce(p_new_email, '')));
    v_reason text := btrim(coalesce(p_reason, ''));
    v_previous text;
    v_onboarding jsonb;
begin
    select * into v_admin
    from public.students
    where id = p_admin_id
      and role = 'admin'
      and account_status = 'active';
    if not found then
        raise exception using errcode = '42501', message = 'admin_required';
    end if;

    if char_length(v_new) < 3
       or char_length(v_new) > 320
       or v_new !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        return jsonb_build_object('status', 'invalid_email');
    end if;

    if char_length(v_reason) < 2 or char_length(v_reason) > 300 then
        return jsonb_build_object('status', 'invalid_reason');
    end if;

    select * into v_student
    from public.students
    where id = p_student_id
      and role = 'student'
    for update;
    if not found then
        return jsonb_build_object('status', 'student_not_found');
    end if;

    select lower(btrim(email)) into v_previous
    from public.guardian_contacts
    where student_id = v_student.id;

    if v_previous is not null and v_previous = v_new then
        return jsonb_build_object('status', 'unchanged');
    end if;

    -- 只改信箱與驗證／設定記號；家長姓名、電話、通知設定維持原樣。
    insert into public.guardian_contacts (
        student_id, email, preferred_channel, notification_enabled,
        email_verified_at, email_set_by_admin_id, email_set_by_admin_at, updated_at
    ) values (
        v_student.id, v_new, 'email', true, now(), v_admin.id, now(), now()
    )
    on conflict (student_id) do update
    set email = excluded.email,
        email_verified_at = excluded.email_verified_at,
        email_set_by_admin_id = excluded.email_set_by_admin_id,
        email_set_by_admin_at = excluded.email_set_by_admin_at,
        updated_at = now();

    -- 學生自己還在進行中的舊驗證要求一律作廢，避免它之後又把信箱換回去。
    update public.guardian_email_verification_requests
    set status = 'expired'
    where student_id = v_student.id
      and status in ('pending', 'sent');

    insert into public.guardian_email_change_audit (
        student_id, admin_id, event, previous_email_masked, new_email_masked, reason
    ) values (
        v_student.id,
        v_admin.id,
        'changed',
        case when v_previous is null then null
             else left(split_part(v_previous, '@', 1), 1) || '***@' || split_part(v_previous, '@', 2) end,
        left(split_part(v_new, '@', 1), 1) || '***@' || split_part(v_new, '@', 2),
        v_reason
    );

    v_onboarding := public.complete_student_onboarding_if_ready(v_student.id);
    return jsonb_build_object(
        'status', 'changed',
        'new_email_masked', left(split_part(v_new, '@', 1), 1) || '***@' || split_part(v_new, '@', 2),
        'onboarding', v_onboarding
    );
end;
$$;

revoke all on function public.admin_set_guardian_email_v1(bigint, bigint, text, text)
from public, anon, authenticated;
grant execute on function public.admin_set_guardian_email_v1(bigint, bigint, text, text)
to service_role;

commit;
