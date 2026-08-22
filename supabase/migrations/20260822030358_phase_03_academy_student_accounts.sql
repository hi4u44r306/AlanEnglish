begin;
alter table public.students
add column if not exists must_change_password boolean not null default false,
    add column if not exists temporary_password_issued_at timestamptz,
    add column if not exists password_changed_at timestamptz,
    add column if not exists account_created_by bigint;
comment on column public.students.must_change_password is 'True while the student must replace an administrator-issued temporary password.';
comment on column public.students.temporary_password_issued_at is 'When the latest temporary password was issued. The password itself is never stored.';
comment on column public.students.password_changed_at is 'When the student most recently completed the required password change.';
comment on column public.students.account_created_by is 'Alan English staff account that created this login record.';
do $$ begin if not exists (
    select 1
    from pg_constraint
    where conname = 'students_account_created_by_fkey'
        and conrelid = 'public.students'::regclass
) then
alter table public.students
add constraint students_account_created_by_fkey foreign key (account_created_by) references public.students(id) on delete
set null;
end if;
if not exists (
    select 1
    from pg_constraint
    where conname = 'students_password_change_state_check'
        and conrelid = 'public.students'::regclass
) then
alter table public.students
add constraint students_password_change_state_check check (
        must_change_password = false
        or temporary_password_issued_at is not null
    );
end if;
end;
$$;
create index if not exists students_account_created_by_idx on public.students(account_created_by)
where account_created_by is not null;
create index if not exists students_must_change_password_idx on public.students(id)
where role = 'student'
    and must_change_password = true;
do $$ begin if exists (
    select 1
    from public.students
    where email is not null
    group by lower(btrim(email))
    having count(*) > 1
) then raise exception using errcode = '23505',
message = 'students_duplicate_case_insensitive_email',
detail = 'Merge duplicate student emails before applying this migration.';
end if;
end;
$$;
create unique index if not exists students_login_email_lower_key on public.students(lower(btrim(email)))
where email is not null;
create or replace function public.create_academy_student_account_record(
        p_firebase_uid text,
        p_login_email text,
        p_chinese_name text,
        p_class_code text,
        p_created_by bigint,
        p_english_name text default null,
        p_guardian_name text default null,
        p_guardian_email text default null,
        p_guardian_phone text default null,
        p_enrolled_at date default current_date,
        p_access_ends_at date default null,
        p_notes text default null
    ) returns jsonb language plpgsql security invoker
set search_path = public,
    pg_temp as $$
declare v_firebase_uid text := btrim(coalesce(p_firebase_uid, ''));
v_login_email text := lower(btrim(coalesce(p_login_email, '')));
v_chinese_name text := btrim(coalesce(p_chinese_name, ''));
v_english_name text := nullif(btrim(coalesce(p_english_name, '')), '');
v_class_code text := upper(btrim(coalesce(p_class_code, '')));
v_guardian_name text := nullif(btrim(coalesce(p_guardian_name, '')), '');
v_guardian_email text := nullif(lower(btrim(coalesce(p_guardian_email, ''))), '');
v_guardian_phone text := nullif(btrim(coalesce(p_guardian_phone, '')), '');
v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
v_enrolled_at date := coalesce(p_enrolled_at, current_date);
v_creator_id bigint;
v_class_id smallint;
v_student public.students %rowtype;
v_guardian public.guardian_contacts %rowtype;
v_enrollment public.academy_enrollments %rowtype;
v_access_grant public.student_access_grants %rowtype;
begin if v_firebase_uid = ''
or char_length(v_firebase_uid) > 200 then raise exception using errcode = '22023',
message = 'invalid_firebase_uid';
end if;
if v_login_email = ''
or char_length(v_login_email) > 320
or v_login_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode = '22023',
message = 'invalid_login_email';
end if;
if v_chinese_name = ''
or char_length(v_chinese_name) > 100 then raise exception using errcode = '22023',
message = 'invalid_chinese_name';
end if;
if v_english_name is not null
and char_length(v_english_name) > 100 then raise exception using errcode = '22023',
message = 'invalid_english_name';
end if;
if v_guardian_name is not null
and char_length(v_guardian_name) > 100 then raise exception using errcode = '22023',
message = 'invalid_guardian_name';
end if;
if v_guardian_email is not null
and (
    char_length(v_guardian_email) > 320
    or v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
) then raise exception using errcode = '22023',
message = 'invalid_guardian_email';
end if;
if v_guardian_phone is not null
and char_length(v_guardian_phone) > 30 then raise exception using errcode = '22023',
message = 'invalid_guardian_phone';
end if;
if v_notes is not null
and char_length(v_notes) > 1000 then raise exception using errcode = '22023',
message = 'notes_too_long';
end if;
if p_access_ends_at is not null
and p_access_ends_at < v_enrolled_at then raise exception using errcode = '22023',
message = 'access_end_before_enrollment';
end if;
select staff.id into v_creator_id
from public.students as staff
where staff.id = p_created_by
    and staff.role in ('teacher', 'admin') for key share;
