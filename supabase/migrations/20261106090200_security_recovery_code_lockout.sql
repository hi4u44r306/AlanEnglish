-- Security before launch: login-card recovery codes.
--
-- Changes to public.reserve_academy_student_recovery_code (copied from
-- 20260909090000_secure_academy_recovery_codes.sql, the only definition; same signature):
--   1. Only role = 'student' accounts can use a recovery code. Teacher/admin passwords must be
--      reset by an administrator. Existing codes held by staff are NOT deleted; they simply stop
--      working.
--   2. Cumulative lockout: besides 5 failures per hour, 20 failures within 30 days lock the
--      account's recovery codes. Failures before the newest issued code or the last successful
--      recovery do not count, so an admin re-issuing a login card clears the lock.
--   3. A locked (rate-limited) account returns exactly the same {"status":"invalid"} as a missing
--      account or a wrong code, so the endpoint no longer reveals which usernames exist.
--      The Edge handler maps "invalid" to 404 RECOVERY_NOT_FOUND; its 429 branch becomes unused.
-- No data is modified. Execute grants are restated exactly as in the original.
-- Safe to re-run (create or replace).
--
-- Rollback: re-run the create or replace function block of
-- 20260909090000_secure_academy_recovery_codes.sql (lines 24-98) and its grants.

begin;

create or replace function public.reserve_academy_student_recovery_code(
    p_username text,
    p_code_hash char(64),
    p_reservation_hash char(64)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student public.students%rowtype;
    v_code_id bigint;
    v_failed_attempts integer;
    v_lock_window_start timestamptz;
begin
    select * into v_student
    from public.students
    where lower(btrim(login_username)) = lower(btrim(coalesce(p_username, '')))
      and authentication_method = 'academy_username'
      and account_status = 'active'
      and role = 'student'
    for update;

    if not found then
        return jsonb_build_object('status', 'invalid');
    end if;

    select count(*)::integer into v_failed_attempts
    from public.academy_student_recovery_attempts
    where student_id = v_student.id
      and outcome = 'failed'
      and attempted_at >= now() - interval '1 hour';

    -- Same response as a missing account: no username enumeration through the limiter.
    if v_failed_attempts >= 5 then
        return jsonb_build_object('status', 'invalid');
    end if;

    select greatest(
        now() - interval '30 days',
        (select max(a.attempted_at) from public.academy_student_recovery_attempts a
          where a.student_id = v_student.id and a.outcome = 'succeeded'),
        (select max(c.created_at) from public.academy_student_recovery_codes c
          where c.student_id = v_student.id)
    ) into v_lock_window_start;

    select count(*)::integer into v_failed_attempts
    from public.academy_student_recovery_attempts
    where student_id = v_student.id
      and outcome = 'failed'
      and attempted_at >= v_lock_window_start;

    if v_failed_attempts >= 20 then
        return jsonb_build_object('status', 'invalid');
    end if;

    select id into v_code_id
    from public.academy_student_recovery_codes
    where student_id = v_student.id
      and code_hash = p_code_hash
      and used_at is null
      and revoked_at is null
      and (reservation_expires_at is null or reservation_expires_at <= now())
    for update;

    if not found then
        insert into public.academy_student_recovery_attempts (student_id, outcome)
        values (v_student.id, 'failed');
        return jsonb_build_object('status', 'invalid');
    end if;

    update public.academy_student_recovery_codes
    set reservation_hash = p_reservation_hash,
        reservation_expires_at = now() + interval '5 minutes'
    where id = v_code_id
      and used_at is null
      and revoked_at is null
      and (reservation_expires_at is null or reservation_expires_at <= now());

    if not found then
        insert into public.academy_student_recovery_attempts (student_id, outcome)
        values (v_student.id, 'failed');
        return jsonb_build_object('status', 'invalid');
    end if;

    return jsonb_build_object(
        'status', 'reserved',
        'student_id', v_student.id,
        'firebase_uid', v_student.firebase_uid,
        'username', v_student.login_username,
        'code_id', v_code_id,
        'reservation_hash', p_reservation_hash
    );
end;
$$;

revoke all on function public.reserve_academy_student_recovery_code(text, char(64), char(64)) from public, anon, authenticated;
grant execute on function public.reserve_academy_student_recovery_code(text, char(64), char(64)) to service_role;

commit;
