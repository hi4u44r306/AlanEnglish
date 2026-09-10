alter table public.notification_logs
    add column if not exists resend_of_notification_id bigint,
    add column if not exists resend_reason text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.notification_logs'::regclass
          and conname = 'notification_logs_resend_of_fkey'
    ) then
        alter table public.notification_logs
            add constraint notification_logs_resend_of_fkey
            foreign key (resend_of_notification_id)
            references public.notification_logs(id)
            on delete restrict
            not valid;
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.notification_logs'::regclass
          and conname = 'notification_logs_resend_audit_check'
    ) then
        alter table public.notification_logs
            add constraint notification_logs_resend_audit_check
            check (
                (resend_of_notification_id is null and resend_reason is null)
                or (
                    resend_of_notification_id is not null
                    and resend_reason is not null
                    and char_length(btrim(resend_reason)) between 3 and 500
                )
            )
            not valid;
    end if;
end
$$;

alter table public.notification_logs
    validate constraint notification_logs_resend_of_fkey;

alter table public.notification_logs
    validate constraint notification_logs_resend_audit_check;

create index if not exists notification_logs_resend_of_idx
    on public.notification_logs (resend_of_notification_id, created_at desc)
    where resend_of_notification_id is not null;