if v_creator_id is null then raise exception using errcode = '42501',
message = 'staff_permission_required';
end if;
select classes.id into v_class_id
from public.academy_classes as classes
where classes.code = v_class_code
    and classes.is_active = true;
if v_class_id is null then raise exception using errcode = '22023',
message = 'invalid_academy_class';
end if;
if exists (
    select 1
    from public.students
    where firebase_uid = v_firebase_uid
) then raise exception using errcode = '23505',
message = 'firebase_uid_already_exists';
end if;
if exists (
    select 1
    from public.students
    where lower(btrim(email)) = v_login_email
) then raise exception using errcode = '23505',
message = 'login_email_already_exists';
end if;
insert into public.students (
        firebase_uid,
        name,
        email,
        class,
        role,
        user_image,
        plan,
        total_time_played,
        current_time_played,
        chinese_name,
        english_name,
        learner_type,
        must_change_password,
        temporary_password_issued_at,
        password_changed_at,
        account_created_by
    )
values (
        v_firebase_uid,
        coalesce(v_english_name, v_chinese_name),
        v_login_email,
        v_class_code,
        'student',
        '6C9570CC-B276-424C-857F-11BBDD21C99B.png',
        'allcover',
        0,
        0,
        v_chinese_name,
        v_english_name,
        'academy_student',
        true,
        now(),
        null,
        v_creator_id
    )
returning * into v_student;
if v_guardian_name is not null
or v_guardian_email is not null
or v_guardian_phone is not null then
insert into public.guardian_contacts (
        student_id,
        guardian_name,
        email,
        phone,
        preferred_channel,
        notification_enabled
    )
values (
        v_student.id,
        v_guardian_name,
        v_guardian_email,
        v_guardian_phone,
        case
            when v_guardian_email is not null then 'email'
            when v_guardian_phone is not null then 'phone'
            else 'email'
        end,
        v_guardian_email is not null
        or v_guardian_phone is not null
    )
returning * into v_guardian;
end if;
insert into public.academy_enrollments (
        student_id,
        class_id,
        status,
        enrolled_at,
        access_ends_at,
        notes
    )
values (
        v_student.id,
        v_class_id,
        'active',
        v_enrolled_at,
        p_access_ends_at,
        v_notes
    )
returning * into v_enrollment;
select grants.* into v_access_grant
from public.student_access_grants as grants
where grants.student_id = v_student.id
    and grants.source = 'academy_enrollment'
    and grants.source_reference_type = 'academy_enrollment'
    and grants.source_reference_id = v_enrollment.id;
