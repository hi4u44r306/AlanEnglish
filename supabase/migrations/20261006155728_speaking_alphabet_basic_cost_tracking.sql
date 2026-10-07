begin;
-- Basic Azure assessment does not measure prosody. Historical scores remain intact.
alter table public.speaking_pronunciation_attempts drop constraint speaking_assessment_dimensions_check;
alter table public.speaking_pronunciation_attempts add constraint speaking_assessment_dimensions_check check (
 (pronunciation_score is null and accuracy_score is null and fluency_score is null and prosody_score is null)
 or (pronunciation_score is not null and accuracy_score is not null and fluency_score is not null));

create function public.reserve_speaking_azure_alphabet_request_v1(
 p_student_id bigint,p_question_set_id bigint,p_question_id bigint,p_audio_seconds integer,p_client_session_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_usage jsonb; v_id uuid; v_count integer;
begin
 if p_student_id is null or p_audio_seconds is null or p_audio_seconds not between 1 and 12 then raise exception 'INVALID_ALPHABET_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended('speaking-alphabet:' || p_student_id::text,0));
 if not exists(select 1 from public.speaking_questions q join public.speaking_question_sets s on s.id=q.question_set_id
  where q.id=p_question_id and s.id=p_question_set_id and s.status='published' and s.generation_metadata->>'interaction_type'='alphabet_round') then raise exception 'ALPHABET_QUESTION_REQUIRED'; end if;
 select count(*) into v_count from public.speaking_pronunciation_requests where student_id=p_student_id and created_at>=now()-interval '10 minutes';
 if v_count>=60 then return jsonb_build_object('allowed',false,'code','rate_limited'); end if;
 if p_client_session_id is not null then
  v_usage:=public.reserve_speaking_challenge_session_v1(p_student_id,p_question_set_id,p_question_id,p_client_session_id);
  if (v_usage->>'allowed')::boolean is not true then return v_usage; end if;
 end if;
 insert into public.speaking_pronunciation_requests(student_id,question_set_id,question_id,interaction_type,provider,audio_seconds)
 values(p_student_id,p_question_set_id,p_question_id,'alphabet_round','azure_alphabet_basic',p_audio_seconds) returning id into v_id;
 return jsonb_build_object('allowed',true,'request_id',v_id,'challenge_usage',v_usage);
end; $$;
revoke all on function public.reserve_speaking_azure_alphabet_request_v1(bigint,bigint,bigint,integer,uuid) from public,anon,authenticated;
grant execute on function public.reserve_speaking_azure_alphabet_request_v1(bigint,bigint,bigint,integer,uuid) to service_role;

-- Reserved seconds include failures and uncertain requests: an estimate, not an invoice.
create function public.speaking_alphabet_cost_usage_v1() returns jsonb language sql security invoker set search_path = '' as $$
 select jsonb_build_object('reserved_seconds',coalesce(sum(audio_seconds),0),'requests',count(*),
  'estimated_twd',round(coalesce(sum(audio_seconds),0)::numeric/3600*32,2),
  'usd_per_hour',1,'assumed_usd_twd',32,'scope','azure_alphabet_basic',
  'activity_month',to_char(now() at time zone 'Asia/Taipei','YYYY-MM'))
 from public.speaking_pronunciation_requests where provider='azure_alphabet_basic'
 and created_at >= date_trunc('month',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
$$;
revoke all on function public.speaking_alphabet_cost_usage_v1() from public,anon,authenticated;
grant execute on function public.speaking_alphabet_cost_usage_v1() to service_role;
commit;
