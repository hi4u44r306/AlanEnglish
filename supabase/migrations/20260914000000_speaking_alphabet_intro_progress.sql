-- Persists one verified A-Z master-audio listen per student and active audio revision.
-- This is server-only: the Edge Function verifies Firebase identity and the current sequence.

begin;

create table if not exists public.speaking_alphabet_intro_listens (
    student_id bigint not null references public.students(id) on delete cascade,
    question_set_id bigint not null references public.speaking_question_sets(id) on delete cascade,
    question_set_version integer not null check (question_set_version > 0),
    sequence_fingerprint text not null check (length(sequence_fingerprint) between 16 and 256),
    listen_session_id uuid not null default gen_random_uuid(),
    started_at timestamptz not null default now(),
    min_complete_at timestamptz not null,
    completed_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (student_id, question_set_id, question_set_version, sequence_fingerprint),
    constraint speaking_alphabet_intro_listens_completion_check
        check (completed_at is null or completed_at >= started_at)
);

create index if not exists speaking_alphabet_intro_listens_student_set_idx
    on public.speaking_alphabet_intro_listens (student_id, question_set_id, completed_at desc);

alter table public.speaking_alphabet_intro_listens enable row level security;
revoke all on table public.speaking_alphabet_intro_listens from public, anon, authenticated;
grant select, insert, update, delete on table public.speaking_alphabet_intro_listens to service_role;

comment on table public.speaking_alphabet_intro_listens is
    'Server-only A-Z master-audio listen sessions and verified completions. A changed sequence fingerprint requires a new listen.';

alter table public.speaking_foundation_rounds
    add column if not exists retry_used boolean not null default false;

create or replace function public.record_speaking_foundation_round_attempt_v2(
    p_student_id bigint, p_round_id uuid, p_attempt_id bigint, p_claim_token uuid
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
    v_round public.speaking_foundation_rounds%rowtype;
    v_attempt public.speaking_pronunciation_attempts%rowtype;
    v_expected_question_id bigint;
    v_question_id bigint;
    v_completion jsonb := '{}'::jsonb;
    v_now timestamptz := now();
begin
    if p_student_id is null or p_round_id is null or p_attempt_id is null or p_claim_token is null then
        raise exception 'INVALID_FOUNDATION_ROUND_ATTEMPT';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(concat('speaking-foundation-round-id:', p_round_id), 0));
    select round.* into v_round from public.speaking_foundation_rounds round
    where round.id = p_round_id and round.student_id = p_student_id for update;
    if not found then raise exception 'FOUNDATION_ROUND_NOT_FOUND'; end if;
    if v_round.last_attempt_id = p_attempt_id then
        return jsonb_build_object('round_id', v_round.id, 'status', v_round.status, 'next_index', v_round.next_index, 'completed', v_round.status = 'completed');
    end if;
    if v_round.status <> 'open' then raise exception 'FOUNDATION_ROUND_NOT_OPEN'; end if;
    if v_round.expires_at <= v_now and not (v_round.active_claim_token = p_claim_token and v_round.active_claimed_at < v_round.expires_at and v_round.active_claim_expires_at > v_now) then
        update public.speaking_foundation_rounds set status = 'expired', next_index = 0, active_claim_token = null, active_claim_question_id = null, active_claim_index = null, active_claimed_at = null, active_claim_expires_at = null, updated_at = v_now where id = v_round.id;
        return jsonb_build_object('round_id', v_round.id, 'status', 'expired', 'next_index', 0, 'completed', false);
    end if;
    if not exists (select 1 from public.speaking_question_sets question_set where question_set.id = v_round.question_set_id and question_set.status = 'published' and question_set.version = v_round.question_set_version and question_set.generation_metadata ->> 'interaction_type' = 'alphabet_round') then
        raise exception 'FOUNDATION_SET_CHANGED';
    end if;
    v_expected_question_id := v_round.question_order[v_round.next_index + 1];
    if v_round.active_claim_token is distinct from p_claim_token or v_round.active_claim_question_id is distinct from v_expected_question_id or v_round.active_claim_index is distinct from v_round.next_index or v_round.active_claim_expires_at is null or v_round.active_claim_expires_at <= v_now then
        raise exception 'FOUNDATION_ROUND_CLAIM_INVALID';
    end if;
    select attempt.* into v_attempt from public.speaking_pronunciation_attempts attempt
    where attempt.id = p_attempt_id and attempt.student_id = p_student_id and attempt.question_set_id = v_round.question_set_id and attempt.foundation_round_id = v_round.id and attempt.foundation_claim_token = p_claim_token and attempt.created_at >= v_round.started_at and attempt.created_at <= v_round.active_claim_expires_at;
    if not found or v_attempt.answer_match is null then raise exception 'FOUNDATION_ROUND_ATTEMPT_NOT_FOUND'; end if;
    if v_attempt.question_id <> v_expected_question_id then raise exception 'FOUNDATION_ROUND_ATTEMPT_OUT_OF_ORDER'; end if;
    if v_attempt.answer_match is not true then
        if not v_round.retry_used then
            update public.speaking_foundation_rounds set retry_used = true, last_attempt_id = p_attempt_id,
                active_claim_token = null, active_claim_question_id = null, active_claim_index = null, active_claimed_at = null, active_claim_expires_at = null, updated_at = v_now where id = v_round.id;
            return jsonb_build_object('round_id', v_round.id, 'status', 'retry', 'next_index', v_round.next_index, 'completed', false);
        end if;
        update public.speaking_foundation_rounds set status = 'failed', next_index = 0, failed_at = v_now, last_attempt_id = p_attempt_id,
            active_claim_token = null, active_claim_question_id = null, active_claim_index = null, active_claimed_at = null, active_claim_expires_at = null, updated_at = v_now where id = v_round.id;
        return jsonb_build_object('round_id', v_round.id, 'status', 'failed', 'next_index', 0, 'completed', false);
    end if;
    if v_round.next_index + 1 = cardinality(v_round.question_order) then
        foreach v_question_id in array v_round.question_order loop
            v_completion := public.complete_speaking_challenge_question_v2(p_student_id, v_round.question_set_id, v_question_id);
        end loop;
        update public.speaking_foundation_rounds set status = 'completed', next_index = 26, completed_at = v_now, last_attempt_id = p_attempt_id,
            active_claim_token = null, active_claim_question_id = null, active_claim_index = null, active_claimed_at = null, active_claim_expires_at = null, updated_at = v_now where id = v_round.id;
        return coalesce(v_completion, '{}'::jsonb) || jsonb_build_object('round_id', v_round.id, 'status', 'completed', 'next_index', 26, 'completed', true);
    end if;
    update public.speaking_foundation_rounds set next_index = v_round.next_index + 1, last_attempt_id = p_attempt_id,
        active_claim_token = null, active_claim_question_id = null, active_claim_index = null, active_claimed_at = null, active_claim_expires_at = null, updated_at = v_now where id = v_round.id;
    return jsonb_build_object('round_id', v_round.id, 'status', 'open', 'next_index', v_round.next_index + 1, 'completed', false);