return jsonb_build_object(
    'student',
    to_jsonb(v_student),
    'guardian',
    case
        when v_guardian.id is null then null
        else to_jsonb(v_guardian)
    end,
    'enrollment',
    to_jsonb(v_enrollment),
    'access_grant',
    case
        when v_access_grant.id is null then null
        else to_jsonb(v_access_grant)
    end
);
exception
when unique_violation then raise exception using errcode = '23505',
message = 'academy_student_account_already_exists';
end;
$$;
comment on function public.create_academy_student_account_record(
    text,
    text,
    text,
    text,
    bigint,
    text,
    text,
    text,
    text,
    date,
    date,
    text
) is 'Transactionally creates an academy student profile, optional guardian contact, enrollment and trigger-managed academy access grant.';
revoke all on function public.create_academy_student_account_record(
    text,
    text,
    text,
    text,
    bigint,
    text,
    text,
    text,
    text,
    date,
    date,
    text
)
from public,
    anon,
    authenticated;
grant execute on function public.create_academy_student_account_record(
        text,
        text,
        text,
        text,
        bigint,
        text,
        text,
        text,
        text,
        date,
        date,
        text
    ) to service_role;
create or replace function public.mark_academy_student_password_changed(
        p_firebase_uid text,
        p_changed_at timestamptz default now()
    ) returns bigint language plpgsql security invoker
set search_path = public,
    pg_temp as $$
declare v_student_id bigint;
begin if btrim(coalesce(p_firebase_uid, '')) = '' then raise exception using errcode = '22023',
message = 'invalid_firebase_uid';
end if;
update public.students
set must_change_password = false,
    password_changed_at = coalesce(p_changed_at, now()),
    updated_at = now()
where firebase_uid = btrim(p_firebase_uid)
    and role = 'student'
returning id into v_student_id;
if v_student_id is null then raise exception using errcode = 'P0002',
message = 'student_not_found';
end if;
return v_student_id;
end;
$$;
comment on function public.mark_academy_student_password_changed(text, timestamptz) is 'Clears the temporary-password requirement after the authenticated student changes the Firebase password.';
revoke all on function public.mark_academy_student_password_changed(text, timestamptz)
from public,
    anon,
    authenticated;
grant execute on function public.mark_academy_student_password_changed(text, timestamptz) to service_role;
create or replace function public.mark_academy_student_temporary_password_issued(
        p_student_id bigint,
        p_issued_by bigint
    ) returns jsonb language plpgsql security invoker
set search_path = public,
    pg_temp as $$
declare v_issuer_id bigint;
v_student public.students %rowtype;
begin
select staff.id into v_issuer_id
from public.students as staff
where staff.id = p_issued_by
    and staff.role in ('teacher', 'admin') for key share;
if v_issuer_id is null then raise exception using errcode = '42501',
message = 'staff_permission_required';
end if;
update public.students
set must_change_password = true,
    temporary_password_issued_at = now(),
    account_created_by = coalesce(
        account_created_by,
        v_issuer_id
    ),
    updated_at = now()
where id = p_student_id
    and role = 'student'
    and learner_type = 'academy_student'
returning * into v_student;
if v_student.id is null then raise exception using errcode = 'P0002',
message = 'academy_student_not_found';
end if;
return to_jsonb(v_student);
end;
$$;
comment on function public.mark_academy_student_temporary_password_issued(bigint, bigint) is 'Records a staff-issued Firebase temporary-password reset without storing the password.';
revoke all on function public.mark_academy_student_temporary_password_issued(bigint, bigint)
from public,
    anon,
    authenticated;
grant execute on function public.mark_academy_student_temporary_password_issued(bigint, bigint) to service_role;
commit;
select (
        select count(*)
        from information_schema.columns
        where table_schema = 'public'
            and table_name = 'students'
            and column_name in (
                'must_change_password',
                'temporary_password_issued_at',
                'password_changed_at',
                'account_created_by'
            )
    ) as student_account_column_count,
    to_regprocedure(
        'public.create_academy_student_account_record(text,text,text,text,bigint,text,text,text,text,date,date,text)'
    ) is not null as create_account_function_ready,
    to_regprocedure(
        'public.mark_academy_student_password_changed(text,timestamptz)'
    ) is not null as password_changed_function_ready,
    to_regprocedure(
        'public.mark_academy_student_temporary_password_issued(bigint,bigint)'
    ) is not null as temporary_password_function_ready;