-- Security before launch: tighten the elapsed-time guard of the V3 listening settlement.
--
-- Before: elapsed >= covered_seconds * 0.75 (already measured on covered seconds, not duration).
-- After:  elapsed >= greatest(covered_seconds * 0.75, covered_seconds * 0.9 - 6)
--   * acceleration is not allowed, so genuine listening of N covered seconds takes about N seconds;
--   * the 6 second grace absorbs the session-start network delay (coverage starts at "play",
--     started_at is stamped when the start request reaches the database) and Edge/DB clock skew;
--   * it is never stricter than the record-play Edge guard (0.9 * covered - 5) and never looser
--     than the old 0.75 floor, so the Edge check always decides first and this cannot turn a
--     request the Edge accepted into a 500.
-- Coverage ranges are still reported by the browser; only server heartbeats would fully fix that.
--
-- Only the single guard expression is patched in the live definition (same technique as
-- 20261011124017), so the deployed 30-listen mastery logic, owner and grants stay unchanged.
-- Safe to re-run: returns early when the new guard is already present.
--
-- Rollback: run the same block with the two expressions swapped, i.e. replace
--   'p_covered_seconds * 0.9 - 6)' guard text back with 'p_covered_seconds * 0.75'.

do $$
declare
    v_def text;
    v_old constant text := 'extract(epoch from now() - v_session.started_at) < p_covered_seconds * 0.75 then';
    v_new constant text := 'extract(epoch from now() - v_session.started_at) < greatest(p_covered_seconds * 0.75, p_covered_seconds * 0.9 - 6) then';
begin
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complete_listening_reward_session_v3';
    if v_def is null then
        raise exception 'complete_listening_reward_session_v3 not found';
    end if;
    if strpos(v_def, v_new) > 0 then
        return;
    end if;
    if strpos(v_def, v_old) = 0 then
        raise exception 'complete_listening_reward_session_v3 no longer matches the expected elapsed guard';
    end if;
    execute replace(v_def, v_old, v_new);
end;
$$;
