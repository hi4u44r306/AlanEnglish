-- A–Z single letters pass at 60 instead of 70.
-- A one-letter recording is under a second long, so the pronunciation score swings widely even
-- when the right letter is heard. Spelling rounds (several letters) and every other question keep 70.
-- Only this function is replaced; its claim/retry/order checks live in
-- record_speaking_foundation_assessment_v3 and are untouched.
-- Rollback: re-create this function with the fixed ">=70" from
-- 20261007155958_speaking_challenge_only_reassessment.sql.
create or replace function public.record_speaking_foundation_challenge_v4(
 p_student_id bigint,p_round_id uuid,p_question_id bigint,p_claim_token uuid,
 p_pronunciation_score numeric,p_accuracy_score numeric,p_fluency_score numeric,p_completeness_score numeric,
 p_prosody_score numeric,p_recognized_text text,p_word_results jsonb,p_answer_match boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb; v_set bigint; v_pass numeric;
begin
 select case when s.generation_metadata->>'interaction_type'='alphabet_round' then 60 else 70 end into v_pass
  from public.speaking_foundation_rounds r join public.speaking_question_sets s on s.id=r.question_set_id
  where r.id=p_round_id and r.student_id=p_student_id;
 v_result:=public.record_speaking_foundation_assessment_v3(p_student_id,p_round_id,p_question_id,p_claim_token,
  p_pronunciation_score,p_accuracy_score,p_fluency_score,p_completeness_score,p_prosody_score,p_recognized_text,p_word_results,
  p_answer_match and coalesce(p_pronunciation_score,p_completeness_score)>=coalesce(v_pass,70));
 if v_result->>'status'='completed' then
  select question_set_id into v_set from public.speaking_foundation_rounds where id=p_round_id and student_id=p_student_id;
  insert into public.speaking_challenge_mode_progress(student_id,question_set_id,question_id)
   select p_student_id,v_set,unnest(question_order) from public.speaking_foundation_rounds where id=p_round_id and student_id=p_student_id
   on conflict(student_id,question_id) do nothing;
 end if;
 return v_result;
end; $$;
revoke all on function public.record_speaking_foundation_challenge_v4(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.record_speaking_foundation_challenge_v4(bigint,uuid,bigint,uuid,numeric,numeric,numeric,numeric,numeric,text,jsonb,boolean) to service_role;
