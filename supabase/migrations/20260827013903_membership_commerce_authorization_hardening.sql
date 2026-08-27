-- Harden the first membership/material-commerce release without rewriting its
-- already-applied migration history.

create or replace function private.is_student_book_authorized(
    p_student_id bigint,
    p_book_id bigint,
    p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path=public,private,pg_temp
as $$
    select exists(
        select 1
        from public.student_book_entitlements e
        where e.student_id=p_student_id
          and e.book_id=p_book_id
          and e.status='active'
          and e.starts_at<=p_at
          and (e.is_permanent or e.ends_at is null or e.ends_at>p_at)
          and e.revoked_at is null
    ) or exists(
        select 1
        from public.academy_enrollments e
        join public.academy_class_material_settings s
          on s.class_id=e.class_id and s.is_active
        join public.academy_class_material_books b
          on b.setting_id=s.id and b.book_id=p_book_id
        where e.student_id=p_student_id
          and e.status='active'
          and e.enrolled_at<=p_at::date
          and (e.access_ends_at is null or e.access_ends_at>=p_at::date)
          and (e.scheduled_departure_at is null or e.scheduled_departure_at>p_at::date)
          and s.effective_from<=p_at::date
          and (s.effective_to is null or s.effective_to>=p_at::date)
    ) or exists(
        select 1
        from public.academy_enrollments e
        join public.academy_classes c on c.id=e.class_id
        join public.assignments a on a.target_class=c.code and a.enabled
        join public.assignment_track_items i on i.assignment_id=a.id
        where e.student_id=p_student_id
          and e.status='active'
          and e.enrolled_at<=p_at::date
          and (e.access_ends_at is null or e.access_ends_at>=p_at::date)
          and (e.scheduled_departure_at is null or e.scheduled_departure_at>p_at::date)
          and coalesce(
              i.book_id_snapshot,
              (select mt.book_id
               from public.music_tracks mt
               where mt.id=coalesce(i.track_id_snapshot,i.track_id))
          )=p_book_id
          and (a.due_at is null or a.due_at>p_at)
    );
$$;

revoke all on function private.is_student_book_authorized(bigint,bigint,timestamptz)
from public,anon,authenticated;
grant execute on function private.is_student_book_authorized(bigint,bigint,timestamptz)
to service_role;

-- Re-check every package update, not only updates that explicitly include the
-- status column. This prevents a published package from losing a price or its
-- Stripe test identifiers while it remains publicly purchasable.
drop trigger if exists material_packages_publishable on public.material_packages;
create trigger material_packages_publishable
before insert or update on public.material_packages
for each row execute function private.enforce_material_package_publishable();

revoke all on function private.enforce_material_package_publishable()
from public,anon,authenticated;
grant execute on function private.enforce_material_package_publishable()
to service_role;

create or replace function private.guard_published_material_package_books()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
    package_id_to_check bigint;
    package_status text;
    workbook_count integer;
    listening_count integer;
begin
    foreach package_id_to_check in array array[
        case when tg_op <> 'INSERT' then old.package_id end,
        case when tg_op <> 'DELETE' then new.package_id end
    ] loop
        if package_id_to_check is null then
            continue;
        end if;

        select status into package_status
        from public.material_packages
        where id=package_id_to_check;

        if package_status='published' then
            select
                count(*) filter(where role='workbook'),
                count(*) filter(where role='listening_book')
            into workbook_count,listening_count
            from public.material_package_books
            where package_id=package_id_to_check;

            if workbook_count <> 1 or listening_count <> 1 then
                raise exception using errcode='23514', message='material_package_incomplete';
            end if;
        end if;
    end loop;

    if tg_op='DELETE' then
        return old;
    end if;
    return new;
end;
$$;

revoke all on function private.guard_published_material_package_books()
from public,anon,authenticated;
grant execute on function private.guard_published_material_package_books()
to service_role;

drop trigger if exists material_package_books_insert_delete_publishable on public.material_package_books;
create trigger material_package_books_insert_delete_publishable
after insert or delete on public.material_package_books
for each row execute function private.guard_published_material_package_books();

drop trigger if exists material_package_books_update_publishable on public.material_package_books;
create trigger material_package_books_update_publishable
after update of package_id,role on public.material_package_books
for each row execute function private.guard_published_material_package_books();
