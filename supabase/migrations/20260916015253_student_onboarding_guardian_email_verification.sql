begin;

alter table public.students
    add column if not exists onboarding_required boolean not null default false,
    add column if not exists onboarding_completed_at timestamptz;

comment on column public.students.onboarding_required is
    'True while a newly issued academy login must finish password, birthday, and verified guardian email setup.';
comment on column public.students.onboarding_completed_at is
    'When the required first-login profile setup was completed.';

alter table public.guardian_contacts
    add column if not exists email_verified_at timestamptz;

comment on column public.guardian_contacts.email_verified_at is
    'When the current guardian email was verified. A replacement email must not overwrite email until verification succeeds.';

-- Existing guardian emails were already used by the live notification and
-- checkout flows before verification state existed. Preserve that behaviour
-- instead of unexpectedly locking current families out.
update public.guardian_contacts
set email_verified_at = coalesce(updated_at, created_at, now())
where email is not null
  and email_verified_at is null;

create table if not exists public.guardian_email_verification_requests (
    id bigint generated always as identity primary key,
    student_id bigint not null references public.students(id) on delete cascade,
    pending_email text not null,
    code_hash text not null,
    status text not null default 'pending',
    attempts smallint not null default 0,
    expires_at timestamptz not null,
    requested_at timestamptz not null default now(),
    sent_at timestamptz,
    verified_at timestamptz,
    constraint guardian_email_verification_email_check
        check (
            char_length(pending_email) between 3 and 320
            and pending_email = lower(btrim(pending_email))
            and pending_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        ),
    constraint guardian_email_verification_hash_check
        check (char_length(code_hash) = 64 and code_hash ~ '^[0-9a-f]{64}$'),
    constraint guardian_email_verification_status_check
        check (status in ('pending', 'sent', 'verified', 'failed', 'expired')),
    constraint guardian_email_verification_attempts_check
        check (attempts between 0 and 5),
    constraint guardian_email_verification_expiry_check
        check (expires_at > requested_at)
);

comment on table public.guardian_email_verification_requests is
    'Server-only one-time guardian email verification requests. Stores only a keyed code hash, never the plaintext code.';

create index if not exists guardian_email_verification_student_requested_idx
    on public.guardian_email_verification_requests (student_id, requested_at desc);

create index if not exists guardian_email_verification_active_idx
    on public.guardian_email_verification_requests (student_id, expires_at desc)
    where status in ('pending', 'sent');

alter table public.guardian_email_verification_requests enable row level security;
revoke all on table public.guardian_email_verification_requests from public, anon, authenticated;
revoke all on sequence public.guardian_email_verification_requests_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.guardian_email_verification_requests to service_role;
grant usage, select on sequence public.guardian_email_verification_requests_id_seq to service_role;

create or replace function public.enforce_student_first_login_state()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
    if new.role = 'student'
       and new.learner_type = 'academy_student'
       and new.authentication_method = 'academy_username'
       and new.must_change_password = true
       and new.onboarding_completed_at is null then
        new.onboarding_required := true;
    end if;

    if new.onboarding_completed_at is not null then
        new.onboarding_required := false;
    end if;

    return new;
end;
$$;

revoke all on function public.enforce_student_first_login_state() from public, anon, authenticated;

drop trigger if exists students_first_login_state_trigger on public.students;
create trigger students_first_login_state_trigger
before insert or update of role, learner_type, authentication_method, must_change_password, onboarding_completed_at
on public.students
for each row
execute function public.enforce_student_first_login_state();

create or replace function public.prevent_student_birth_date_change()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
    if old.date_of_birth is not null
       and new.date_of_birth is distinct from old.date_of_birth then
        raise exception using
            errcode = '23514',
            message = 'student_date_of_birth_is_immutable';
    end if;
    return new;
end;
$$;

revoke all on function public.prevent_student_birth_date_change() from public, anon, authenticated;

drop trigger if exists students_birth_date_immutable_trigger on public.students;
create trigger students_birth_date_immutable_trigger
before update of date_of_birth on public.students
for each row
execute function public.prevent_student_birth_date_change();

