-- AE Points are switched off: the prize shop is closed, so nothing should earn points.
--
-- Every grant path (listening, mastery, assignment completion, speaking challenges, games,
-- birthday gifts and level-up bonuses) asks this one function whether a student may earn
-- points, and clamps positive point deltas to zero when it says no. Answering "no" for
-- everyone stops new AE Points while XP, levels, the ledger and existing balances are left
-- exactly as they are. No rows are changed or removed.
--
-- To switch points back on, restore the previous body:
--
--   select exists (
--       select 1
--       from public.students student
--       join public.academy_enrollments enrollment
--         on enrollment.student_id = student.id
--        and enrollment.status = 'active'
--       where student.id = p_student_id
--         and student.role = 'student'
--         and student.learner_type = 'academy_student'
--         and student.archived_at is null
--         and coalesce(student.account_status, 'active') <> 'archived'
--   );
create or replace function private.ae_student_can_earn_points(p_student_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select false;
$$;

revoke all on function private.ae_student_can_earn_points(bigint)
    from public, anon, authenticated;
grant execute on function private.ae_student_can_earn_points(bigint)
    to service_role;
