-- 單字大挑戰 伺服器版 v1（additive）：成績存到帳號，答對 8 題以上給 XP。
-- 只新增資料表與函式，不修改、不刪除任何既有資料或函式（唯一的例外：rollout 開關表的 key 清單多一項，見下方）。
-- 全部資料表開啟 RLS 並收回 anon／authenticated 權限；只有 Edge Function（service_role）能讀寫，
-- 前端一律透過 Edge Function。身分由 Edge Function 驗證 Firebase token 後取得 students.id，
-- 這裡的函式仍會再檢查一次學生身分。
-- 回復方式：停用 Edge Function／關閉 rollout 即可退回本機模式；本檔的表與函式可留著不用，不影響既有功能。

begin;
-- 等鎖超過 5 秒就放棄（整份還原），避免卡住聽力播放等正在使用 rollout 開關表的查詢。
set local lock_timeout = '5s';

-- 逐一開放開關：沿用 student_feature_rollouts（沒有資料列＝一律關閉）。
-- 做法和 assignment_v2 當時一樣：把允許的 feature_key 清單加一項。如果表裡已有清單以外的 key，這一步會失敗並整個還原，不會改到任何資料。
alter table public.student_feature_rollouts
    drop constraint if exists student_feature_rollouts_key_check;
alter table public.student_feature_rollouts
    add constraint student_feature_rollouts_key_check
    check (feature_key in ('listening_rewards_v2', 'assignment_v2', 'word_challenge_server_v1'));

-- 共用：只有「在學、未封存的學生」可以記成績與拿 XP。
create or replace function private.ae_word_challenge_student_ok(p_student_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select exists (
        select 1
        from public.students student
        where student.id = p_student_id
          and student.role = 'student'
          and student.archived_at is null
          and coalesce(student.account_status, 'active') <> 'archived'
    );
$$;

-- 每一輪一列。
create table if not exists public.word_challenge_rounds (
    id uuid primary key default gen_random_uuid(),
    student_id bigint not null references public.students(id) on delete cascade,
    bank_version text not null check (char_length(bank_version) between 1 and 16),
    level smallint not null check (level between 0 and 6),
    status text not null default 'open' check (status in ('open', 'finished')),
    question_count smallint not null check (question_count between 1 and 10),
    started_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '30 minutes'),
    finished_at timestamptz,
    activity_date date not null default ((now() at time zone 'Asia/Taipei')::date),
    correct_count smallint not null default 0 check (correct_count between 0 and 10),
    unhinted_correct_count smallint not null default 0 check (unhinted_correct_count between 0 and 10),
    -- 這一輪「第一次學會」的字數（沒用提示、以前從來沒學會過）；XP 門檻只看這個，反覆練同一批字不會再給 XP。
    new_mastered_count smallint not null default 0 check (new_mastered_count between 0 and 10),
    xp_awarded integer not null default 0 check (xp_awarded between 0 and 10)
);

create index if not exists word_challenge_rounds_student_started_idx
    on public.word_challenge_rounds (student_id, started_at desc);
create index if not exists word_challenge_rounds_student_date_idx
    on public.word_challenge_rounds (student_id, activity_date);

-- 每題一列，開局時一次建好；第一次送出答案就定案，不能改。
create table if not exists public.word_challenge_round_items (
    round_id uuid not null references public.word_challenge_rounds(id) on delete cascade,
    position smallint not null check (position between 0 and 9),
    word_key text not null check (char_length(word_key) between 1 and 64),
    hint_count smallint not null default 0 check (hint_count between 0 and 30),
    typed text check (typed is null or char_length(typed) <= 64),
    correct boolean,
    note text check (note is null or note in ('empty', 'capitalize', 'uk', 'synonym', 'oneLetter')),
    skipped boolean not null default false,
    newly_mastered boolean not null default false,
    answered_at timestamptz,
    primary key (round_id, position),
    unique (round_id, word_key)
);

