-- A term rollover must not remove books that students already used. The
-- preview and write functions deliberately run only as service_role; the Edge
-- Function verifies the Firebase admin before calling them.

create or replace function public.preview_academy_class_material_rollover(
    p_class_id smallint,
    p_effective_from date,
    p_book_ids bigint[]
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
    v_class public.academy_classes%rowtype;
    v_previous public.academy_class_material_settings%rowtype;
    v_book_ids bigint[];
    v_previous_book_ids bigint[] := '{}'::bigint[];
    v_historical_book_ids bigint[] := '{}'::bigint[];
    v_added_book_ids bigint[] := '{}'::bigint[];
    v_removed_book_ids bigint[] := '{}'::bigint[];
    v_active_student_count integer := 0;
    v_retained_student_count integer := 0;
    v_retained_entitlement_count integer := 0;
    v_assignment_count integer := 0;
begin
    if p_effective_from is null or p_effective_from<>(now() at time zone 'Asia/Taipei')::date then
        raise exception using message='為避免漏掉換版前新加入的學生，新學期教材只能在生效當天建立', errcode='23514';
    end if;

    select * into v_class
    from public.academy_classes
    where id=p_class_id and code in ('E1','E3','E5','E7') and is_active
    for share;
    if not found then
        raise exception using message='班級不存在或已停用', errcode='P0002';
    end if;

    select coalesce(array_agg(distinct selected.book_id order by selected.book_id),'{}'::bigint[])
    into v_book_ids
    from unnest(coalesce(p_book_ids,'{}'::bigint[])) as selected(book_id)
    where selected.book_id is not null;
    if cardinality(v_book_ids)=0 then
        raise exception using message='新學期至少需要選擇一本教材', errcode='23514';
    end if;
    if (select count(*) from public.books b where b.id=any(v_book_ids) and b.enabled and b.archived_at is null)
       <>cardinality(v_book_ids) then
        raise exception using message='包含不存在或已停用的教材', errcode='23514';
    end if;
    if exists(
        select 1 from public.academy_class_material_settings s
        where s.class_id=p_class_id and s.is_active and s.effective_from>=p_effective_from
    ) then
        raise exception using message='這個班級今天或之後已建立教材版本', errcode='23505';
    end if;

    select * into v_previous
    from public.academy_class_material_settings s
    where s.class_id=p_class_id
      and s.is_active
      and s.effective_from<p_effective_from
      and (s.effective_to is null or s.effective_to>=p_effective_from-1)
    order by s.version desc
    limit 1;

    if v_previous.id is not null then
        select coalesce(array_agg(book_id order by sort_order,book_id),'{}'::bigint[])
        into v_previous_book_ids
        from public.academy_class_material_books
        where setting_id=v_previous.id;
    end if;

    select count(distinct history.student_id),count(*),
           coalesce(array_agg(distinct history.book_id order by history.book_id),'{}'::bigint[])
    into v_retained_student_count,v_retained_entitlement_count,v_historical_book_ids
    from (
        select candidate.student_id,h.enrollment_id,h.book_id
        from (
            select distinct e.student_id
            from public.academy_enrollments e
            where e.class_id=p_class_id and e.enrolled_at<p_effective_from
        ) candidate
        cross join lateral private.academy_student_material_history_rows(
            candidate.student_id,p_effective_from-1
        ) h
        where h.class_id=p_class_id
    ) history;

    select count(distinct e.student_id)
    into v_active_student_count
    from public.academy_enrollments e
    where e.class_id=p_class_id
      and e.status='active'
      and e.enrolled_at<=p_effective_from
      and (e.access_ends_at is null or e.access_ends_at>=p_effective_from)
      and (e.scheduled_departure_at is null or e.scheduled_departure_at>p_effective_from);

    select count(*) into v_assignment_count
    from public.assignments a
    where a.target_class=v_class.code and a.enabled
      and (a.due_at is null or a.due_at>=now());

    select coalesce(array_agg(selected.id order by selected.id),'{}'::bigint[])
    into v_added_book_ids
    from unnest(v_book_ids) as selected(id)
    where not (selected.id=any(v_previous_book_ids));

    select coalesce(array_agg(selected.id order by selected.id),'{}'::bigint[])
    into v_removed_book_ids
    from unnest(v_previous_book_ids) as selected(id)
    where not (selected.id=any(v_book_ids));

    return jsonb_build_object(
        'preview',true,
        'class_id',v_class.id,
        'class_code',v_class.code,
        'effective_from',p_effective_from,
        'previous_setting_id',v_previous.id,
        'previous_version',v_previous.version,
        'previous_book_ids',v_previous_book_ids,
        'historical_book_ids',v_historical_book_ids,
        'next_book_ids',v_book_ids,
        'added_book_ids',v_added_book_ids,
        'removed_book_ids',v_removed_book_ids,
        'affected_student_count',v_active_student_count,
        'retained_student_count',v_retained_student_count,
        'retained_entitlement_count',v_retained_entitlement_count,
        'affected_assignment_count',v_assignment_count
    );
end;
$$;

revoke all on function public.preview_academy_class_material_rollover(smallint,date,bigint[])
from public,anon,authenticated;
grant execute on function public.preview_academy_class_material_rollover(smallint,date,bigint[])
to service_role;

create or replace function public.rollover_academy_class_materials(
    p_class_id smallint,
    p_effective_from date,
    p_book_ids bigint[],
    p_term_label text,
    p_actor_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
    v_actor public.students%rowtype;
    v_previous public.academy_class_material_settings%rowtype;
    v_setting public.academy_class_material_settings%rowtype;
    v_preview jsonb;
    v_book_ids bigint[];
    v_version integer;
    v_entitlement_rows integer := 0;
begin
    select * into v_actor
    from public.students
    where id=p_actor_id and role='admin' and coalesce(account_status,'active')='active'
    for share;
    if not found then
        raise exception using message='只有有效的管理員可以執行教材換版', errcode='42501';
    end if;
    if nullif(btrim(coalesce(p_term_label,'')),'') is null then
        raise exception using message='請填寫新學期名稱', errcode='23514';
    end if;

    perform pg_advisory_xact_lock(8137,p_class_id::integer);
    v_preview := public.preview_academy_class_material_rollover(p_class_id,p_effective_from,p_book_ids);
    select coalesce(array_agg(distinct selected.book_id order by selected.book_id),'{}'::bigint[])
    into v_book_ids
    from unnest(p_book_ids) as selected(book_id);

    if (v_preview->>'previous_setting_id') is not null then
        select * into v_previous
        from public.academy_class_material_settings
        where id=(v_preview->>'previous_setting_id')::bigint
        for update;

        update public.academy_class_material_settings
        set effective_to=p_effective_from-1,updated_by=p_actor_id,updated_at=now()
        where id=v_previous.id;
    end if;

    insert into public.student_book_entitlements(
        student_id,book_id,source,source_reference_type,source_reference_id,
        status,is_permanent,starts_at,ends_at,revoked_at,revoke_reason,metadata,created_by
    )
    select
        candidate.student_id,
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
            'retained_on_rollover',p_effective_from,
            'next_term_label',btrim(p_term_label)
        ),
        p_actor_id
    from (
        select distinct e.student_id
        from public.academy_enrollments e
        where e.class_id=p_class_id and e.enrolled_at<p_effective_from
    ) candidate
    cross join lateral private.academy_student_material_history_rows(
        candidate.student_id,p_effective_from-1
    ) h
    where h.class_id=p_class_id
    on conflict(student_id,book_id,source,source_reference_type,source_reference_id)
    do update set
        status='active',is_permanent=true,ends_at=null,revoked_at=null,revoke_reason=null,
        starts_at=least(student_book_entitlements.starts_at,excluded.starts_at),
        metadata=student_book_entitlements.metadata || excluded.metadata,
        updated_at=now();
    get diagnostics v_entitlement_rows=row_count;

    select coalesce(max(version),0)+1 into v_version
    from public.academy_class_material_settings
    where class_id=p_class_id;

    insert into public.academy_class_material_settings(
        class_id,version,effective_from,note,created_by,updated_by
    ) values (
        p_class_id,v_version,p_effective_from,left(btrim(p_term_label),500),p_actor_id,p_actor_id
    ) returning * into v_setting;

    insert into public.academy_class_material_books(setting_id,book_id,sort_order)
    select v_setting.id,value,ordinality-1
    from unnest(v_book_ids) with ordinality selected(value,ordinality);

    insert into public.academy_class_material_audit_log(
        class_id,setting_id,action,previous_snapshot,next_snapshot,
        affected_student_count,affected_assignment_count,created_by
    ) values (
        p_class_id,
        v_setting.id,
        case when v_previous.id is null then 'created' else 'replaced' end,
        case when v_previous.id is null then '{}'::jsonb else to_jsonb(v_previous) || jsonb_build_object('book_ids',v_preview->'previous_book_ids') end,
        to_jsonb(v_setting) || jsonb_build_object(
            'book_ids',v_preview->'next_book_ids',
            'term_label',btrim(p_term_label),
            'retained_student_count',(v_preview->>'retained_student_count')::integer,
            'retained_entitlement_count',v_entitlement_rows
        ),
        (v_preview->>'affected_student_count')::integer,
        (v_preview->>'affected_assignment_count')::integer,
        p_actor_id
    );

    return v_preview || jsonb_build_object(
        'preview',false,
        'setting',to_jsonb(v_setting),
        'term_label',btrim(p_term_label),
        'entitlement_rows_written',v_entitlement_rows
    );
end;
$$;

revoke all on function public.rollover_academy_class_materials(smallint,date,bigint[],text,bigint)
from public,anon,authenticated;
grant execute on function public.rollover_academy_class_materials(smallint,date,bigint[],text,bigint)
to service_role;

comment on function public.preview_academy_class_material_rollover(smallint,date,bigint[]) is
    'Previews the same-day class material rollover, including permanent old-book entitlements.';
comment on function public.rollover_academy_class_materials(smallint,date,bigint[],text,bigint) is
    'Atomically retains all historical books for overlapping enrollments, closes the old version and starts the new version.';
