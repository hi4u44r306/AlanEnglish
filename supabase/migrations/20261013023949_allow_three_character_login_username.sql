-- Lowers the minimum length of an academy login username from 5 to 3 characters
-- (still lower-case letters and digits, starting with a letter, at most 32).
-- Same function body as before; only the length in the pattern changes.
-- Existing accounts, privileges and the unique index on login_username are untouched.
create or replace function public.create_academy_student_login_record(
    p_firebase_uid text,
    p_internal_email text,
    p_login_username text,
    p_chinese_name text,
    p_class_code text,
    p_created_by bigint,
    p_activation_token_hash text,
    p_activation_token_hint text,
    p_activation_expires_at timestamp with time zone,
    p_recovery_code_hashes text[],
    p_recovery_code_hints text[],
    p_english_name text default null,
    p_guardian_name text default null,
    p_guardian_email text default null,
    p_guardian_phone text default null,
    p_enrolled_at date default current_date,
    p_access_ends_at date default null,
    p_notes text default null
)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
    v_username text := lower(btrim(coalesce(p_login_username, '')));
    v_result jsonb;
    v_student_id bigint;
    v_student public.students%rowtype;
    v_index integer;
begin
    if v_username !~ '^[a-z][a-z0-9]{2,31}$' then
        raise exception using errcode = '22023', message = 'invalid_login_username';
    end if;
    if coalesce(array_length(p_recovery_code_hashes, 1), 0) <> 2
        or coalesce(array_length(p_recovery_code_hints, 1), 0) <> 2 then
        raise exception using errcode = '22023', message = 'invalid_recovery_codes';
    end if;

    v_result := public.create_academy_student_account_record(
        p_firebase_uid,
        p_internal_email,
        p_chinese_name,
        p_class_code,
        p_created_by,
        p_english_name,
        p_guardian_name,
        p_guardian_email,
        p_guardian_phone,
        p_enrolled_at,
        p_access_ends_at,
        p_notes
    );
    v_student_id := (v_result -> 'student' ->> 'id')::bigint;

    update public.students
    set login_username = v_username,
        authentication_method = 'academy_username',
        must_change_password = true,
        activated_at = null,
        updated_at = now()
    where id = v_student_id
    returning * into v_student;

    insert into public.academy_student_activation_tokens (
        student_id, token_hash, token_hint, expires_at, created_by
    ) values (
        v_student_id,
        p_activation_token_hash,
        p_activation_token_hint,
        p_activation_expires_at,
        p_created_by
    );

    for v_index in 1..2 loop
        insert into public.academy_student_recovery_codes (
            student_id, code_hash, code_hint, created_by
        ) values (
            v_student_id,
            p_recovery_code_hashes[v_index],
            p_recovery_code_hints[v_index],
            p_created_by
        );
    end loop;

    return jsonb_set(v_result, '{student}', to_jsonb(v_student), true);
end;
$function$;
