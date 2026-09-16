begin;

drop index if exists public.speaking_question_sets_picture_template_active_unique;
drop index if exists public.speaking_question_sets_p23_p24_template_unique;

create unique index if not exists speaking_question_sets_picture_template_draft_unique
    on public.speaking_question_sets(book_id, (generation_metadata ->> 'template_key'))
    where status = 'draft'
      and generation_metadata ->> 'template_key' in (
          'workbook_1_p21_picture_qa_v1',
          'workbook_1_p22_picture_gap_v1',
          'workbook_1_p23_picture_gap_v1',
          'workbook_1_p24_picture_gap_v1'
      );

create unique index if not exists speaking_question_sets_picture_template_published_unique
    on public.speaking_question_sets(book_id, (generation_metadata ->> 'template_key'))
    where status = 'published'
      and generation_metadata ->> 'template_key' in (
          'workbook_1_p21_picture_qa_v1',
          'workbook_1_p22_picture_gap_v1',
          'workbook_1_p23_picture_gap_v1',
          'workbook_1_p24_picture_gap_v1'
      );

create or replace function public.publish_speaking_question_set_revision_v1(
    p_question_set_id bigint,
    p_reviewer_id bigint,
    p_expected_version integer,
    p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_draft public.speaking_question_sets%rowtype;
    v_previous public.speaking_question_sets%rowtype;
    v_old_question_count integer := 0;
    v_new_question_count integer := 0;
    v_now timestamptz := now();
begin
    select * into v_draft
    from public.speaking_question_sets
    where id = p_question_set_id
    for update;

    if not found
       or v_draft.status <> 'draft'
       or v_draft.version <> p_expected_version
       or v_draft.updated_at <> p_expected_updated_at then
        return jsonb_build_object('success', false, 'code', 'revision_conflict');
    end if;

    if v_draft.previous_set_id is null then
        return jsonb_build_object('success', false, 'code', 'previous_version_missing');
    end if;

    select * into v_previous
    from public.speaking_question_sets
    where id = v_draft.previous_set_id
    for update;

    if not found or v_previous.status <> 'published' then
        return jsonb_build_object('success', false, 'code', 'previous_version_not_published');
    end if;

    select count(*) into v_old_question_count
    from public.speaking_questions
    where question_set_id = v_previous.id;

    select count(*) into v_new_question_count
    from public.speaking_questions
    where question_set_id = v_draft.id;

    update public.speaking_question_sets
    set status = 'archived', updated_at = v_now
    where id = v_previous.id and status = 'published';

    update public.speaking_question_sets
    set status = 'published', reviewed_by = p_reviewer_id,
        published_at = v_now, updated_at = v_now
    where id = v_draft.id and status = 'draft';

    if v_old_question_count > 0 and v_new_question_count > 0 then
        insert into public.speaking_challenge_question_progress (
            student_id, question_set_id, question_id, status,
            opened_at, completed_at, updated_at
        )
        select completed_students.student_id, v_draft.id, new_question.id,
               'completed', v_now, v_now, v_now
        from (
            select progress.student_id
            from public.speaking_challenge_question_progress progress
            join public.speaking_questions old_question
              on old_question.id = progress.question_id
             and old_question.question_set_id = v_previous.id
            where progress.status = 'completed'
            group by progress.student_id
            having count(distinct progress.question_id) = v_old_question_count
        ) completed_students
        cross join public.speaking_questions new_question
        where new_question.question_set_id = v_draft.id
        on conflict (student_id, question_id) do nothing;
    end if;

    return jsonb_build_object(
        'success', true,
        'published_at', v_now,
        'archived_question_set_id', v_previous.id,
        'published_question_set_id', v_draft.id
    );
end;
$$;

revoke all on function public.publish_speaking_question_set_revision_v1(bigint, bigint, integer, timestamptz)
    from public, anon, authenticated;
grant execute on function public.publish_speaking_question_set_revision_v1(bigint, bigint, integer, timestamptz)
    to service_role;

comment on function public.publish_speaking_question_set_revision_v1(bigint, bigint, integer, timestamptz) is
    'Atomically publishes a reviewed speaking challenge revision, archives the previous live revision, and preserves unlock state for students who fully completed the previous revision.';

commit;
