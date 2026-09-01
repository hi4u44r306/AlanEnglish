-- Preserve every class material that overlapped a student's academy enrollment.
-- The NT$299 plan restores platform features only; book ownership remains a
-- separate, permanent entitlement ledger.

alter table public.student_book_entitlements
    drop constraint if exists student_book_entitlements_source_check;

alter table public.student_book_entitlements
    add constraint student_book_entitlements_source_check check(source in (
        'material_purchase', 'admin_grant', 'activation_code', 'trial', 'legacy',
        'academy_history'
    ));

create index if not exists academy_class_material_settings_history_idx
    on public.academy_class_material_settings(class_id, effective_from, effective_to, id);

create or replace function private.academy_student_material_history_rows(
    p_student_id bigint,
    p_as_of date default current_date
)
returns table(
    enrollment_id bigint,
    class_id smallint,
    class_code text,
    book_id bigint,
    book_name text,
    book_code text,
    first_effective_from date,
    last_effective_to date,
    setting_ids bigint[],
    setting_versions integer[],
    evidence_sources text[]
)
language sql
stable
security definer
set search_path=public,private,pg_temp
as $$
    with enrollment_windows as (
        select
            e.id as enrollment_id,
            e.student_id,
            e.class_id,
            c.code as class_code,
            e.enrolled_at,
            least(
                coalesce(p_as_of, current_date),
                coalesce(
                    e.departed_at,
                    e.access_ends_at,
                    e.scheduled_departure_at,
                    p_as_of,
                    current_date
                )
            ) as enrollment_ends_at
        from public.academy_enrollments e
        join public.academy_classes c on c.id=e.class_id
        where e.student_id=p_student_id
          and e.enrolled_at<=coalesce(p_as_of,current_date)
    ), material_sources as (
        select
            ew.enrollment_id,ew.class_id,ew.class_code,smb.book_id,
            greatest(s.effective_from,ew.enrolled_at) as first_used_on,
            least(coalesce(s.effective_to,ew.enrollment_ends_at),ew.enrollment_ends_at) as last_used_on,
            s.id as setting_id,s.version as setting_version,'class_material_setting'::text as evidence_source
        from enrollment_windows ew
        join public.academy_class_material_settings s
          on s.class_id=ew.class_id
         and s.effective_from<=ew.enrollment_ends_at
         and (s.effective_to is null or s.effective_to>=ew.enrolled_at)
        join public.academy_class_material_books smb on smb.setting_id=s.id
        where ew.enrollment_ends_at>=ew.enrolled_at

        union all

        select
            ew.enrollment_id,ew.class_id,ew.class_code,
            coalesce(ati.book_id_snapshot,mt.book_id) as book_id,
            greatest((a.created_at at time zone 'Asia/Taipei')::date,ew.enrolled_at) as first_used_on,
            least(coalesce((a.due_at at time zone 'Asia/Taipei')::date,ew.enrollment_ends_at),ew.enrollment_ends_at) as last_used_on,
            null::bigint,null::integer,'class_assignment'::text
        from enrollment_windows ew
        join public.assignments a on a.target_class=ew.class_code
        join public.assignment_track_items ati on ati.assignment_id=a.id
        left join public.music_tracks mt on mt.id=coalesce(ati.track_id_snapshot,ati.track_id)
        where coalesce(ati.book_id_snapshot,mt.book_id) is not null
          and (a.created_at at time zone 'Asia/Taipei')::date<=ew.enrollment_ends_at
          and (a.due_at is null or (a.due_at at time zone 'Asia/Taipei')::date>=ew.enrolled_at)

        union all

        select
            ew.enrollment_id,ew.class_id,ew.class_code,mt.book_id,
            (stp.last_played_at at time zone 'Asia/Taipei')::date,
            (stp.last_played_at at time zone 'Asia/Taipei')::date,
            null::bigint,null::integer,'verified_listening'::text
        from enrollment_windows ew
        join public.student_track_progress stp on stp.student_id=ew.student_id
        join public.music_tracks mt on mt.id=stp.track_id
        where stp.last_played_at is not null
          and (stp.last_played_at at time zone 'Asia/Taipei')::date
              between ew.enrolled_at and ew.enrollment_ends_at
    )
    select
        source.enrollment_id,
        source.class_id,
        source.class_code,
        b.id as book_id,
        b.name as book_name,
        b.code as book_code,
        min(source.first_used_on) as first_effective_from,
        max(source.last_used_on) as last_effective_to,
        coalesce(
            array_agg(distinct source.setting_id order by source.setting_id)
                filter(where source.setting_id is not null),
            '{}'::bigint[]
        ) as setting_ids,
        coalesce(
            array_agg(distinct source.setting_version order by source.setting_version)
                filter(where source.setting_version is not null),
            '{}'::integer[]
        ) as setting_versions,
        array_agg(distinct source.evidence_source order by source.evidence_source) as evidence_sources
    from material_sources source
    join public.books b on b.id=source.book_id
    where source.last_used_on>=source.first_used_on
    group by source.enrollment_id,source.class_id,source.class_code,b.id,b.name,b.code;
