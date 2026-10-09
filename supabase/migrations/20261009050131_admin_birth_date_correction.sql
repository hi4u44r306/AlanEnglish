begin;

create table public.admin_birth_date_corrections (
    id bigint generated always as identity primary key,
    student_id bigint not null references public.students(id) on delete cascade,
    admin_id bigint references public.students(id) on delete set null,
    previous_date_of_birth date,
    new_date_of_birth date not null,
    reason text not null check (char_length(btrim(reason)) between 2 and 500),
    transaction_id bigint not null default txid_current(),
    created_at timestamptz not null default now()
);
create index admin_birth_date_corrections_student_idx
    on public.admin_birth_date_corrections(student_id,created_at desc,id desc);
create index admin_birth_date_corrections_admin_idx on public.admin_birth_date_corrections(admin_id);
alter table public.admin_birth_date_corrections enable row level security;
revoke all on public.admin_birth_date_corrections from public,anon,authenticated,service_role;
grant select,insert on public.admin_birth_date_corrections to service_role;
revoke all on sequence public.admin_birth_date_corrections_id_seq from public,anon,authenticated;
grant usage,select on sequence public.admin_birth_date_corrections_id_seq to service_role;

-- Ordinary first-time registration remains possible; an existing date is immutable
-- unless the service-only RPC has created an exact audit entry in this transaction.
create or replace function public.prevent_student_birth_date_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
    if old.date_of_birth is not null and new.date_of_birth is distinct from old.date_of_birth then
        if current_user = 'service_role' then
            if exists (
                select 1 from public.admin_birth_date_corrections h
                where h.id::text = current_setting('alan_english.birth_date_correction_id',true)
                  and h.transaction_id = txid_current()
                  and h.student_id = old.id
                  and h.previous_date_of_birth is not distinct from old.date_of_birth
                  and h.new_date_of_birth = new.date_of_birth
            ) then return new; end if;
        end if;
        raise exception using errcode='23514',message='student_date_of_birth_is_immutable';
    end if;
    return new;
end;
$$;
revoke all on function public.prevent_student_birth_date_change() from public,anon,authenticated;

create or replace function public.admin_correct_student_birth_date_v1(
    p_admin_id bigint,p_student_id bigint,p_expected_date_of_birth date,
    p_date_of_birth date,p_reason text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    v_student public.students%rowtype;
    v_history public.admin_birth_date_corrections%rowtype;
    v_reason text := btrim(p_reason,E' \t\r\n');
    v_previous_context text := current_setting('alan_english.birth_date_correction_id',true);
begin
    perform 1 from public.students a where a.id=p_admin_id and a.role='admin'
        and a.archived_at is null and coalesce(a.account_status,'active')='active' for share;
    if not found then raise exception 'ADMIN_REQUIRED'; end if;
    if p_date_of_birth is null or p_date_of_birth < date '1900-01-01'
       or p_date_of_birth > (now() at time zone 'Asia/Taipei')::date
       or v_reason is null or char_length(v_reason) not between 2 and 500 then
        raise exception 'INVALID_BIRTH_DATE_CORRECTION';
    end if;
    select * into v_student from public.students s where s.id=p_student_id and s.role='student' for update;
    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
    if v_student.date_of_birth is distinct from p_expected_date_of_birth then
        raise exception 'BIRTH_DATE_CHANGED';
    end if;
    if v_student.date_of_birth is not distinct from p_date_of_birth then
        raise exception 'BIRTH_DATE_UNCHANGED';
    end if;
    insert into public.admin_birth_date_corrections
        (student_id,admin_id,previous_date_of_birth,new_date_of_birth,reason)
    values (p_student_id,p_admin_id,v_student.date_of_birth,p_date_of_birth,v_reason)
    returning * into v_history;
    perform set_config('alan_english.birth_date_correction_id',v_history.id::text,true);
    update public.students set date_of_birth=p_date_of_birth,updated_at=now() where id=p_student_id;
    perform set_config('alan_english.birth_date_correction_id',coalesce(v_previous_context,''),true);
    return jsonb_build_object('student',jsonb_build_object('id',p_student_id,'date_of_birth',p_date_of_birth),
        'history_entry',to_jsonb(v_history)-'transaction_id');
end;
$$;
revoke all on function public.admin_correct_student_birth_date_v1(bigint,bigint,date,date,text)
    from public,anon,authenticated;
grant execute on function public.admin_correct_student_birth_date_v1(bigint,bigint,date,date,text) to service_role;

commit;
