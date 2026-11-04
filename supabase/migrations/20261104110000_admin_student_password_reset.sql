-- 管理員重設英文班學生密碼：記錄稽核，並標記「必須改密碼」。
-- 只新增資料表與函式，不改既有資料；函式只有 service_role（Edge Function）能執行。
--
-- 重點：
--   * 臨時密碼只由 Edge Function 產生、只回給管理員一次，資料庫與稽核表都不保存密碼。
--   * p_issued_at 由後端傳入「Firebase 改密碼時間 + 2 秒」。學生之後自行改密碼時，
--     `mark_academy_student_password_changed` 要求 Firebase 的 passwordUpdatedAt 晚於這個時間，
--     所以管理員「設定臨時密碼」這個動作本身不會被誤判成學生已改密碼。
--
-- 回復方式：移除這張表與這個函式即可（只有本功能使用，不影響其他資料）。

begin;

create table if not exists public.academy_student_password_admin_resets (
    id bigint generated always as identity primary key,
    student_id bigint not null references public.students(id) on delete cascade,
    admin_id bigint references public.students(id) on delete set null,
    reason text not null,
    created_at timestamptz not null default now(),
    constraint academy_student_password_admin_resets_reason_check
        check (char_length(btrim(reason)) between 2 and 300)
);

create index if not exists academy_student_password_admin_resets_student_idx
    on public.academy_student_password_admin_resets (student_id, created_at desc);
create index if not exists academy_student_password_admin_resets_admin_idx
    on public.academy_student_password_admin_resets (admin_id);

alter table public.academy_student_password_admin_resets enable row level security;
revoke all on table public.academy_student_password_admin_resets from public, anon, authenticated;
revoke all on sequence public.academy_student_password_admin_resets_id_seq from public, anon, authenticated;
grant select, insert on table public.academy_student_password_admin_resets to service_role;
grant usage, select on sequence public.academy_student_password_admin_resets_id_seq to service_role;

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
