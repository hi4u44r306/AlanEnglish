-- Security before launch: outstanding guardian password-reset links are revoked when
--   (1) the guardian email changes by ANY path: admin_set_guardian_email_v1 (admin change),
--       confirm_guardian_email_verification (guardian-verified change) and direct service-role
--       updates of guardian_contacts.email (membership-manager only fills an empty email);
--       one AFTER UPDATE OF email trigger covers all of them, so those functions are not copied;
--   (2) an administrator issues a temporary password (admin_record_student_password_reset_v1,
--       copied from 20261104110000 with only the revoke added; same signature and grants).
-- Revoked tokens fail preview/reserve/complete (they all require revoked_at is null).
-- No rows are deleted. Safe to re-run.
--
-- Rollback:
--   drop trigger if exists guardian_contacts_revoke_reset_tokens on public.guardian_contacts;
--   drop function if exists private.ae_revoke_password_reset_tokens_on_email_change();
--   and re-run the function block of 20261104110000_admin_student_password_reset.sql (lines 35-92).

begin;

create schema if not exists private;

create or replace function private.ae_revoke_password_reset_tokens_on_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.academy_password_reset_tokens
    set revoked_at = now()
    where student_id = new.student_id
      and used_at is null
      and revoked_at is null;
    return null;
end;
$$;

revoke all on function private.ae_revoke_password_reset_tokens_on_email_change() from public, anon, authenticated;

drop trigger if exists guardian_contacts_revoke_reset_tokens on public.guardian_contacts;
create trigger guardian_contacts_revoke_reset_tokens
    after update of email on public.guardian_contacts
    for each row
    when (lower(btrim(coalesce(old.email, ''))) is distinct from lower(btrim(coalesce(new.email, ''))))
    execute function private.ae_revoke_password_reset_tokens_on_email_change();

create or replace function public.admin_record_student_password_reset_v1(
    p_admin_id bigint,
    p_student_id bigint,
    p_reason text,
    p_issued_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin public.students%rowtype;
    v_student public.students%rowtype;
    v_reason text := btrim(coalesce(p_reason, ''));
begin
    if char_length(v_reason) < 2 or char_length(v_reason) > 300 then
        return jsonb_build_object('status', 'invalid_reason');
    end if;

    select * into v_admin
    from public.students
    where id = p_admin_id
      and role = 'admin'
      and account_status = 'active';
    if not found then
        return jsonb_build_object('status', 'admin_required');
    end if;

    select * into v_student
    from public.students
    where id = p_student_id
      and role = 'student'
      and authentication_method = 'academy_username'
      and account_status = 'active'
      and activated_at is not null
    for update;
    if not found then
        return jsonb_build_object('status', 'student_not_found');
    end if;

    update public.students
    set must_change_password = true,
        temporary_password_issued_at = greatest(now(), coalesce(p_issued_at, now())),
        updated_at = now()
    where id = v_student.id;

    -- 管理員給了臨時密碼後，寄給家長的舊重設連結一律作廢。
    update public.academy_password_reset_tokens
    set revoked_at = now()
    where student_id = v_student.id
      and used_at is null
      and revoked_at is null;

    insert into public.academy_student_password_admin_resets (student_id, admin_id, reason)
    values (v_student.id, v_admin.id, v_reason);

    return jsonb_build_object('status', 'recorded', 'student_id', v_student.id);
end;
$$;

revoke all on function public.admin_record_student_password_reset_v1(bigint, bigint, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.admin_record_student_password_reset_v1(bigint, bigint, text, timestamptz)
to service_role;

commit;