-- 長期進度（每個學生每個字一列）。
create table if not exists public.student_word_progress (
    student_id bigint not null references public.students(id) on delete cascade,
    bank_version text not null check (char_length(bank_version) between 1 and 16),
    word_key text not null check (char_length(word_key) between 1 and 64),
    status text not null check (status in ('mastered', 'missed')),
    first_mastered_at timestamptz,
    last_correct_at timestamptz,
    last_missed_at timestamptz,
    correct_count integer not null default 0 check (correct_count >= 0),
    miss_count integer not null default 0 check (miss_count >= 0),
    updated_at timestamptz not null default now(),
    primary key (student_id, bank_version, word_key)
);

alter table public.word_challenge_rounds enable row level security;
alter table public.word_challenge_round_items enable row level security;
alter table public.student_word_progress enable row level security;

revoke all on table public.word_challenge_rounds from public, anon, authenticated;
revoke all on table public.word_challenge_round_items from public, anon, authenticated;
revoke all on table public.student_word_progress from public, anon, authenticated;
grant all on table public.word_challenge_rounds to service_role;
grant all on table public.word_challenge_round_items to service_role;
grant all on table public.student_word_progress to service_role;

-- 開一輪：伺服器選好的字一次寫入。每天最多開 60 輪，避免有人灌資料。
create or replace function public.start_word_challenge_round_v1(
    p_student_id bigint,
    p_bank_version text,
    p_level smallint,
    p_word_keys text[]
) returns table(round_id uuid, expires_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round_id uuid;
    v_expires timestamptz;
    v_count integer;
    v_today date := (now() at time zone 'Asia/Taipei')::date;
    v_rounds_today integer;
    v_index integer;
begin
    if not private.ae_word_challenge_student_ok(p_student_id) then
        raise exception 'WORD_CHALLENGE_STUDENT_NOT_ALLOWED';
    end if;
    if p_level is null or p_level < 0 or p_level > 6 then
        raise exception 'WORD_CHALLENGE_INVALID_LEVEL';
    end if;
    v_count := coalesce(array_length(p_word_keys, 1), 0);
    if v_count < 1 or v_count > 10 then
        raise exception 'WORD_CHALLENGE_INVALID_WORDS';
    end if;
    if (select count(distinct key) from unnest(p_word_keys) as key) <> v_count
       or exists (select 1 from unnest(p_word_keys) as key where key is null or char_length(key) not between 1 and 64) then
        raise exception 'WORD_CHALLENGE_INVALID_WORDS';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(concat('word-challenge-start:', p_student_id), 0));
    select count(*) into v_rounds_today
    from public.word_challenge_rounds round
    where round.student_id = p_student_id and round.activity_date = v_today;
    if v_rounds_today >= 60 then
        raise exception 'WORD_CHALLENGE_DAILY_ROUND_LIMIT';
    end if;

    insert into public.word_challenge_rounds (student_id, bank_version, level, question_count, activity_date)
    values (p_student_id, p_bank_version, p_level, v_count, v_today)
    returning id, public.word_challenge_rounds.expires_at into v_round_id, v_expires;

    for v_index in 1..v_count loop
        insert into public.word_challenge_round_items (round_id, position, word_key)
        values (v_round_id, v_index - 1, p_word_keys[v_index]);
    end loop;

    return query select v_round_id, v_expires;
end;
$$;

-- 提示：只有還沒作答、沒過期的題目可以加；p_max_hints 由 Edge Function 依字母數算好。
create or replace function public.reveal_word_challenge_hint_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_position smallint,
    p_max_hints integer
) returns smallint
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round public.word_challenge_rounds%rowtype;
    v_item public.word_challenge_round_items%rowtype;
    v_next smallint;