create or replace function public.complete_student_onboarding_if_ready(
    p_student_id bigint
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_student public.students%rowtype;
    v_guardian_verified boolean := false;
begin
    select * into v_student
    from public.students
    where id = p_student_id
      and role = 'student'
    for update;

    if v_student.id is null then
        raise exception using errcode = 'P0002', message = 'student_not_found';
    end if;

    select exists (
        select 1
        from public.guardian_contacts
        where student_id = v_student.id
          and email is not null
          and email_verified_at is not null
    ) into v_guardian_verified;

    if v_student.onboarding_required
       and not v_student.must_change_password
       and v_student.date_of_birth is not null
       and v_guardian_verified then
        update public.students
        set onboarding_required = false,
            onboarding_completed_at = coalesce(onboarding_completed_at, now()),
            updated_at = now()
        where id = v_student.id
        returning * into v_student;
    end if;

    return jsonb_build_object(
        'required', v_student.onboarding_required,
        'completed_at', v_student.onboarding_completed_at,
        'password_complete', not v_student.must_change_password,
        'birthday_complete', v_student.date_of_birth is not null,
        'guardian_email_complete', v_guardian_verified
    );
end;
$$;

revoke all on function public.complete_student_onboarding_if_ready(bigint)
from public, anon, authenticated;
grant execute on function public.complete_student_onboarding_if_ready(bigint) to service_role;

create or replace function public.set_student_birth_date_once(
    p_student_id bigint,
    p_firebase_uid text,
    p_date_of_birth date
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_student public.students%rowtype;
    v_onboarding jsonb;
begin
    if p_date_of_birth is null
       or p_date_of_birth > current_date
       or p_date_of_birth < date '1900-01-01' then
        raise exception using errcode = '22023', message = 'invalid_date_of_birth';
    end if;

    select * into v_student
    from public.students
    where id = p_student_id
      and firebase_uid = btrim(coalesce(p_firebase_uid, ''))
      and role = 'student'
    for update;

    if v_student.id is null then
        raise exception using errcode = '42501', message = 'student_identity_mismatch';
    end if;

    if v_student.date_of_birth is not null
       and v_student.date_of_birth is distinct from p_date_of_birth then
        raise exception using errcode = '23514', message = 'student_date_of_birth_is_immutable';
    end if;

    if v_student.date_of_birth is null then
        update public.students
        set date_of_birth = p_date_of_birth,
            updated_at = now()
        where id = v_student.id;
    end if;

    v_onboarding := public.complete_student_onboarding_if_ready(v_student.id);
    return jsonb_build_object(
        'date_of_birth', p_date_of_birth,
        'onboarding', v_onboarding
    );
end;
$$;

revoke all on function public.set_student_birth_date_once(bigint, text, date)
from public, anon, authenticated;
grant execute on function public.set_student_birth_date_once(bigint, text, date) to service_role;

create or replace function public.confirm_guardian_email_verification(
    p_student_id bigint,
    p_firebase_uid text,
    p_request_id bigint,
    p_code_hash text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_student public.students%rowtype;
    v_request public.guardian_email_verification_requests%rowtype;
    v_attempts smallint;
    v_onboarding jsonb;
begin
    select * into v_student
    from public.students
    where id = p_student_id
      and firebase_uid = btrim(coalesce(p_firebase_uid, ''))
      and role = 'student'
    for update;

    if v_student.id is null then
        raise exception using errcode = '42501', message = 'student_identity_mismatch';
    end if;

    select * into v_request
    from public.guardian_email_verification_requests
    where id = p_request_id
      and student_id = v_student.id
    for update;

    if v_request.id is null then
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

    insert into public.guardian_contacts (
        student_id,
        email,
        preferred_channel,
        notification_enabled,
        email_verified_at,
        updated_at
    ) values (
        v_student.id,
        v_request.pending_email,
        'email',
        true,
        now(),
        now()
    )
    on conflict (student_id) do update
    set email = excluded.email,
        preferred_channel = 'email',
        notification_enabled = true,
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

    v_onboarding := public.complete_student_onboarding_if_ready(v_student.id);
    return jsonb_build_object(
        'verified', true,
        'guardian_email', v_request.pending_email,
        'onboarding', v_onboarding
    );
end;
$$;

revoke all on function public.confirm_guardian_email_verification(bigint, text, bigint, text)
from public, anon, authenticated;
grant execute on function public.confirm_guardian_email_verification(bigint, text, bigint, text) to service_role;

create or replace function public.mark_academy_student_password_changed(
    p_firebase_uid text,
    p_changed_at timestamptz default now()
) returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_student_id bigint;
begin
    if btrim(coalesce(p_firebase_uid, '')) = '' then
        raise exception using errcode = '22023', message = 'invalid_firebase_uid';
    end if;

    update public.students
    set must_change_password = false,
        password_changed_at = coalesce(p_changed_at, now()),
        updated_at = now()
    where firebase_uid = btrim(p_firebase_uid)
      and role = 'student'
    returning id into v_student_id;

    if v_student_id is null then
        raise exception using errcode = 'P0002', message = 'student_not_found';
    end if;

    perform public.complete_student_onboarding_if_ready(v_student_id);
    return v_student_id;
end;
$$;

revoke all on function public.mark_academy_student_password_changed(text, timestamptz)
from public, anon, authenticated;
grant execute on function public.mark_academy_student_password_changed(text, timestamptz) to service_role;

commit;