$$;

revoke all on function private.academy_student_material_history_rows(bigint,date)
from public,anon,authenticated;
grant execute on function private.academy_student_material_history_rows(bigint,date)
to service_role;

create or replace function public.get_student_academy_material_history(
    p_student_id bigint,
    p_as_of date default current_date
)
returns table(
    book_id bigint,
    book_name text,
    book_code text,
    first_used_on date,
    last_used_on date,
    enrollment_ids bigint[],
    class_codes text[]
)
language sql
stable
security definer
set search_path=public,private,pg_temp
as $$
    select
        h.book_id,
        h.book_name,
        h.book_code,
        min(h.first_effective_from) as first_used_on,
        max(h.last_effective_to) as last_used_on,
        array_agg(distinct h.enrollment_id order by h.enrollment_id) as enrollment_ids,
        array_agg(distinct h.class_code order by h.class_code) as class_codes
    from private.academy_student_material_history_rows(p_student_id,p_as_of) h
    group by h.book_id,h.book_name,h.book_code
    order by min(h.first_effective_from),h.book_id;
$$;

revoke all on function public.get_student_academy_material_history(bigint,date)
from public,anon,authenticated;
grant execute on function public.get_student_academy_material_history(bigint,date)
to service_role;

create or replace function public.process_academy_departure_with_materials(
    p_enrollment_id bigint,
    p_student_id bigint,
    p_completed_by bigint,
    p_processed_on date,
    p_impact_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
    v_enrollment public.academy_enrollments%rowtype;
    v_departed_on date;
    v_retained_count integer := 0;
    v_books jsonb := '[]'::jsonb;
begin
    if p_processed_on is null then
        raise exception using message='離校處理日期不可為空', errcode='22023';
    end if;

    if not exists(
        select 1 from public.students
        where id=p_completed_by and role='admin'
    ) then
        raise exception using message='只有管理員可以完成離校', errcode='42501';
    end if;

    select * into v_enrollment
    from public.academy_enrollments
    where id=p_enrollment_id
      and student_id=p_student_id
    for update;

    if not found then
        raise exception using message='找不到學生在校紀錄', errcode='P0002';
    end if;
    if v_enrollment.status not in ('active','paused') then
        raise exception using message='學生目前不是可辦理離校的在校狀態', errcode='23514';
    end if;
    if v_enrollment.scheduled_departure_at is null
       or v_enrollment.scheduled_departure_at>p_processed_on then
        raise exception using message='尚未到離校生效日', errcode='23514';
    end if;

    v_departed_on := v_enrollment.scheduled_departure_at;

    insert into public.student_book_entitlements(
        student_id,book_id,source,source_reference_type,source_reference_id,
        status,is_permanent,starts_at,ends_at,revoked_at,revoke_reason,metadata,created_by
    )
    select
        p_student_id,
        h.book_id,
        'academy_history',
        'academy_enrollment',
        h.enrollment_id,
        'active',
        true,
        h.first_effective_from::timestamptz,
        null,
        null,
        null,
        jsonb_build_object(
            'class_id',h.class_id,
            'class_code',h.class_code,
            'enrollment_id',h.enrollment_id,
            'material_setting_ids',h.setting_ids,
            'material_setting_versions',h.setting_versions,
            'evidence_sources',h.evidence_sources,
            'first_effective_from',h.first_effective_from,
            'last_effective_to',h.last_effective_to,
            'granted_on_departure',v_departed_on,
            'backfilled',false
        ),
        p_completed_by
    from private.academy_student_material_history_rows(p_student_id,v_departed_on) h
    on conflict(student_id,book_id,source,source_reference_type,source_reference_id)
    do update set
        status='active',
        is_permanent=true,
        ends_at=null,
        revoked_at=null,
        revoke_reason=null,
        metadata=student_book_entitlements.metadata || excluded.metadata,
        updated_at=now();

    get diagnostics v_retained_count = row_count;

    select coalesce(jsonb_agg(jsonb_build_object(
        'book_id',history.book_id,
        'book_name',history.book_name,
        'book_code',history.book_code,
        'first_used_on',history.first_used_on,
        'last_used_on',history.last_used_on,
        'enrollment_ids',history.enrollment_ids,
        'class_codes',history.class_codes
    ) order by history.first_used_on,history.book_id),'[]'::jsonb)
    into v_books
    from public.get_student_academy_material_history(p_student_id,v_departed_on) history;

    update public.academy_enrollments
    set status='withdrawn',
        departed_at=v_departed_on,
        access_ends_at=v_departed_on,
        departure_completed_by=p_completed_by
    where id=v_enrollment.id;

    insert into public.academy_enrollment_lifecycle_events(
        enrollment_id,student_id,event_type,effective_date,impact_snapshot,reason,created_by
    ) values (
        v_enrollment.id,
        p_student_id,
        'departed',
        v_departed_on,
        coalesce(p_impact_snapshot,'{}'::jsonb) || jsonb_build_object(
            'retained_academy_books',v_books,
            'retained_academy_book_count',jsonb_array_length(v_books)
        ),
        v_enrollment.departure_reason,
        p_completed_by
    );

    return jsonb_build_object(
        'departed_at',v_departed_on,
        'retained_academy_book_count',jsonb_array_length(v_books),
        'retained_academy_books',v_books,
        'entitlement_rows_written',v_retained_count
    );
end;
$$;

revoke all on function public.process_academy_departure_with_materials(bigint,bigint,bigint,date,jsonb)
from public,anon,authenticated;
grant execute on function public.process_academy_departure_with_materials(bigint,bigint,bigint,date,jsonb)
to service_role;

-- Backfill every recorded departed/graduated enrollment. Re-running the
-- migration logic is safe because the source reference is enrollment-scoped.
with departed_students as (
    select distinct student_id
    from public.academy_enrollments
    where status in ('withdrawn','graduated') or departed_at is not null
), historical as (
    select h.*
    from departed_students ds
    cross join lateral private.academy_student_material_history_rows(ds.student_id,current_date) h
    join public.academy_enrollments e on e.id=h.enrollment_id
    where e.status in ('withdrawn','graduated') or e.departed_at is not null
)
insert into public.student_book_entitlements(
    student_id,book_id,source,source_reference_type,source_reference_id,
    status,is_permanent,starts_at,ends_at,revoked_at,revoke_reason,metadata
)
select
    e.student_id,
    h.book_id,
    'academy_history',
    'academy_enrollment',
    h.enrollment_id,
    'active',
    true,
    h.first_effective_from::timestamptz,
    null,
    null,
    null,
    jsonb_build_object(
        'class_id',h.class_id,
        'class_code',h.class_code,
        'enrollment_id',h.enrollment_id,
        'material_setting_ids',h.setting_ids,
        'material_setting_versions',h.setting_versions,
        'evidence_sources',h.evidence_sources,
        'first_effective_from',h.first_effective_from,
        'last_effective_to',h.last_effective_to,
        'granted_on_departure',coalesce(e.departed_at,e.access_ends_at,e.scheduled_departure_at),
        'backfilled',true
    )
from historical h
join public.academy_enrollments e on e.id=h.enrollment_id
on conflict(student_id,book_id,source,source_reference_type,source_reference_id)
do update set
    status='active',
    is_permanent=true,
    ends_at=null,
    revoked_at=null,
    revoke_reason=null,
    metadata=student_book_entitlements.metadata || excluded.metadata,
    updated_at=now();

comment on function public.process_academy_departure_with_materials(bigint,bigint,bigint,date,jsonb) is
    'Atomically snapshots every historical academy book, grants permanent entitlements, closes the current enrollment and records the departure event.';
