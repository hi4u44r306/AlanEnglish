-- 英文班學生忘記密碼：寄一次性重設連結到「已驗證的家長 Email」。
-- 只新增資料表與函式，不改既有資料；所有函式只有 service_role（Edge Function）能執行。
--
-- 設計重點：
--   * token 只存 SHA-256 雜湊，30 分鐘有效，一次性；新的要求會作廢舊的。
--   * 只寄給「家長 Email 已驗證，且確實收過驗證碼」的信箱（guardian_email_verification_requests
--     有 status = 'verified' 且 pending_email 與目前信箱相同）。2026-09-16 當時被直接標成已驗證的舊信箱
--     不符合條件，必須重新驗證。
--   * 頻率限制以「帳號雜湊」與「來源雜湊」計算，與帳號是否存在無關，不會洩漏帳號存在與否。
--   * 完成時先保留（reservation）5 分鐘再改 Firebase 密碼，沿用復原碼的做法。
--
-- 回復方式：移除這兩張表與四個函式即可（它們只有本功能使用，不影響其他資料）。

begin;

create table if not exists public.academy_password_reset_tokens (
    id bigint generated always as identity primary key,
    student_id bigint not null references public.students(id) on delete cascade,
    token_hash char(64) not null unique,
    sent_to_masked text not null,
    expires_at timestamptz not null,
    reservation_hash char(64),
    reservation_expires_at timestamptz,
    used_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    constraint academy_password_reset_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists academy_password_reset_tokens_student_idx
    on public.academy_password_reset_tokens (student_id, created_at desc);

create table if not exists public.academy_password_reset_requests (
    id bigint generated always as identity primary key,
    username_hash char(64) not null,
    source_hash char(64),
    student_id bigint references public.students(id) on delete set null,
    outcome text not null check (outcome in ('sent', 'skipped', 'rate_limited')),
    requested_at timestamptz not null default now()
);

create index if not exists academy_password_reset_requests_username_idx
    on public.academy_password_reset_requests (username_hash, requested_at desc);
create index if not exists academy_password_reset_requests_source_idx
    on public.academy_password_reset_requests (source_hash, requested_at desc);
create index if not exists academy_password_reset_requests_student_idx
    on public.academy_password_reset_requests (student_id);

alter table public.academy_password_reset_tokens enable row level security;
alter table public.academy_password_reset_requests enable row level security;
revoke all on table public.academy_password_reset_tokens from public, anon, authenticated;
revoke all on table public.academy_password_reset_requests from public, anon, authenticated;
revoke all on sequence public.academy_password_reset_tokens_id_seq from public, anon, authenticated;
revoke all on sequence public.academy_password_reset_requests_id_seq from public, anon, authenticated;
grant select, insert, update on table public.academy_password_reset_tokens to service_role;
grant select, insert on table public.academy_password_reset_requests to service_role;
grant usage, select on sequence public.academy_password_reset_tokens_id_seq to service_role;
grant usage, select on sequence public.academy_password_reset_requests_id_seq to service_role;

-- 1) 要求寄送：檢查頻率與資格，符合才建立 token 並回傳要寄的信箱（只回給 service_role）。
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
          and exists (
              select 1
              from public.guardian_email_verification_requests r
              where r.student_id = v_student.id
                and r.status = 'verified'
                and r.pending_email = lower(btrim(g.email))
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

-- 2) 預覽：打開連結的人才看得到遮罩後的信箱與帳號。
create or replace function public.preview_academy_password_reset(
    p_token_hash char(64)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_token public.academy_password_reset_tokens%rowtype;
    v_student public.students%rowtype;
begin
    select * into v_token
    from public.academy_password_reset_tokens
    where token_hash = p_token_hash
      and used_at is null
      and revoked_at is null
      and expires_at > now();

    if not found then
        return jsonb_build_object('status', 'invalid');
    end if;

    select * into v_student
    from public.students
    where id = v_token.student_id
      and authentication_method = 'academy_username'
      and account_status = 'active';

    if not found then
        return jsonb_build_object('status', 'invalid');
    end if;

    return jsonb_build_object(
        'status', 'valid',
        'username', v_student.login_username,
        'sent_to_masked', v_token.sent_to_masked
    );
end;
$$;

-- 3) 保留：在改 Firebase 密碼之前先鎖定 token 5 分鐘，避免同一個連結被同時使用。
create or replace function public.reserve_academy_password_reset(
    p_token_hash char(64),
    p_reservation_hash char(64)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_token public.academy_password_reset_tokens%rowtype;
    v_student public.students%rowtype;
begin
    select * into v_token
    from public.academy_password_reset_tokens
    where token_hash = p_token_hash
      and used_at is null
      and revoked_at is null
      and expires_at > now()
      and (reservation_expires_at is null or reservation_expires_at <= now())
    for update;

    if not found then
        return jsonb_build_object('status', 'invalid');
    end if;

    select * into v_student
    from public.students
    where id = v_token.student_id
      and authentication_method = 'academy_username'
      and account_status = 'active'
    for update;

    if not found or v_student.firebase_uid is null then
        return jsonb_build_object('status', 'invalid');
    end if;

    update public.academy_password_reset_tokens
    set reservation_hash = p_reservation_hash,
        reservation_expires_at = now() + interval '5 minutes'
    where id = v_token.id;

    return jsonb_build_object(
        'status', 'reserved',
        'token_id', v_token.id,
        'student_id', v_student.id,
        'firebase_uid', v_student.firebase_uid,
        'username', v_student.login_username
    );
end;
$$;

-- 4) 完成：Firebase 密碼已更新後，消耗 token、作廢該學生其他 token，並清除「必須改密碼」旗標。
create or replace function public.complete_academy_password_reset(
    p_token_id bigint,
    p_reservation_hash char(64)
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_student_id bigint;
begin
    update public.academy_password_reset_tokens
    set used_at = now(),
        reservation_hash = null,
        reservation_expires_at = null
    where id = p_token_id
      and used_at is null
      and revoked_at is null
      and reservation_hash = p_reservation_hash
      and reservation_expires_at > now()
    returning student_id into v_student_id;

    if not found then
        return false;
    end if;

    update public.academy_password_reset_tokens
    set revoked_at = now()
    where student_id = v_student_id
      and id <> p_token_id
      and used_at is null
      and revoked_at is null;

    update public.students
    set must_change_password = false,
        password_changed_at = now(),
        updated_at = now()
    where id = v_student_id;

    return true;
end;
$$;

revoke all on function public.request_academy_guardian_password_reset(text, char(64), char(64), char(64)) from public, anon, authenticated;
revoke all on function public.preview_academy_password_reset(char(64)) from public, anon, authenticated;
revoke all on function public.reserve_academy_password_reset(char(64), char(64)) from public, anon, authenticated;
revoke all on function public.complete_academy_password_reset(bigint, char(64)) from public, anon, authenticated;
grant execute on function public.request_academy_guardian_password_reset(text, char(64), char(64), char(64)) to service_role;
grant execute on function public.preview_academy_password_reset(char(64)) to service_role;
grant execute on function public.reserve_academy_password_reset(char(64), char(64)) to service_role;
grant execute on function public.complete_academy_password_reset(bigint, char(64)) to service_role;

commit;
