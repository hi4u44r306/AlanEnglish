begin;

alter table public.students
    add column if not exists account_status text not null default 'active',
    add column if not exists archived_at timestamptz,
    add column if not exists archived_by bigint,
    add column if not exists archive_reason text;

comment on column public.students.account_status is
    'Account lifecycle state. Archived accounts keep learning history but cannot use the application.';
comment on column public.students.archived_at is
    'When a staff member archived this account.';
comment on column public.students.archived_by is
    'Staff account that most recently archived this account.';
comment on column public.students.archive_reason is
    'Optional internal reason for archiving the account.';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.students'::regclass
          and conname = 'students_account_status_check'
    ) then
        alter table public.students
            add constraint students_account_status_check
            check (account_status in ('active', 'archived'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.students'::regclass
          and conname = 'students_archived_by_fkey'
    ) then
        alter table public.students
            add constraint students_archived_by_fkey
            foreign key (archived_by)
            references public.students(id)
            on delete set null;
    end if;
end;
$$;

create index if not exists students_account_status_idx
    on public.students (account_status, role, class);

commit;
