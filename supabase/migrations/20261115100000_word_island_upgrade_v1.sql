-- 單字島「升級」：已佔領的格子，隔天（不同天）再答對同一個字，就升級一次（0 剛佔領 → 1 繁榮）。
-- 擁有者 2026-11-16 決定：兩段式；每塊每天最多升一次、沒有全帳號每日上限；不倒退。
-- 全部是新增欄位與新函式，不動既有資料、不改既有函式。

alter table public.student_word_progress
    add column if not exists upgrade_level smallint not null default 0 check (upgrade_level between 0 and 1),
    add column if not exists last_upgraded_on date;

-- 升級：只有「這一輪這一題剛答對、沒用提示、而且這個字早就佔領過」才有可能升。
-- 條件都在資料庫裡一次檢查（不同天、每格每天一次、沒用提示），前端傳什麼都不算數。
create or replace function public.upgrade_word_island_tile_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_position smallint
) returns table(upgraded boolean, upgrade_level smallint, upgrades_today integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round public.word_challenge_rounds%rowtype;
    v_item public.word_challenge_round_items%rowtype;
    v_progress public.student_word_progress%rowtype;
    v_today date := (now() at time zone 'Asia/Taipei')::date;
    v_count integer;
begin
    if not private.ae_word_challenge_student_ok(p_student_id) then
        raise exception 'WORD_CHALLENGE_STUDENT_NOT_ALLOWED';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(concat('word-island-upgrade:', p_student_id), 0));

    select * into v_round from public.word_challenge_rounds r
    where r.id = p_round_id and r.student_id = p_student_id;
    if not found then raise exception 'WORD_CHALLENGE_ROUND_NOT_FOUND'; end if;
    select * into v_item from public.word_challenge_round_items i
    where i.round_id = p_round_id and i.position = p_position;
    if not found then raise exception 'WORD_CHALLENGE_ITEM_NOT_FOUND'; end if;

    select * into v_progress from public.student_word_progress p
    where p.student_id = p_student_id and p.bank_version = v_round.bank_version and p.word_key = v_item.word_key
    for update;

    select count(*)::integer into v_count from public.student_word_progress p
    where p.student_id = p_student_id and p.bank_version = v_round.bank_version and p.last_upgraded_on = v_today;

    if v_progress.word_key is not null
        and v_item.answered_at is not null
        and v_item.correct is true
        and v_item.hint_count = 0
        and coalesce(v_item.newly_mastered, false) = false
        and v_progress.first_mastered_at is not null
        and (v_progress.first_mastered_at at time zone 'Asia/Taipei')::date < v_today
        and v_progress.upgrade_level < 1
        and (v_progress.last_upgraded_on is null or v_progress.last_upgraded_on < v_today)
    then
        update public.student_word_progress p
        set upgrade_level = p.upgrade_level + 1,
            last_upgraded_on = v_today,
            updated_at = now()
        where p.student_id = p_student_id and p.bank_version = v_round.bank_version and p.word_key = v_item.word_key;
        return query select true, (v_progress.upgrade_level + 1)::smallint, v_count + 1;
    else
        return query select false, coalesce(v_progress.upgrade_level, 0)::smallint, v_count;
    end if;
end;
$$;

revoke all on function public.upgrade_word_island_tile_v1(bigint, uuid, smallint) from public, anon, authenticated;
grant execute on function public.upgrade_word_island_tile_v1(bigint, uuid, smallint) to service_role;
