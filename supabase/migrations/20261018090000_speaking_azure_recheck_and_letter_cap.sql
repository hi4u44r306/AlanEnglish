-- 口說 Azure 費用分兩個上限（擁有者 2026-10-18 決定，每人每月全部服務約 NT$35）：
-- 1. 字母（A–Z）與拼字：每人每月 2250 秒（約 NT$20，以 US$1／音訊小時、匯率 32 估算）。
-- 2. 句子「再確認」：本機判沒過但只差一點時，把同一段錄音送 Azure；每人每月 600 秒、每天 5 次、同題每天 2 次。
-- 再確認預設關閉（recheck_mode='off'），可先開給 staff 試用，再開給 all；關掉即時生效，不用重新部署。
-- Additive only: no existing row is changed or deleted.

create table public.speaking_azure_cost_policy (
    id boolean primary key default true check (id),
    recheck_mode text not null default 'off' check (recheck_mode in ('off', 'staff', 'all')),
    recheck_student_daily integer not null default 5 check (recheck_student_daily between 0 and 50),
    recheck_per_question_daily integer not null default 2 check (recheck_per_question_daily between 0 and 10),
    recheck_student_monthly_seconds integer not null default 600 check (recheck_student_monthly_seconds between 0 and 3600),
    letters_student_monthly_seconds integer not null default 2250 check (letters_student_monthly_seconds between 0 and 7200),
    updated_at timestamptz not null default now()
);
insert into public.speaking_azure_cost_policy (id) values (true);
alter table public.speaking_azure_cost_policy enable row level security;
revoke all on public.speaking_azure_cost_policy from public, anon, authenticated;
grant select, update on public.speaking_azure_cost_policy to service_role;

-- 再確認那一筆評分指向本機那一筆；同一筆本機評分只能再確認一次。
alter table public.speaking_pronunciation_attempts
    add column recheck_of_attempt_id bigint references public.speaking_pronunciation_attempts(id) on delete set null;
create unique index speaking_pronunciation_attempts_recheck_of_key
    on public.speaking_pronunciation_attempts (recheck_of_attempt_id) where recheck_of_attempt_id is not null;

alter table public.speaking_pronunciation_requests
    add column recheck_of_attempt_id bigint references public.speaking_pronunciation_attempts(id) on delete set null;
create unique index speaking_pronunciation_requests_recheck_of_key
    on public.speaking_pronunciation_requests (recheck_of_attempt_id) where recheck_of_attempt_id is not null;
create index speaking_pronunciation_requests_provider_student_created_idx
    on public.speaking_pronunciation_requests (provider, student_id, created_at);

