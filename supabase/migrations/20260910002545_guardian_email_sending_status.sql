-- Direct and class guardian emails mark a notification as in-flight before
-- calling Resend. Keep the state explicit so concurrent retries remain visible.
alter table public.notification_logs
    drop constraint if exists notification_logs_status_check;

alter table public.notification_logs
    add constraint notification_logs_status_check
    check (status = any (array[
        'draft'::text,
        'sending'::text,
        'sent'::text,
        'failed'::text,
        'cancelled'::text
    ])) not valid;

alter table public.notification_logs
    validate constraint notification_logs_status_check;
