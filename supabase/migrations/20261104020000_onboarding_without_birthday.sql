-- 首次登入設定不再要求生日。
-- 完成條件改為：已改密碼 + 家長 Email 已驗證。生日仍照舊回傳 birthday_complete，
-- 已填生日的學生不受影響；「生日一旦設定不可自行修改」的觸發器與稽核都不動。
--
-- 回復方式：用 20260916015253_student_onboarding_guardian_email_verification.sql
-- 第 126-179 行的原文再 create or replace 一次（加回 date_of_birth is not null 條件）。

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