-- 字母與拼字本月已用秒數（兩者 provider 都是 azure_alphabet_basic）。
create or replace function public.speaking_letter_month_seconds_v1(p_student_id bigint)
returns integer language sql stable set search_path to '' as $$
    select coalesce(sum(coalesce(audio_seconds, 12)), 0)::integer
    from public.speaking_pronunciation_requests
    where student_id = p_student_id and provider = 'azure_alphabet_basic'
      and created_at >= date_trunc('month', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
$$;
revoke all on function public.speaking_letter_month_seconds_v1(bigint) from public, anon, authenticated;
grant execute on function public.speaking_letter_month_seconds_v1(bigint) to service_role;

-- A–Z：與線上版本相同，只多每月秒數上限。
create or replace function public.reserve_speaking_azure_alphabet_request_v1(p_student_id bigint, p_question_set_id bigint, p_question_id bigint, p_audio_seconds integer, p_client_session_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare v_usage jsonb; v_id uuid; v_count integer; v_letter text; v_used integer := 0;
 v_day date := (now() at time zone 'Asia/Taipei')::date; v_cap integer;
begin
 if p_student_id is null or p_audio_seconds is null or p_audio_seconds not between 1 and 12 then raise exception 'INVALID_ALPHABET_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended('speaking-alphabet:' || p_student_id::text,0));
 select upper(trim(q.model_answer)) into v_letter from public.speaking_questions q join public.speaking_question_sets s on s.id=q.question_set_id
 where q.id=p_question_id and s.id=p_question_set_id and s.status='published' and s.generation_metadata->>'interaction_type'='alphabet_round';
 if v_letter is null or v_letter !~ '^[A-Z]$' then raise exception 'ALPHABET_QUESTION_REQUIRED'; end if;
 select letters_student_monthly_seconds into v_cap from public.speaking_azure_cost_policy where id;
 if v_cap is not null and public.speaking_letter_month_seconds_v1(p_student_id) + p_audio_seconds > v_cap then
  return jsonb_build_object('allowed',false,'code','letter_monthly_budget_exhausted');
 end if;
 if p_client_session_id is not null then
  select count(*) into v_used from public.speaking_pronunciation_requests r
  left join public.speaking_questions q on q.id=r.question_id
  where r.student_id=p_student_id and r.provider='azure_alphabet_basic'
  and r.created_at >= v_day::timestamp at time zone 'Asia/Taipei'
  and r.created_at < (v_day+1)::timestamp at time zone 'Asia/Taipei'
  and coalesce(r.alphabet_letter,upper(trim(q.model_answer)))=v_letter;
  if v_used>=3 then return jsonb_build_object('allowed',false,'code','alphabet_letter_daily_limit_reached','letter',v_letter,'letter_remaining',0); end if;
 end if;
 select count(*) into v_count from public.speaking_pronunciation_requests where student_id=p_student_id and created_at>=now()-interval '10 minutes';
 if v_count>=60 then return jsonb_build_object('allowed',false,'code','rate_limited'); end if;
 if p_client_session_id is not null then
  v_usage:=public.reserve_speaking_challenge_session_v1(p_student_id,p_question_set_id,p_question_id,p_client_session_id);
  if (v_usage->>'allowed')::boolean is not true then return v_usage; end if;
 end if;
 insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,interaction_type,provider,audio_seconds,alphabet_letter)
 values(p_student_id,p_question_set_id,p_question_id,'alphabet_round','azure_alphabet_basic',p_audio_seconds,v_letter) returning id into v_id;
 return jsonb_build_object('allowed',true,'request_id',v_id,'challenge_usage',v_usage,
 'letter',v_letter,'letter_remaining',case when p_client_session_id is null then null else 2-v_used end);
end; $function$;

-- 拼字：與線上版本相同，只在預約前多檢查字母與拼字的每月秒數上限。
create or replace function public.reserve_speaking_azure_spelling_request_v1(p_student_id bigint, p_question_set_id bigint, p_question_id bigint, p_audio_seconds integer, p_client_session_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare v_result jsonb; v_cap integer;
begin
 select letters_student_monthly_seconds into v_cap from public.speaking_azure_cost_policy where id;
 if v_cap is not null and public.speaking_letter_month_seconds_v1(p_student_id) + coalesce(p_audio_seconds, 12) > v_cap then
  return jsonb_build_object('allowed',false,'code','letter_monthly_budget_exhausted');
 end if;
 v_result:=public.reserve_speaking_pronunciation_request_v2(p_student_id,p_question_set_id,p_question_id,'letter_spelling',p_audio_seconds,p_client_session_id);
 if (v_result->>'allowed')::boolean is true then
  update public.speaking_pronunciation_requests set provider='azure_alphabet_basic' where id=(v_result->>'request_id')::uuid;
 end if;
 return v_result;
end; $function$;

-- 句子再確認的預約。p_recheck_of_attempt_id 是剛剛本機沒過的那一筆（管理員示範沒有存評分，可為 null）。
-- 不占用每日 10 輪（場次傳 null）；仍走既有的每人／全站月預算與 10 分鐘頻率保護。
create or replace function public.reserve_speaking_azure_recheck_request_v1(
    p_student_id bigint, p_question_set_id bigint, p_question_id bigint, p_interaction_type text,
    p_audio_seconds integer, p_recheck_of_attempt_id bigint, p_is_staff boolean default false
) returns jsonb language plpgsql set search_path to '' as $$
declare
    v_policy public.speaking_azure_cost_policy%rowtype;
    v_day_start timestamptz := ((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei';
    v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
    v_today integer; v_today_question integer; v_month_seconds integer; v_result jsonb;
begin
    if p_student_id is null or p_question_id is null or p_audio_seconds is null or p_audio_seconds not between 1 and 25 then
        raise exception 'INVALID_RECHECK_REQUEST';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('speaking-recheck:' || p_student_id::text, 0));
    select * into v_policy from public.speaking_azure_cost_policy where id;
    if not found or v_policy.recheck_mode = 'off' or (v_policy.recheck_mode = 'staff' and not coalesce(p_is_staff, false)) then
        return jsonb_build_object('allowed', false, 'code', 'recheck_disabled');
    end if;
    if p_recheck_of_attempt_id is null then
        if not coalesce(p_is_staff, false) then return jsonb_build_object('allowed', false, 'code', 'recheck_not_allowed'); end if;
    elsif not exists (
        select 1 from public.speaking_pronunciation_attempts a
        where a.id = p_recheck_of_attempt_id and a.student_id = p_student_id and a.question_id = p_question_id
          and a.question_set_id = p_question_set_id and a.answer_match is false and a.recheck_of_attempt_id is null
          and a.created_at >= now() - interval '3 minutes'
    ) or exists (
        select 1 from public.speaking_pronunciation_requests r where r.recheck_of_attempt_id = p_recheck_of_attempt_id
    ) then
        return jsonb_build_object('allowed', false, 'code', 'recheck_not_allowed');
    end if;
    select count(*), count(*) filter (where question_id = p_question_id) into v_today, v_today_question
    from public.speaking_pronunciation_requests
    where student_id = p_student_id and provider = 'azure_sentence_recheck' and created_at >= v_day_start;
    select coalesce(sum(coalesce(audio_seconds, 25)), 0) into v_month_seconds
    from public.speaking_pronunciation_requests
    where student_id = p_student_id and provider = 'azure_sentence_recheck' and created_at >= v_month_start;
    if v_today >= v_policy.recheck_student_daily or v_today_question >= v_policy.recheck_per_question_daily
        or v_month_seconds + p_audio_seconds > v_policy.recheck_student_monthly_seconds then
        return jsonb_build_object('allowed', false, 'code', 'recheck_limit_reached');
    end if;
    v_result := public.reserve_speaking_pronunciation_request_v2(
        p_student_id, p_question_set_id, p_question_id, coalesce(nullif(btrim(p_interaction_type), ''), 'standard_sentence'), p_audio_seconds, null);
    if (v_result->>'allowed')::boolean is not true then return v_result; end if;
    update public.speaking_pronunciation_requests
        set provider = 'azure_sentence_recheck', recheck_of_attempt_id = p_recheck_of_attempt_id
        where id = (v_result->>'request_id')::uuid;
    return jsonb_build_object('allowed', true, 'request_id', v_result->>'request_id',
        'recheck_remaining_today', v_policy.recheck_student_daily - v_today - 1);
end;
$$;
revoke all on function public.reserve_speaking_azure_recheck_request_v1(bigint,bigint,bigint,text,integer,bigint,boolean) from public, anon, authenticated;
grant execute on function public.reserve_speaking_azure_recheck_request_v1(bigint,bigint,bigint,text,integer,bigint,boolean) to service_role;

-- 成本頁：Azure 也算句子再確認。與線上版本相同，只改 provider 條件。
create or replace function public.unified_cost_month_v1(p_month date)
 returns jsonb
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare v_start timestamptz; v_end timestamptz; v_rows jsonb; v_total numeric;
begin
 if extract(day from p_month)<>1 then raise exception 'Invalid month'; end if;
 v_start:=p_month::timestamp at time zone 'Asia/Taipei';
 v_end:=(p_month+interval '1 month')::timestamp at time zone 'Asia/Taipei';
 with local_cost as (
  select 'openai' id,
   (select coalesce(sum(estimated_cost_usd),0) from public.ai_api_usage_logs where created_at>=v_start and created_at<v_end)
   +(select coalesce(sum(coalesce(input_tokens,0)*0.25+coalesce(output_tokens,0)*2),0)/1000000 from public.speaking_generation_jobs where created_at>=v_start and created_at<v_end)
   +(select coalesce(sum(coalesce(input_tokens,0)*0.25+coalesce(output_tokens,0)*2),0)/1000000 from public.speaking_source_chunks where created_at>=v_start and created_at<v_end) cost
  union all select 'google_tts',coalesce(sum(used_characters),0)*30/1000000 from public.speaking_tts_assets where created_at>=v_start and created_at<v_end
  -- Same conservative $1/audio-hour basis as the released alphabet cost RPC.
  -- Reservations/failures included; browser-only local requests live in another table.
  union all select 'azure',coalesce(sum(audio_seconds),0)::numeric/3600 from public.speaking_pronunciation_requests
   where provider in ('azure_alphabet_basic','azure_sentence_recheck') and created_at>=v_start and created_at<v_end
 ), usage as (
  select coalesce(sum(coalesce(audio_seconds,case when interaction_type in ('alphabet','alphabet_round') then 12 else 25 end)),0) seconds,
    count(*) requests from public.speaking_pronunciation_requests where created_at>=v_start and created_at<v_end and status<>'reserved'
 ), rows as (
  select c.provider_id,c.enabled,
   f.amount_usd fixed_monthly_usd,
   s.cost_usd reported_cost_usd,l.cost local_cost_usd,
   case when not c.enabled then null
     when s.cost_usd is not null then s.cost_usd+case when s.includes_fixed then 0 else coalesce(f.amount_usd,0) end
     else coalesce(l.cost,0)+coalesce(f.amount_usd,0) end known_cost_usd,
   (c.enabled and (s.cost_usd is null or (not s.includes_fixed and f.amount_usd is null))) incomplete,
   s.source,s.collected_at,s.attempted_at,s.next_refresh_at,s.error_code,s.period_start,s.period_end,
   case when c.provider_id='azure' then coalesce(s.metrics,'[]'::jsonb)||jsonb_build_array(
     jsonb_build_object('name','已結束錄音請求秒數（含失敗；非帳單）','used',u.seconds,'unit','秒','limit',null))
   when c.provider_id='supabase' and p_month=date_trunc('month',now() at time zone 'Asia/Taipei')::date then coalesce(s.metrics,'[]'::jsonb)||jsonb_build_array(
     jsonb_build_object('name','目前資料庫大小（非月計費量）','used',pg_database_size(current_database()),'unit','bytes','limit',null))
   else coalesce(s.metrics,'[]'::jsonb) end metrics
  from public.cost_service_settings c left join public.cost_service_snapshots s on s.provider_id=c.provider_id and s.month=p_month
  left join lateral (select amount_usd from public.cost_service_fixed_fees where provider_id=c.provider_id and effective_month<=p_month order by effective_month desc limit 1) f on true
  left join local_cost l on l.id=c.provider_id cross join usage u
 ) select jsonb_agg(to_jsonb(r) order by r.provider_id),coalesce(sum(known_cost_usd),0) into v_rows,v_total from rows r;
 return jsonb_build_object('month',p_month,'providers',v_rows,'total_cost_usd',round(v_total,8),'calculated_at',now());
end;
$function$;
