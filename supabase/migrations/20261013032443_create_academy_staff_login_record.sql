-- Lets an admin create a teacher or admin account directly, with the same
-- username + one-time activation card that academy students use.
-- Additive: one new function, no change to existing tables, data or functions.
-- Only the service role may call it; academy-student-manager verifies the
-- Firebase ID token and re-checks that the caller is an admin before it does.
create or replace function public.create_academy_staff_login_record(
    p_firebase_uid text,
    p_internal_email text,
    p_login_username text,
    p_chinese_name text,
    p_english_name text,
    p_role text,
    p_class_codes text[],
    p_created_by bigint,
    p_activation_token_hash text,
    p_activation_token_hint text,
    p_activation_expires_at timestamp with time zone,
    p_recovery_code_hashes text[],
    p_recovery_code_hints text[]
)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
    v_firebase_uid text := btrim(coalesce(p_firebase_uid, ''));
    v_email text := lower(btrim(coalesce(p_internal_email, '')));
    v_username text := lower(btrim(coalesce(p_login_username, '')));
    v_chinese_name text := btrim(coalesce(p_chinese_name, ''));
    v_english_name text := nullif(btrim(coalesce(p_english_name, '')), '');
    v_class_codes text[] := coalesce(p_class_codes, '{}');
    v_creator_id bigint;
    v_staff public.students%rowtype;
    v_index integer;
    v_granted text[];
begin
    if p_role is null or p_role not in ('teacher', 'admin') then
        raise exception using errcode = '22023', message = 'invalid_staff_role';
    end if;
    if v_firebase_uid = '' or char_length(v_firebase_uid) > 200 then
        raise exception using errcode = '22023', message = 'invalid_firebase_uid';
    end if;
    if v_username !~ '^[a-z][a-z0-9]{2,31}$' then
        raise exception using errcode = '22023', message = 'invalid_login_username';
    end if;
    if v_email = '' or char_length(v_email) > 320
        or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception using errcode = '22023', message = 'invalid_login_email';
    end if;
    if v_chinese_name = '' or char_length(v_chinese_name) > 100 then
        raise exception using errcode = '22023', message = 'invalid_chinese_name';
    end if;
    if v_english_name is not null and char_length(v_english_name) > 100 then
        raise exception using errcode = '22023', message = 'invalid_english_name';
    end if;
    if coalesce(array_length(p_recovery_code_hashes, 1), 0) <> 2
        or coalesce(array_length(p_recovery_code_hints, 1), 0) <> 2 then
        raise exception using errcode = '22023', message = 'invalid_recovery_codes';
    end if;

    -- Only an admin may create staff; teachers may not create other staff.
    select creator.id into v_creator_id
    from public.students as creator
    where creator.id = p_created_by
      and creator.role = 'admin'
      and coalesce(creator.account_status, 'active') = 'active'
    for key share;
    if v_creator_id is null then
        raise exception using errcode = '42501', message = 'admin_permission_required';
    end if;

    if p_role = 'teacher' and exists (
        select 1 from unnest(v_class_codes) as requested(code)
        where not exists (
            select 1 from public.academy_classes
            where academy_classes.code = requested.code and academy_classes.is_active = true
        )
    ) then
        raise exception using errcode = '22023', message = 'invalid_academy_class';
    end if;

    if exists (select 1 from public.students where firebase_uid = v_firebase_uid) then
        raise exception using errcode = '23505', message = 'firebase_uid_already_exists';
    end if;
    if exists (select 1 from public.students where lower(btrim(email)) = v_email) then
        raise exception using errcode = '23505', message = 'login_email_already_exists';
    end if;

    insert into public.students (
        firebase_uid, name, email, class, role, user_image, plan,
        total_time_played, current_time_played, chinese_name, english_name, learner_type,
        must_change_password, temporary_password_issued_at, password_changed_at, account_created_by,
        login_username, authentication_method, activated_at
    ) values (
        v_firebase_uid, coalesce(v_english_name, v_chinese_name), v_email, null, p_role,
        '6C9570CC-B276-424C-857F-11BBDD21C99B.png', 'allcover',
        0, 0, v_chinese_name, v_english_name, null,
        true, now(), null, v_creator_id,
        v_username, 'academy_username', null
    )
    returning * into v_staff;

    insert into public.academy_student_activation_tokens (
        student_id, token_hash, token_hint, expires_at, created_by
    ) values (
        v_staff.id, p_activation_token_hash, p_activation_token_hint, p_activation_expires_at, v_creator_id
    );

    for v_index in 1..2 loop
        insert into public.academy_student_recovery_codes (
            student_id, code_hash, code_hint, created_by
        ) values (
            v_staff.id, p_recovery_code_hashes[v_index], p_recovery_code_hints[v_index], v_creator_id
        );
    end loop;

    -- Staff use the site for free and never expire.
    insert into public.memberships (student_id, status, source, access_started_at, access_ends_at)
    values (v_staff.id, 'complimentary', 'admin_grant', now(), null);

    -- Admins already manage every class; only teachers need per-class permission.
    if p_role = 'teacher' then
        with granted as (
            insert into public.teacher_class_permissions (teacher_id, class_id, can_publish, created_by)
            select v_staff.id, academy_classes.id, true, v_creator_id
            from public.academy_classes
            where academy_classes.code = any (v_class_codes) and academy_classes.is_active = true
            on conflict (teacher_id, class_id, starts_at) do nothing
            returning class_id
        )
        select array_agg(academy_classes.code order by academy_classes.code) into v_granted
        from granted join public.academy_classes on academy_classes.id = granted.class_id;
    end if;

    return jsonb_build_object(
        'staff', jsonb_build_object(
            'id', v_staff.id,
            'name', v_staff.name,
            'chinese_name', v_staff.chinese_name,
            'english_name', v_staff.english_name,
            'role', v_staff.role,
            'login_username', v_staff.login_username
        ),
        'class_codes', coalesce(to_jsonb(v_granted), '[]'::jsonb)
    );
exception
    when unique_violation then
        raise exception using errcode = '23505', message = 'academy_staff_account_already_exists';
end;
$function$;

revoke all on function public.create_academy_staff_login_record(
    text, text, text, text, text, text, text[], bigint, text, text, timestamp with time zone, text[], text[]
) from public, anon, authenticated;
grant execute on function public.create_academy_staff_login_record(
    text, text, text, text, text, text, text[], bigint, text, text, timestamp with time zone, text[], text[]
) to service_role;