begin
    if not private.ae_word_challenge_student_ok(p_student_id) then
        raise exception 'WORD_CHALLENGE_STUDENT_NOT_ALLOWED';
    end if;
    select * into v_round from public.word_challenge_rounds round
    where round.id = p_round_id and round.student_id = p_student_id;
    if not found then raise exception 'WORD_CHALLENGE_ROUND_NOT_FOUND'; end if;
    if v_round.status <> 'open' then raise exception 'WORD_CHALLENGE_ROUND_CLOSED'; end if;
    if v_round.expires_at <= now() then raise exception 'WORD_CHALLENGE_ROUND_EXPIRED'; end if;

    select * into v_item from public.word_challenge_round_items item
    where item.round_id = p_round_id and item.position = p_position
    for update;
    if not found then raise exception 'WORD_CHALLENGE_ITEM_NOT_FOUND'; end if;
    if v_item.answered_at is not null then raise exception 'WORD_CHALLENGE_ALREADY_ANSWERED'; end if;

    v_next := least(v_item.hint_count + 1, greatest(coalesce(p_max_hints, 0), 0))::smallint;
    update public.word_challenge_round_items item
    set hint_count = v_next
    where item.round_id = p_round_id and item.position = p_position;
    return v_next;
end;
$$;

-- 送出一題答案：第一次送出就定案；重送只會拿回原本存的結果（不會重新判斷，所以無法反覆改到對）。
-- 對錯由 Edge Function 用伺服器版判斷規則算好後傳進來；這裡負責驗證回合歸屬、期限並寫入。
create or replace function public.record_word_challenge_answer_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_position smallint,
    p_typed text,
    p_correct boolean,
    p_note text,
    p_skipped boolean
) returns table(correct boolean, note text, skipped boolean, hint_count smallint, already_answered boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round public.word_challenge_rounds%rowtype;
    v_item public.word_challenge_round_items%rowtype;
    v_correct boolean := coalesce(p_correct, false) and not coalesce(p_skipped, false);
    v_now timestamptz := now();
    v_new boolean := false;
begin
    if not private.ae_word_challenge_student_ok(p_student_id) then
        raise exception 'WORD_CHALLENGE_STUDENT_NOT_ALLOWED';
    end if;
    select * into v_round from public.word_challenge_rounds round
    where round.id = p_round_id and round.student_id = p_student_id;
    if not found then raise exception 'WORD_CHALLENGE_ROUND_NOT_FOUND'; end if;

    select * into v_item from public.word_challenge_round_items item
    where item.round_id = p_round_id and item.position = p_position
    for update;
    if not found then raise exception 'WORD_CHALLENGE_ITEM_NOT_FOUND'; end if;

    -- 已經作答：直接回傳當時的結果，不論回合是否已結束。
    if v_item.answered_at is not null then
        return query select v_item.correct, v_item.note, v_item.skipped, v_item.hint_count, true;
        return;
    end if;
    if v_round.status <> 'open' then raise exception 'WORD_CHALLENGE_ROUND_CLOSED'; end if;
    if v_round.expires_at <= v_now then raise exception 'WORD_CHALLENGE_ROUND_EXPIRED'; end if;
    if p_note is not null and p_note not in ('empty', 'capitalize', 'uk', 'synonym', 'oneLetter') then
        raise exception 'WORD_CHALLENGE_INVALID_NOTE';
    end if;

    -- 「第一次學會」：沒用提示答對，而且這個字以前從來沒有學會過（答錯後再學會算第一次；學會過又答錯再學會不算）。
    if v_correct and v_item.hint_count = 0 then
        v_new := not exists (
            select 1 from public.student_word_progress prior
            where prior.student_id = p_student_id and prior.bank_version = v_round.bank_version
              and prior.word_key = v_item.word_key and prior.first_mastered_at is not null
        );
    end if;

    update public.word_challenge_round_items item
    set typed = left(coalesce(p_typed, ''), 64),
        correct = v_correct,
        note = p_note,
        skipped = coalesce(p_skipped, false),
        newly_mastered = v_new,
        answered_at = v_now
    where item.round_id = p_round_id and item.position = p_position;

    -- 長期進度：答對且沒用提示 → 已會；答錯或跳過 → 要複習。用了提示的答對不改變狀態。
    if v_correct and v_item.hint_count = 0 then
        insert into public.student_word_progress as progress (
            student_id, bank_version, word_key, status, first_mastered_at, last_correct_at, correct_count
        ) values (
            p_student_id, v_round.bank_version, v_item.word_key, 'mastered', v_now, v_now, 1
        )
        on conflict (student_id, bank_version, word_key) do update
        set status = 'mastered',
            first_mastered_at = coalesce(progress.first_mastered_at, v_now),
            last_correct_at = v_now,
            correct_count = progress.correct_count + 1,
            updated_at = v_now;
    elsif not v_correct then
        insert into public.student_word_progress as progress (
            student_id, bank_version, word_key, status, last_missed_at, miss_count
        ) values (
            p_student_id, v_round.bank_version, v_item.word_key, 'missed', v_now, 1
        )
        on conflict (student_id, bank_version, word_key) do update
        set status = 'missed',
            last_missed_at = v_now,
            miss_count = progress.miss_count + 1,
            updated_at = v_now;
    end if;

    return query select v_correct, p_note, coalesce(p_skipped, false), v_item.hint_count, false;
end;
$$;

-- 結算一輪：題數由資料庫的作答紀錄算，不看前端。已結算就回傳原結果，XP 最多發一次。
-- XP 規則（擁有者 2026-11-12 決定，防止查答案刷 XP）：一輪「第一次學會」的新字（沒用提示）≥ 8 個給 10 XP；練錯的字那輪不給；單字每天最多 30 XP。
create or replace function public.finish_word_challenge_round_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_award_xp boolean default true
) returns table(
    total_questions integer,
    correct_count integer,
    unhinted_correct_count integer,
    xp_awarded integer,
    already_finished boolean,
    total_xp integer,
    new_mastered_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round public.word_challenge_rounds%rowtype;
    v_total integer;
    v_answered integer;
    v_correct integer;
    v_unhinted integer;
    v_new_mastered integer;
    v_xp integer := 0;
    v_xp_today integer := 0;
    v_start timestamptz;
    v_granted boolean := false;
    v_balance integer := 0;
begin
    if not private.ae_word_challenge_student_ok(p_student_id) then
        raise exception 'WORD_CHALLENGE_STUDENT_NOT_ALLOWED';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(concat('word-challenge-rewards:', p_student_id), 0));

    select * into v_round from public.word_challenge_rounds round
    where round.id = p_round_id and round.student_id = p_student_id
    for update;
    if not found then raise exception 'WORD_CHALLENGE_ROUND_NOT_FOUND'; end if;

    if v_round.status = 'finished' then
        select coalesce(b.total_xp, 0) into v_balance
        from public.student_gamification_balances b where b.student_id = p_student_id;
        return query select v_round.question_count::integer, v_round.correct_count::integer,
            v_round.unhinted_correct_count::integer, v_round.xp_awarded, true, coalesce(v_balance, 0), v_round.new_mastered_count::integer;
        return;
    end if;

    select count(*)::integer,
           count(*) filter (where item.answered_at is not null)::integer,
           count(*) filter (where item.correct is true)::integer,
           count(*) filter (where item.correct is true and item.hint_count = 0)::integer,
           count(*) filter (where item.newly_mastered is true)::integer
    into v_total, v_answered, v_correct, v_unhinted, v_new_mastered
    from public.word_challenge_round_items item
    where item.round_id = p_round_id;

    if v_answered < v_total then
        raise exception 'WORD_CHALLENGE_ROUND_INCOMPLETE';
    end if;

    -- 最後一題在期限內答完才給 XP（看成績按晚了不影響）；過期只結算成績。
    if coalesce(p_award_xp, false)
       and (select max(item.answered_at) from public.word_challenge_round_items item where item.round_id = p_round_id) <= v_round.expires_at
       and v_round.level between 1 and 6
       and v_new_mastered >= 8 then
        v_start := (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei');
        select coalesce(sum(coalesce((ledger.metadata->>'base_xp')::integer, ledger.xp_delta)), 0)::integer
        into v_xp_today
        from public.student_gamification_ledger ledger
        where ledger.student_id = p_student_id
          and ledger.source_type = 'word_challenge'
          and ledger.created_at >= v_start;
        v_xp := least(10, greatest(0, 30 - v_xp_today));
        if v_xp > 0 then
            v_granted := private.ae_gamification_grant_v2(
                p_student_id,
                v_xp,
                0,
                'word_challenge',
                concat('round:', p_round_id),
                '單字大挑戰：學會 8 個新字',
                jsonb_build_object('round_id', p_round_id, 'level', v_round.level, 'unhinted_correct', v_unhinted, 'new_mastered', v_new_mastered)
            );
            if not v_granted then v_xp := 0; end if;
        end if;
    end if;

    update public.word_challenge_rounds round
    set status = 'finished',
        finished_at = now(),
        correct_count = v_correct,
        unhinted_correct_count = v_unhinted,
        new_mastered_count = v_new_mastered,
        xp_awarded = v_xp
    where round.id = p_round_id;

    select coalesce(b.total_xp, 0) into v_balance
    from public.student_gamification_balances b where b.student_id = p_student_id;

    return query select v_total, v_correct, v_unhinted, v_xp, false, coalesce(v_balance, 0), v_new_mastered;
end;
$$;

-- 進度摘要：已會、要複習的字、每級最佳分、今天已拿 XP。
create or replace function public.get_word_challenge_summary_v1(
    p_student_id bigint,
    p_bank_version text
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
    v_start timestamptz := (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei');
begin
    if not private.ae_word_challenge_student_ok(p_student_id) then
        raise exception 'WORD_CHALLENGE_STUDENT_NOT_ALLOWED';
    end if;
    return jsonb_build_object(
        'mastered', coalesce((
            select jsonb_agg(progress.word_key order by progress.word_key)
            from public.student_word_progress progress
            where progress.student_id = p_student_id and progress.bank_version = p_bank_version and progress.status = 'mastered'
        ), '[]'::jsonb),
        'missed', coalesce((
            select jsonb_agg(progress.word_key order by progress.last_missed_at desc nulls last)
            from public.student_word_progress progress
            where progress.student_id = p_student_id and progress.bank_version = p_bank_version and progress.status = 'missed'
        ), '[]'::jsonb),
        'best', coalesce((
            select jsonb_object_agg(best.level::text, best.top)
            from (
                select round.level, max(round.correct_count) as top
                from public.word_challenge_rounds round
                where round.student_id = p_student_id and round.bank_version = p_bank_version
                  and round.status = 'finished' and round.level between 1 and 6
                group by round.level
            ) best
        ), '{}'::jsonb),
        'xp_today', coalesce((
            select sum(coalesce((ledger.metadata->>'base_xp')::integer, ledger.xp_delta))::integer
            from public.student_gamification_ledger ledger
            where ledger.student_id = p_student_id and ledger.source_type = 'word_challenge' and ledger.created_at >= v_start
        ), 0)
    );
end;
$$;

revoke all on function private.ae_word_challenge_student_ok(bigint) from public, anon, authenticated;
grant execute on function private.ae_word_challenge_student_ok(bigint) to service_role;

revoke all on function public.start_word_challenge_round_v1(bigint, text, smallint, text[]) from public, anon, authenticated;
grant execute on function public.start_word_challenge_round_v1(bigint, text, smallint, text[]) to service_role;
revoke all on function public.reveal_word_challenge_hint_v1(bigint, uuid, smallint, integer) from public, anon, authenticated;
grant execute on function public.reveal_word_challenge_hint_v1(bigint, uuid, smallint, integer) to service_role;
revoke all on function public.record_word_challenge_answer_v1(bigint, uuid, smallint, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.record_word_challenge_answer_v1(bigint, uuid, smallint, text, boolean, text, boolean) to service_role;
revoke all on function public.finish_word_challenge_round_v1(bigint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.finish_word_challenge_round_v1(bigint, uuid, boolean) to service_role;
revoke all on function public.get_word_challenge_summary_v1(bigint, text) from public, anon, authenticated;
grant execute on function public.get_word_challenge_summary_v1(bigint, text) to service_role;

commit;