end;
$$;

create or replace function public.record_speaking_foundation_assessment_v2(
    p_student_id bigint, p_round_id uuid, p_question_id bigint, p_claim_token uuid,
    p_pronunciation_score numeric, p_accuracy_score numeric, p_fluency_score numeric,
    p_completeness_score numeric, p_prosody_score numeric, p_recognized_text text,
    p_word_results jsonb, p_answer_match boolean
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_attempt_id bigint; v_round_result jsonb;
begin
    if p_student_id is null or p_round_id is null or p_question_id is null or p_claim_token is null or p_answer_match is null then raise exception 'INVALID_FOUNDATION_ASSESSMENT'; end if;
    insert into public.speaking_pronunciation_attempts (student_id, question_set_id, question_id, pronunciation_score, accuracy_score, fluency_score, completeness_score, prosody_score, recognized_text, word_results, answer_match, foundation_round_id, foundation_claim_token)
    select p_student_id, round.question_set_id, p_question_id, p_pronunciation_score, p_accuracy_score, p_fluency_score, p_completeness_score, p_prosody_score, coalesce(p_recognized_text, ''), coalesce(p_word_results, '[]'::jsonb), p_answer_match, p_round_id, p_claim_token
    from public.speaking_foundation_rounds round where round.id = p_round_id and round.student_id = p_student_id
    on conflict (foundation_claim_token) where foundation_claim_token is not null do nothing returning id into v_attempt_id;
    if v_attempt_id is null then
        select attempt.id into v_attempt_id from public.speaking_pronunciation_attempts attempt join public.speaking_foundation_rounds round on round.id = attempt.foundation_round_id
        where attempt.student_id = p_student_id and attempt.foundation_round_id = p_round_id and attempt.foundation_claim_token = p_claim_token and attempt.question_set_id = round.question_set_id and round.student_id = p_student_id and attempt.question_id = p_question_id
        and attempt.pronunciation_score is not distinct from round(p_pronunciation_score, 2) and attempt.accuracy_score is not distinct from round(p_accuracy_score, 2) and attempt.fluency_score is not distinct from round(p_fluency_score, 2) and attempt.completeness_score is not distinct from round(p_completeness_score, 2) and attempt.prosody_score is not distinct from round(p_prosody_score, 2) and coalesce(attempt.recognized_text, '') = coalesce(p_recognized_text, '') and attempt.word_results = coalesce(p_word_results, '[]'::jsonb) and attempt.answer_match is not distinct from p_answer_match;
    end if;
    if v_attempt_id is null then raise exception 'FOUNDATION_ASSESSMENT_REPLAY_MISMATCH'; end if;
    v_round_result := public.record_speaking_foundation_round_attempt_v2(p_student_id, p_round_id, v_attempt_id, p_claim_token);
    if coalesce(v_round_result ->> 'status', '') not in ('open', 'retry', 'failed', 'completed') then raise exception 'FOUNDATION_ROUND_NOT_PERSISTED'; end if;
    return v_round_result || jsonb_build_object('attempt_id', v_attempt_id);
end;
$$;

revoke all on function public.record_speaking_foundation_round_attempt_v2(bigint, uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.record_speaking_foundation_round_attempt_v2(bigint, uuid, bigint, uuid) to service_role;
revoke all on function public.record_speaking_foundation_assessment_v2(bigint, uuid, bigint, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.record_speaking_foundation_assessment_v2(bigint, uuid, bigint, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, boolean) to service_role;

commit;
