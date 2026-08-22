begin;

-- =========================================================
-- Alan English - Phase 03B
-- Cover placement foreign keys with indexes
-- =========================================================

-- academy_placement_cycles actor references
create index if not exists academy_placement_cycles_created_by_idx
    on public.academy_placement_cycles (created_by);

create index if not exists academy_placement_cycles_approved_by_idx
    on public.academy_placement_cycles (approved_by);

create index if not exists academy_placement_cycles_applied_by_idx
    on public.academy_placement_cycles (applied_by);

-- academy_placement_decisions references not already covered by a
-- unique or query-specific index from Phase 03A.
create index if not exists academy_placement_decisions_enrollment_idx
    on public.academy_placement_decisions (enrollment_id);

create index if not exists academy_placement_decisions_from_class_idx
    on public.academy_placement_decisions (from_class_id);

create index if not exists academy_placement_decisions_to_class_idx
    on public.academy_placement_decisions (to_class_id);

create index if not exists academy_placement_decisions_decided_by_idx
    on public.academy_placement_decisions (decided_by);

-- academy_class_movement_history references not already covered by a
-- unique or query-specific index from Phase 03A.
create index if not exists academy_class_movement_history_enrollment_idx
    on public.academy_class_movement_history (enrollment_id);

create index if not exists academy_class_movement_history_from_class_idx
    on public.academy_class_movement_history (from_class_id);

create index if not exists academy_class_movement_history_to_class_idx
    on public.academy_class_movement_history (to_class_id);

create index if not exists academy_class_movement_history_changed_by_idx
    on public.academy_class_movement_history (changed_by);

commit;

select count(*) as placement_fk_index_count
from pg_indexes
where schemaname = 'public'
  and indexname in (
      'academy_placement_cycles_created_by_idx',
      'academy_placement_cycles_approved_by_idx',
      'academy_placement_cycles_applied_by_idx',
      'academy_placement_decisions_enrollment_idx',
      'academy_placement_decisions_from_class_idx',
      'academy_placement_decisions_to_class_idx',
      'academy_placement_decisions_decided_by_idx',
      'academy_class_movement_history_enrollment_idx',
      'academy_class_movement_history_from_class_idx',
      'academy_class_movement_history_to_class_idx',
      'academy_class_movement_history_changed_by_idx'
  );
