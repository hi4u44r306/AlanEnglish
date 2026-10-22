-- 口說通過門檻 70 → 60（擁有者 2026-10-22 決定：國小生不用念得很標準，只顯示通過／沒過）。
-- 只改「挑戰完成」時重新檢查最新一筆評分的門檻：答案正確（answer_match）且分數 >= 60。
-- 本機朗讀的 answer_match 仍要求 70% 的字念到，所以本機通過的分數都在 70 以上，不會因此放寬；
-- 放寬的是雲端評發音的拼字與「再確認」（pronunciation-coach 同步改成 60 分）。
-- 其餘邏輯（同回合、10 分鐘內、看過提示不算通過、獎勵只發一次）完全不變。權限沿用原函式，不重設。
-- Rollback: 用 20261007155958_speaking_challenge_only_reassessment.sql 裡的原定義（>=70）再 create or replace 一次。
create or replace function public.complete_speaking_session_question_v2(
 p_student_id bigint,p_question_set_id bigint,p_question_id bigint,p_client_session_id uuid,p_challenge_mode text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_finished boolean; v_question bigint; v_result jsonb := '{}'::jsonb;
 v_xp integer := 0; v_points integer := 0;
begin
 if p_client_session_id is null or p_challenge_mode is null or p_challenge_mode not in ('easy','challenge') then raise exception 'INVALID_SESSION_COMPLETION'; end if;
 perform pg_advisory_xact_lock(hashtextextended('speaking-session-completion:'||p_student_id::text||':'||p_client_session_id::text,0));
 if not exists(select 1 from public.speaking_questions q join public.speaking_question_sets s on s.id=q.question_set_id
  where q.id=p_question_id and s.id=p_question_set_id and s.status='published') then raise exception 'QUESTION_NOT_IN_PUBLISHED_SET'; end if;
 if exists(select 1 from public.speaking_session_question_completions where student_id=p_student_id
  and client_session_id=p_client_session_id and question_set_id<>p_question_set_id) then raise exception 'SESSION_SET_MISMATCH'; end if;
 -- Re-check the latest decision, not any earlier pass in this session.
 if not exists(select 1 from (
  select a.* from public.speaking_pronunciation_attempts a where a.student_id=p_student_id
   and a.question_set_id=p_question_set_id and a.question_id=p_question_id
   and a.client_session_id=p_client_session_id and a.challenge_mode=p_challenge_mode
   and a.created_at>=now()-interval '10 minutes' order by a.created_at desc,a.id desc limit 1
 ) a where a.answer_match is true and coalesce(a.pronunciation_score,a.completeness_score)>=60
  and (p_challenge_mode='easy' or (not a.hint_used and not exists(select 1 from public.speaking_challenge_hint_reveals h
   where h.student_id=a.student_id and h.question_id=a.question_id and h.client_session_id=a.client_session_id))))
 then raise exception 'CORRECT_ASSESSMENT_REQUIRED'; end if;
 insert into public.speaking_session_question_completions(student_id,question_set_id,question_id,client_session_id,challenge_mode)
 values(p_student_id,p_question_set_id,p_question_id,p_client_session_id,p_challenge_mode) on conflict do nothing;
 select not exists(select 1 from public.speaking_questions q where q.question_set_id=p_question_set_id and not exists(
  select 1 from public.speaking_session_question_completions c where c.student_id=p_student_id
   and c.client_session_id=p_client_session_id and c.question_set_id=p_question_set_id
   and c.challenge_mode=p_challenge_mode and c.question_id=q.id)) into v_finished;
 if p_challenge_mode='challenge' then
  insert into public.speaking_challenge_mode_progress(student_id,question_set_id,question_id)
  values(p_student_id,p_question_set_id,p_question_id) on conflict(student_id,question_id) do nothing;
  if v_finished then
   -- Call the existing once-only reward writer only after a full challenge run.
   -- Existing easy-mode rewards remain; their original source key prevents duplicates.
   for v_question in select id from public.speaking_questions where question_set_id=p_question_set_id order by id loop
    v_result:=public.complete_speaking_challenge_question_v2(p_student_id,p_question_set_id,v_question);
    v_xp:=v_xp+coalesce((v_result->>'xp_awarded')::integer,0);
    v_points:=v_points+coalesce((v_result->>'ae_points_awarded')::integer,0);
   end loop;
  end if;
 end if;
 return v_result || jsonb_build_object('xp_awarded',v_xp,'ae_points_awarded',v_points,'challenge_completed',v_finished and p_challenge_mode='challenge',
  'completed_challenge',v_finished and p_challenge_mode='challenge','challenge_complete',v_finished and p_challenge_mode='challenge',
  'practice_completed',v_finished and p_challenge_mode='easy');
end; $$;
