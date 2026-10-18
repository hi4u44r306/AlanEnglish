-- 口說本機評分的實際計時（擁有者 2026-10-18 要求）：每次本機送評時，手機回報轉文字花多久、
-- 用哪個模型、上一次送評分／再確認往返多久，以及粗略的裝置類型。用來決定要不要換更快的辨識模型。
-- 不含姓名、錄音或辨識文字；pronunciation-coach 只留數字與固定選項。Additive only.
alter table public.speaking_local_reading_requests
    add column client_timing jsonb
    check (client_timing is null or (jsonb_typeof(client_timing) = 'object' and pg_column_size(client_timing) <= 1024));

-- 管理員看「轉文字要等多久」：依平台與模型分組的中位數與 90 百分位（毫秒）。
create or replace function public.speaking_client_timing_summary_v1(p_days integer default 14)
returns table (platform text, model text, samples bigint, transcribe_p50 integer, transcribe_p90 integer,
               submit_p50 integer, submit_p90 integer, recheck_p50 integer, recheck_p90 integer)
language sql stable set search_path to '' as $$
    select coalesce(client_timing->>'platform', 'unknown'), coalesce(client_timing->>'model', 'unknown'), count(*),
        percentile_cont(0.5) within group (order by (client_timing->>'transcribe_ms')::numeric)::integer,
        percentile_cont(0.9) within group (order by (client_timing->>'transcribe_ms')::numeric)::integer,
        percentile_cont(0.5) within group (order by (client_timing->>'previous_submit_ms')::numeric)::integer,
        percentile_cont(0.9) within group (order by (client_timing->>'previous_submit_ms')::numeric)::integer,
        percentile_cont(0.5) within group (order by (client_timing->>'previous_recheck_ms')::numeric)::integer,
        percentile_cont(0.9) within group (order by (client_timing->>'previous_recheck_ms')::numeric)::integer
    from public.speaking_local_reading_requests
    where client_timing is not null and created_at >= now() - make_interval(days => greatest(1, least(p_days, 90)))
    group by 1, 2 order by 3 desc;
$$;
revoke all on function public.speaking_client_timing_summary_v1(integer) from public, anon, authenticated;
grant execute on function public.speaking_client_timing_summary_v1(integer) to service_role;
