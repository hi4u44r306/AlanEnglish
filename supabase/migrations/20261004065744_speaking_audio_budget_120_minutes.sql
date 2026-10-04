begin;
set local lock_timeout = '5s';

-- Owner approved 120 minutes/user and 100 hours/site on 2026-10-04.
-- Preserve all request usage; abort if another release changed the policy.
do $$
declare
    v_rows integer;
begin
    update public.speaking_audio_budget_policy
    set student_monthly_seconds = 7200,
        global_monthly_seconds = 360000,
        updated_at = now()
    where id = true
      and ((student_monthly_seconds = 3600 and global_monthly_seconds = 180000)
        or (student_monthly_seconds = 7200 and global_monthly_seconds = 360000));
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
        raise exception 'Unexpected speaking audio budget policy; no policy changed';
    end if;
end;
$$;

commit;
