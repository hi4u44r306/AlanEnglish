-- Self-practice mastery of a track now takes 30 server-validated listens instead of 10.
-- The reward itself (10 XP, 1 AE Point, once per track, 3 tracks per day) is unchanged,
-- and assignment listening keeps its own teacher-set count.
-- Rollback: run the same statements with 30 and 10 swapped.

do $$
declare
    v_constraint text;
    v_def text;
begin
    select c.conname into v_constraint
    from pg_constraint c
    where c.conrelid = 'public.student_track_mastery'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%valid_listen_count <= 10%';
    if v_constraint is not null then
        execute format('alter table public.student_track_mastery drop constraint %I', v_constraint);
        alter table public.student_track_mastery
            add constraint student_track_mastery_valid_listen_count_check
            check (valid_listen_count >= 0 and valid_listen_count <= 30);
    end if;

    -- Patch only the three threshold spots of the live function so the rest of the
    -- settlement logic stays exactly as deployed; CREATE OR REPLACE keeps owner and grants.
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complete_listening_reward_session_v3';
    if v_def is null then
        raise exception 'complete_listening_reward_session_v3 not found';
    end if;
    if v_def like '%least(30, m.valid_listen_count + 1)%' then
        return;
    end if;
    if v_def not like '%least(10, m.valid_listen_count + 1)%'
       or v_def not like '%if v_count >= 10 and v_mastery.rewarded_at is null%'
       or v_def not like '%音檔自主熟練 10 次%' then
        raise exception 'complete_listening_reward_session_v3 no longer matches the expected ten-listen definition';
    end if;
    v_def := replace(v_def, 'least(10, m.valid_listen_count + 1)', 'least(30, m.valid_listen_count + 1)');
    v_def := replace(v_def, 'if v_count >= 10 and v_mastery.rewarded_at is null', 'if v_count >= 30 and v_mastery.rewarded_at is null');
    v_def := replace(v_def, '音檔自主熟練 10 次', '音檔自主熟練 30 次');
    execute v_def;
end;
$$;
