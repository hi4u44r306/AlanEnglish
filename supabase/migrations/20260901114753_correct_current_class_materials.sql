-- Administrators may correct a material version created today without creating
-- overlapping same-day versions. Every correction is atomic and audited.

alter table public.academy_class_material_audit_log
    drop constraint if exists academy_class_material_audit_log_action_check;
alter table public.academy_class_material_audit_log
    add constraint academy_class_material_audit_log_action_check
    check(action in ('created','activated','replaced','deactivated','corrected'));

create or replace function public.preview_academy_class_material_correction(
    p_class_id smallint,
    p_setting_id bigint,
    p_book_ids bigint[],
    p_term_label text
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
    v_today date := (now() at time zone 'Asia/Taipei')::date;
    v_class public.academy_classes%rowtype;
    v_setting public.academy_class_material_settings%rowtype;
    v_book_ids bigint[];
    v_previous_book_ids bigint[] := '{}'::bigint[];
    v_added_book_ids bigint[] := '{}'::bigint[];
    v_removed_book_ids bigint[] := '{}'::bigint[];
    v_active_student_count integer := 0;
    v_assignment_count integer := 0;
    v_term_label text;
begin
    v_term_label := nullif(btrim(coalesce(p_term_label,'')),'');
    if v_term_label is null then
        raise exception using message='請填寫學期名稱', errcode='23514';
    end if;

    select * into v_class
    from public.academy_classes
    where id=p_class_id and code in ('E1','E3','E5','E7') and is_active
    for share;
    if not found then
        raise exception using message='班級不存在或已停用', errcode='P0002';
    end if;

    select * into v_setting
    from public.academy_class_material_settings s
    where s.id=p_setting_id
      and s.class_id=p_class_id
      and s.is_active
      and s.effective_from=v_today
      and (s.effective_to is null or s.effective_to>=v_today)
    for share;
    if not found then
        raise exception using message='只有今天建立且目前生效的教材版本可以直接修正', errcode='23514';
    end if;

    select coalesce(array_agg(distinct selected.book_id order by selected.book_id),'{}'::bigint[])
    into v_book_ids
    from unnest(coalesce(p_book_ids,'{}'::bigint[])) as selected(book_id)
    where selected.book_id is not null;
    if cardinality(v_book_ids)=0 then
        raise exception using message='目前版本至少需要選擇一本教材', errcode='23514';
    end if;
    if (select count(*) from public.books b where b.id=any(v_book_ids) and b.enabled and b.archived_at is null)
       <>cardinality(v_book_ids) then
        raise exception using message='包含不存在或已停用的教材', errcode='23514';
    end if;

    select coalesce(array_agg(book_id order by book_id),'{}'::bigint[])
    into v_previous_book_ids
    from public.academy_class_material_books
    where setting_id=v_setting.id;

    select coalesce(array_agg(selected.id order by selected.id),'{}'::bigint[])
    into v_added_book_ids
    from unnest(v_book_ids) as selected(id)
    where not (selected.id=any(v_previous_book_ids));

    select coalesce(array_agg(selected.id order by selected.id),'{}'::bigint[])
    into v_removed_book_ids
    from unnest(v_previous_book_ids) as selected(id)
    where not (selected.id=any(v_book_ids));

    select count(distinct e.student_id)
    into v_active_student_count
    from public.academy_enrollments e
    where e.class_id=p_class_id
      and e.status='active'
      and e.enrolled_at<=v_today
      and (e.access_ends_at is null or e.access_ends_at>=v_today)
      and (e.scheduled_departure_at is null or e.scheduled_departure_at>v_today);

    select count(*) into v_assignment_count
    from public.assignments a
    where a.class_material_setting_id=v_setting.id
      and a.enabled
      and (a.due_at is null or a.due_at>=now());

    return jsonb_build_object(
        'preview',true,
        'correction',true,
        'class_id',v_class.id,
        'class_code',v_class.code,
        'setting_id',v_setting.id,
        'version',v_setting.version,
        'setting_updated_at',v_setting.updated_at,
        'effective_from',v_setting.effective_from,
        'previous_term_label',coalesce(v_setting.note,''),
        'next_term_label',v_term_label,
        'previous_book_ids',v_previous_book_ids,
        'next_book_ids',v_book_ids,
        'added_book_ids',v_added_book_ids,
        'removed_book_ids',v_removed_book_ids,
        'affected_student_count',v_active_student_count,
        'affected_assignment_count',v_assignment_count,
        'has_changes',v_previous_book_ids<>v_book_ids or coalesce(v_setting.note,'')<>v_term_label
    );
end;
$$;

revoke all on function public.preview_academy_class_material_correction(smallint,bigint,bigint[],text)
from public,anon,authenticated;
grant execute on function public.preview_academy_class_material_correction(smallint,bigint,bigint[],text)
to service_role;

create or replace function public.correct_academy_class_materials(
    p_class_id smallint,
    p_setting_id bigint,
    p_book_ids bigint[],
    p_term_label text,
    p_actor_id bigint,
    p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
    v_today date := (now() at time zone 'Asia/Taipei')::date;
    v_actor public.students%rowtype;
    v_setting public.academy_class_material_settings%rowtype;
    v_previous_snapshot jsonb;
    v_preview jsonb;
    v_book_ids bigint[];
begin
    select * into v_actor
    from public.students
    where id=p_actor_id and role='admin' and coalesce(account_status,'active')='active'
    for share;
    if not found then
        raise exception using message='只有有效的管理員可以修正班級教材', errcode='42501';
    end if;
    if p_expected_updated_at is null then
        raise exception using message='請重新預覽目前版本後再確認修正', errcode='23514';
    end if;

    perform pg_advisory_xact_lock(8137,p_class_id::integer);

    select * into v_setting
    from public.academy_class_material_settings s
    where s.id=p_setting_id
      and s.class_id=p_class_id
      and s.is_active
      and s.effective_from=v_today
      and (s.effective_to is null or s.effective_to>=v_today)
    for update;
    if not found then
        raise exception using message='只有今天建立且目前生效的教材版本可以直接修正', errcode='23514';
    end if;
    if v_setting.updated_at is distinct from p_expected_updated_at then
        raise exception using message='目前版本已被其他操作更新，請重新預覽後再確認', errcode='40001';
    end if;

    v_preview := public.preview_academy_class_material_correction(
        p_class_id,p_setting_id,p_book_ids,p_term_label
    );
    if not coalesce((v_preview->>'has_changes')::boolean,false) then
        raise exception using message='目前版本沒有需要修正的內容', errcode='23514';
    end if;

    select coalesce(array_agg(distinct selected.book_id order by selected.book_id),'{}'::bigint[])
    into v_book_ids
    from unnest(p_book_ids) as selected(book_id)
    where selected.book_id is not null;

    v_previous_snapshot := to_jsonb(v_setting) || jsonb_build_object(
        'book_ids',v_preview->'previous_book_ids',
        'term_label',v_preview->>'previous_term_label'
    );

    delete from public.academy_class_material_books
    where setting_id=v_setting.id;

    insert into public.academy_class_material_books(setting_id,book_id,sort_order)
    select v_setting.id,value,ordinality-1
    from unnest(v_book_ids) with ordinality selected(value,ordinality);

    update public.academy_class_material_settings
    set note=left(btrim(p_term_label),500),updated_by=p_actor_id,updated_at=now()
    where id=v_setting.id
    returning * into v_setting;

    insert into public.academy_class_material_audit_log(
        class_id,setting_id,action,previous_snapshot,next_snapshot,
        affected_student_count,affected_assignment_count,created_by
    ) values (
        p_class_id,
        v_setting.id,
        'corrected',
        v_previous_snapshot,
        to_jsonb(v_setting) || jsonb_build_object(
            'book_ids',v_preview->'next_book_ids',
            'term_label',btrim(p_term_label)
        ),
        (v_preview->>'affected_student_count')::integer,
        (v_preview->>'affected_assignment_count')::integer,
        p_actor_id
    );

    return v_preview || jsonb_build_object(
        'preview',false,
        'correction',true,
        'setting',to_jsonb(v_setting)
    );
end;
$$;

revoke all on function public.correct_academy_class_materials(smallint,bigint,bigint[],text,bigint,timestamptz)
from public,anon,authenticated;
grant execute on function public.correct_academy_class_materials(smallint,bigint,bigint[],text,bigint,timestamptz)
to service_role;

comment on function public.preview_academy_class_material_correction(smallint,bigint,bigint[],text) is
    'Previews a correction to the currently active material version created today.';
comment on function public.correct_academy_class_materials(smallint,bigint,bigint[],text,bigint,timestamptz) is
    'Atomically corrects today''s active material version and records before/after audit snapshots.';
