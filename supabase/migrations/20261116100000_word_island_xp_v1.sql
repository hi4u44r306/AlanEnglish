-- 單字島 XP：佔領一塊新地 +2 XP、地塊升級 +3 XP；單字島每天最多 30 XP（用發獎紀錄計算）。
-- 全部是新函式，不動既有資料與既有函式。XP 一律在資料庫裡檢查（答對、沒用提示、真的是新佔領或剛升級），
-- 同一輪同一題只會發一次（用 source_key 防重複）。
create or replace function public.award_word_island_xp_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_position smallint,
    p_kind text
) returns table(xp_awarded integer, xp_before integer, total_xp integer, daily_xp integer, daily_cap integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round public.word_challenge_rounds%rowtype;
    v_item public.word_challenge_round_items%rowtype;
    v_progress public.student_word_progress%rowtype;
    v_today date := (now() at time zone 'Asia/Taipei')::date;
    v_start timestamptz := (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei');
    v_cap constant integer := 30;
    v_base integer;
    v_today_xp integer := 0;
    v_xp integer := 0;
    v_before integer := 0;
    v_after integer := 0;
    v_ok boolean := false;
begin
    if p_kind not in ('claim', 'upgrade') then raise exception 'WORD_ISLAND_XP_KIND_INVALID'; end if;
    if not private.ae_word_challenge_student_ok(p_student_id) then
        raise exception 'WORD_CHALLENGE_STUDENT_NOT_ALLOWED';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(concat('word-island-xp:', p_student_id), 0));

    select * into v_round from public.word_challenge_rounds r
    where r.id = p_round_id and r.student_id = p_student_id;
    if not found then raise exception 'WORD_CHALLENGE_ROUND_NOT_FOUND'; end if;
    select * into v_item from public.word_challenge_round_items i
    where i.round_id = p_round_id and i.position = p_position;
    if not found then raise exception 'WORD_CHALLENGE_ITEM_NOT_FOUND'; end if;
    select * into v_progress from public.student_word_progress p
    where p.student_id = p_student_id and p.bank_version = v_round.bank_version and p.word_key = v_item.word_key;

    v_base := case p_kind when 'claim' then 2 else 3 end;
    if v_item.answered_at is not null and v_item.correct is true and v_item.hint_count = 0 then
        if p_kind = 'claim' then
            v_ok := coalesce(v_item.newly_mastered, false);
        else
            v_ok := not coalesce(v_item.newly_mastered, false)
                and v_progress.upgrade_level >= 1
                and v_progress.last_upgraded_on = v_today;
        end if;
    end if;

    select coalesce(b.total_xp, 0) into v_before
    from public.student_gamification_balances b where b.student_id = p_student_id;
    v_before := coalesce(v_before, 0);

    select coalesce(sum(coalesce((l.metadata->>'base_xp')::integer, l.xp_delta)), 0)::integer into v_today_xp
    from public.student_gamification_ledger l
    where l.student_id = p_student_id and l.source_type = 'word_island' and l.created_at >= v_start;

    if v_ok then
        v_xp := least(v_base, greatest(0, v_cap - v_today_xp));
        if v_xp > 0 then
            if not private.ae_gamification_grant_v2(
                p_student_id, v_xp, 0, 'word_island',
                concat(p_kind, ':', p_round_id, ':', p_position),
                case p_kind when 'claim' then '單字島：佔領新地塊' else '單字島：地塊升級' end,
                jsonb_build_object('round_id', p_round_id, 'kind', p_kind, 'word_key', v_item.word_key)
            ) then
                v_xp := 0;
            end if;
        end if;
    end if;

    select coalesce(b.total_xp, 0) into v_after
    from public.student_gamification_balances b where b.student_id = p_student_id;
    v_after := coalesce(v_after, 0);

    return query select v_xp, v_before, v_after, v_today_xp + v_xp, v_cap;
end;
$$;

revoke all on function public.award_word_island_xp_v1(bigint, uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.award_word_island_xp_v1(bigint, uuid, smallint, text) to service_role;
