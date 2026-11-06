-- Security before launch: request_academy_guardian_password_reset counted recent requests first
-- and wrote the request row last, so parallel requests could all pass the 3-per-hour / 60-second
-- limits. Copied from 20261104100000_guardian_password_reset.sql (lines 72-168) with only
-- transaction advisory locks on the hashed username key (and the hashed source key) taken
-- before counting. Same signature; execute grants restated exactly as in the original.
-- Lock order is always username then source, and nothing else takes these keys, so no deadlock.
-- Safe to re-run (create or replace).
--
-- Rollback: re-run the function block of 20261104100000_guardian_password_reset.sql
-- (lines 72-168) and its grants.

begin;

create or replace function public.request_academy_guardian_password_reset(
    p_username text,
    p_username_hash char(64),
    p_source_hash char(64),
    p_token_hash char(64)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student public.students%rowtype;
    v_email text;
    v_recent_user integer;
    v_recent_source integer;
    v_last_user timestamptz;
begin
    -- 先鎖住同一個帳號雜湊（與來源雜湊）再計數，避免同時送出的要求都通過頻率限制。
    -- 鎖順序固定為「帳號 → 來源」，交易結束自動釋放。
    perform pg_advisory_xact_lock(hashtextextended('academy_password_reset:user:' || p_username_hash, 0));
    if p_source_hash is not null then
        perform pg_advisory_xact_lock(hashtextextended('academy_password_reset:source:' || p_source_hash, 0));
    end if;

    select count(*)::integer, max(requested_at) into v_recent_user, v_last_user
    from public.academy_password_reset_requests
    where username_hash = p_username_hash
      and requested_at >= now() - interval '1 hour';

    v_recent_source := 0;
    if p_source_hash is not null then
        select count(*)::integer into v_recent_source
        from public.academy_password_reset_requests
        where source_hash = p_source_hash
          and requested_at >= now() - interval '1 hour';
    end if;

    if v_recent_user >= 3
       or v_recent_source >= 20
       or (v_last_user is not null and v_last_user >= now() - interval '60 seconds') then
        insert into public.academy_password_reset_requests (username_hash, source_hash, outcome)
        values (p_username_hash, p_source_hash, 'rate_limited');
        return jsonb_build_object('status', 'rate_limited');
    end if;

    select * into v_student
    from public.students
    where lower(btrim(login_username)) = lower(btrim(coalesce(p_username, '')))
      and role = 'student'
      and authentication_method = 'academy_username'
      and account_status = 'active'
      and activated_at is not null
    for update;

    if found then
        select lower(btrim(g.email)) into v_email
        from public.guardian_contacts g
        where g.student_id = v_student.id
          and g.email is not null
          and g.email_verified_at is not null
          and (
              g.email_set_by_admin_at is not null
              or exists (
                  select 1
                  from public.guardian_email_verification_requests r
                  where r.student_id = v_student.id
                    and r.status = 'verified'
                    and r.pending_email = lower(btrim(g.email))
              )
          );
    end if;

    if v_email is null then
        insert into public.academy_password_reset_requests (username_hash, source_hash, student_id, outcome)
        values (p_username_hash, p_source_hash, case when found then v_student.id else null end, 'skipped');
        return jsonb_build_object('status', 'skipped');
    end if;

    update public.academy_password_reset_tokens
    set revoked_at = now()
    where student_id = v_student.id
      and used_at is null
      and revoked_at is null;

    insert into public.academy_password_reset_tokens (student_id, token_hash, sent_to_masked, expires_at)
    values (
        v_student.id,
        p_token_hash,
        left(split_part(v_email, '@', 1), 1) || '***@' || split_part(v_email, '@', 2),
        now() + interval '30 minutes'
    );

    insert into public.academy_password_reset_requests (username_hash, source_hash, student_id, outcome)
    values (p_username_hash, p_source_hash, v_student.id, 'sent');

    return jsonb_build_object(
        'status', 'send',
        'student_id', v_student.id,
        'student_name', coalesce(nullif(btrim(v_student.chinese_name), ''), v_student.name),
        'email', v_email
    );
end;
$$;

revoke all on function public.request_academy_guardian_password_reset(text, char(64), char(64), char(64)) from public, anon, authenticated;
grant execute on function public.request_academy_guardian_password_reset(text, char(64), char(64), char(64)) to service_role;

commit;
