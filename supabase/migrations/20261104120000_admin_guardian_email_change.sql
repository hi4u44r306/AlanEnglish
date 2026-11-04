-- 管理員更換學生的家長 Email：新信箱必須先收到驗證碼，家長把驗證碼告訴管理員，管理員輸入後才生效。
-- 驗證完成前，舊的家長 Email 維持有效；每次更換都留下稽核紀錄（只存遮蔽後的信箱）。
-- 只新增欄位、資料表與函式，不改既有資料；函式只有 service_role（Edge Function）能執行。
--
-- 回復方式：移除稽核表與函式即可；新欄位 requested_by_admin_id 可為 null，保留不影響舊程式。

begin;

alter table public.guardian_email_verification_requests
    add column if not exists requested_by_admin_id bigint references public.students(id) on delete set null;

comment on column public.guardian_email_verification_requests.requested_by_admin_id is
    '有值代表這是管理員替學生發起的家長 Email 更換；只有管理員版的確認函式能完成它。';

create index if not exists guardian_email_verification_admin_idx
    on public.guardian_email_verification_requests (requested_by_admin_id)
    where requested_by_admin_id is not null;

create table if not exists public.guardian_email_change_audit (
    id bigint generated always as identity primary key,
    student_id bigint not null references public.students(id) on delete cascade,
    admin_id bigint references public.students(id) on delete set null,
    event text not null check (event in ('requested', 'verified', 'failed')),
    previous_email_masked text,
    new_email_masked text,
    request_id bigint,
    created_at timestamptz not null default now()
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

create or replace function public.admin_confirm_guardian_email_verification_v1(
    p_admin_id bigint,
    p_student_id bigint,
    p_request_id bigint,
    p_code_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin public.students%rowtype;
    v_student public.students%rowtype;
    v_request public.guardian_email_verification_requests%rowtype;
    v_previous text;
    v_attempts smallint;
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

    select * into v_student
    from public.students
    where id = p_student_id
      and role = 'student'
    for update;
    if not found then
        return jsonb_build_object('verified', false, 'code', 'REQUEST_NOT_FOUND');
    end if;

    -- 只有「管理員發起」的要求才能由管理員確認；學生自己發起的不行。
    select * into v_request
    from public.guardian_email_verification_requests
    where id = p_request_id
      and student_id = v_student.id
      and requested_by_admin_id is not null
    for update;
    if not found then
        return jsonb_build_object('verified', false, 'code', 'REQUEST_NOT_FOUND');
    end if;

    if v_request.status = 'verified' then
        return jsonb_build_object('verified', true, 'already_verified', true);
    end if;

    if v_request.status <> 'sent' or v_request.expires_at <= now() then
        update public.guardian_email_verification_requests
        set status = case when status = 'verified' then status else 'expired' end
        where id = v_request.id;
        return jsonb_build_object('verified', false, 'code', 'CODE_EXPIRED');
    end if;

    if v_request.attempts >= 5 then
        update public.guardian_email_verification_requests
        set status = 'failed'
        where id = v_request.id;
        return jsonb_build_object('verified', false, 'code', 'TOO_MANY_ATTEMPTS');
    end if;

    if v_request.code_hash <> lower(btrim(coalesce(p_code_hash, ''))) then
        v_attempts := v_request.attempts + 1;
        update public.guardian_email_verification_requests
        set attempts = v_attempts,
            status = case when v_attempts >= 5 then 'failed' else status end
        where id = v_request.id;
        return jsonb_build_object(
            'verified', false,
            'code', case when v_attempts >= 5 then 'TOO_MANY_ATTEMPTS' else 'INVALID_CODE' end,
            'attempts_remaining', greatest(0, 5 - v_attempts)
        );
    end if;

    select lower(btrim(email)) into v_previous
    from public.guardian_contacts
    where student_id = v_student.id;

    -- 驗證成功才換信箱；其他欄位（姓名、電話、通知設定）維持原樣。
    insert into public.guardian_contacts (
        student_id, email, preferred_channel, notification_enabled, email_verified_at, updated_at
    ) values (
        v_student.id, v_request.pending_email, 'email', true, now(), now()
    )
    on conflict (student_id) do update
    set email = excluded.email,
        email_verified_at = excluded.email_verified_at,
        updated_at = now();

    update public.guardian_email_verification_requests
    set status = 'verified',
        verified_at = now()
    where id = v_request.id;

    update public.guardian_email_verification_requests
    set status = 'expired'
    where student_id = v_student.id
      and id <> v_request.id
      and status in ('pending', 'sent');

    insert into public.guardian_email_change_audit (
        student_id, admin_id, event, previous_email_masked, new_email_masked, request_id
    ) values (
        v_student.id,
        v_admin.id,
        'verified',
        case when v_previous is null then null
             else left(split_part(v_previous, '@', 1), 1) || '***@' || split_part(v_previous, '@', 2) end,
        left(split_part(v_request.pending_email, '@', 1), 1) || '***@' || split_part(v_request.pending_email, '@', 2),
        v_request.id
    );

    v_onboarding := public.complete_student_onboarding_if_ready(v_student.id);
    return jsonb_build_object(
        'verified', true,
        'guardian_email', v_request.pending_email,
        'onboarding', v_onboarding
    );
end;
$$;

revoke all on function public.admin_confirm_guardian_email_verification_v1(bigint, bigint, bigint, text)
from public, anon, authenticated;
grant execute on function public.admin_confirm_guardian_email_verification_v1(bigint, bigint, bigint, text)
to service_role;

commit;
