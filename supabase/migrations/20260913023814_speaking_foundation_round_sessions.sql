begin;

create table if not exists public.speaking_foundation_rounds (
    id uuid primary key default gen_random_uuid(),
    student_id bigint not null references public.students(id) on delete cascade,
    question_set_id bigint not null references public.speaking_question_sets(id) on delete cascade,
    question_set_version integer not null,
    question_order bigint[] not null,
    next_index integer not null default 0,
    status text not null default 'open',
    last_attempt_id bigint,
    started_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '45 minutes'),
    active_claim_token uuid,
    active_claim_question_id bigint references public.speaking_questions(id) on delete restrict,
    active_claim_index integer,
    active_claimed_at timestamptz,
    active_claim_expires_at timestamptz,
    failed_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz not null default now(),
    constraint speaking_foundation_rounds_status_check
        check (status in ('open', 'failed', 'completed', 'expired')),
    constraint speaking_foundation_rounds_question_count_check
        check (cardinality(question_order) = 26),
    constraint speaking_foundation_rounds_next_index_check
        check (next_index between 0 and 26),
    constraint speaking_foundation_rounds_expiry_check
        check (expires_at > started_at),
    constraint speaking_foundation_rounds_claim_check check (
        (
            active_claim_token is null
            and active_claim_question_id is null
            and active_claim_index is null
            and active_claimed_at is null
            and active_claim_expires_at is null
        ) or (
            status = 'open'
            and active_claim_token is not null
            and active_claim_question_id is not null
            and active_claim_index between 0 and 25
            and active_claimed_at is not null
            and active_claim_expires_at > active_claimed_at
        )
    ),
    constraint speaking_foundation_rounds_terminal_time_check check (
        (status = 'failed' and failed_at is not null and completed_at is null)
        or (status = 'completed' and completed_at is not null and failed_at is null)
        or (status in ('open', 'expired') and completed_at is null)
    )
);

create unique index if not exists speaking_foundation_rounds_one_open_idx
    on public.speaking_foundation_rounds(student_id, question_set_id)
    where status = 'open';

create index if not exists speaking_foundation_rounds_student_set_started_idx
    on public.speaking_foundation_rounds(student_id, question_set_id, started_at desc);

alter table public.speaking_pronunciation_attempts
    add column if not exists foundation_round_id uuid
        references public.speaking_foundation_rounds(id) on delete set null,
    add column if not exists foundation_claim_token uuid,
    add column if not exists answer_match boolean;

alter table public.speaking_pronunciation_attempts
    add constraint speaking_pronunciation_attempts_round_answer_check
    check (
        (foundation_round_id is null and foundation_claim_token is null)
        or (foundation_round_id is not null and foundation_claim_token is not null and answer_match is not null)
    );

create index if not exists speaking_pronunciation_attempts_foundation_round_idx
    on public.speaking_pronunciation_attempts(foundation_round_id, created_at);

alter table public.speaking_foundation_rounds
    add constraint speaking_foundation_rounds_last_attempt_fk
    foreign key (last_attempt_id)
    references public.speaking_pronunciation_attempts(id)
    on delete set null;

alter table public.speaking_foundation_rounds enable row level security;
revoke all on table public.speaking_foundation_rounds from public, anon, authenticated;
grant select, insert, update, delete on table public.speaking_foundation_rounds to service_role;

comment on table public.speaking_foundation_rounds is
    'Server-issued A-Z challenge rounds. Only one uninterrupted 26-answer round may persist completion.';
comment on column public.speaking_foundation_rounds.question_order is
    'Server-shuffled canonical published question ids. The browser cannot choose or replace this sequence.';
comment on column public.speaking_foundation_rounds.active_claim_token is
    'Short-lived server-only claim acquired before a paid pronunciation request. It prevents duplicate concurrent provider calls.';
comment on column public.speaking_pronunciation_attempts.foundation_round_id is
    'Optional server-validated A-Z round proof. Raw audio is never stored.';
comment on column public.speaking_pronunciation_attempts.foundation_claim_token is
    'Server-only claim proof binding one saved assessment to the expected round position.';
comment on column public.speaking_pronunciation_attempts.answer_match is
    'Server-calculated answer match used for foundation challenge completion proof.';

create or replace function public.start_speaking_foundation_round_v1(
    p_student_id bigint,
    p_question_set_id bigint,
    p_question_set_version integer,
    p_question_order bigint[]
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round public.speaking_foundation_rounds%rowtype;
    v_expected_count integer := 0;
    v_distinct_letter_count integer := 0;
    v_order_count integer := 0;
    v_distinct_count integer := 0;
begin
    if p_student_id is null or p_question_set_id is null
        or p_question_set_version is null or p_question_order is null then
        raise exception 'INVALID_FOUNDATION_ROUND';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        concat('speaking-foundation-round:', p_student_id, ':', p_question_set_id),
        0
    ));

    if not exists (
        select 1
        from public.students student
        where student.id = p_student_id
          and student.role = 'student'
          and student.archived_at is null
          and coalesce(student.account_status, 'active') <> 'archived'
    ) then
        raise exception 'STUDENT_NOT_ELIGIBLE';
    end if;

    if not exists (
        select 1
        from public.speaking_question_sets question_set
        where question_set.id = p_question_set_id
          and question_set.status = 'published'
          and question_set.version = p_question_set_version
          and question_set.generation_metadata ->> 'interaction_type' = 'alphabet_round'
    ) then
        raise exception 'FOUNDATION_SET_NOT_PUBLISHED';
    end if;

    select count(*)::integer,
        count(distinct regexp_replace(upper(question.model_answer), '[^A-Z]', '', 'g'))::integer
    into v_expected_count, v_distinct_letter_count
    from public.speaking_questions question
    where question.question_set_id = p_question_set_id
      and length(regexp_replace(upper(question.model_answer), '[^A-Z]', '', 'g')) = 1;

    select count(*)::integer, count(distinct item.question_id)::integer
    into v_order_count, v_distinct_count
    from unnest(p_question_order) as item(question_id);

    if (select count(*) from public.speaking_questions question where question.question_set_id = p_question_set_id) <> 26
        or v_expected_count <> 26 or v_distinct_letter_count <> 26
        or v_order_count <> 26 or v_distinct_count <> 26
        or exists (
            select 1
            from unnest(p_question_order) as item(question_id)
            left join public.speaking_questions question
              on question.id = item.question_id
             and question.question_set_id = p_question_set_id
            where question.id is null
        ) then
        raise exception 'FOUNDATION_ROUND_QUESTION_MISMATCH';
    end if;

    select round.* into v_round
    from public.speaking_foundation_rounds round
    where round.student_id = p_student_id
      and round.question_set_id = p_question_set_id
      and round.status = 'open'
    for update;

    if found and v_round.active_claim_token is not null
        and v_round.active_claim_expires_at > now() then
        return jsonb_build_object(
            'status', 'busy',
            'retry_after_seconds', greatest(
                1,
                ceil(extract(epoch from (v_round.active_claim_expires_at - now())))::integer
            )
        );
    end if;

    if found then
        update public.speaking_foundation_rounds
        set status = 'expired', next_index = 0,
            active_claim_token = null, active_claim_question_id = null,
            active_claim_index = null, active_claimed_at = null,
            active_claim_expires_at = null, updated_at = now()
        where id = v_round.id;
    end if;

    insert into public.speaking_foundation_rounds (
        student_id, question_set_id, question_set_version, question_order
    ) values (
        p_student_id, p_question_set_id, p_question_set_version, p_question_order
    ) returning * into v_round;

    return jsonb_build_object(
        'round_id', v_round.id,
        'question_order', to_jsonb(v_round.question_order),
        'next_index', v_round.next_index,
        'status', v_round.status,
        'expires_at', v_round.expires_at
    );
end;
$$;

create or replace function public.claim_speaking_foundation_round_question_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_question_id bigint
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round public.speaking_foundation_rounds%rowtype;
    v_now timestamptz := now();
    v_token uuid := gen_random_uuid();
    v_expected_question_id bigint;
begin
    if p_student_id is null or p_round_id is null or p_question_id is null then
        raise exception 'INVALID_FOUNDATION_ROUND_CLAIM';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        concat('speaking-foundation-round-id:', p_round_id),
        0
    ));

    select round.* into v_round
    from public.speaking_foundation_rounds round
    where round.id = p_round_id
      and round.student_id = p_student_id
    for update;

    if not found or v_round.status <> 'open' then
        return jsonb_build_object('status', 'invalid');
    end if;

    if v_round.expires_at <= v_now then
        update public.speaking_foundation_rounds
        set status = 'expired', next_index = 0,
            active_claim_token = null, active_claim_question_id = null,
            active_claim_index = null, active_claimed_at = null,
            active_claim_expires_at = null, updated_at = v_now
        where id = v_round.id;
        return jsonb_build_object('status', 'expired');
    end if;

    if not exists (
        select 1
        from public.speaking_question_sets question_set
        where question_set.id = v_round.question_set_id
          and question_set.status = 'published'
          and question_set.version = v_round.question_set_version
          and question_set.generation_metadata ->> 'interaction_type' = 'alphabet_round'
    ) then
        return jsonb_build_object('status', 'invalid');
    end if;

    v_expected_question_id := v_round.question_order[v_round.next_index + 1];
    if v_expected_question_id is null or v_expected_question_id <> p_question_id then
        return jsonb_build_object('status', 'invalid');
    end if;

    if v_round.active_claim_token is not null
        and v_round.active_claim_expires_at > v_now then
        return jsonb_build_object(
            'status', 'busy',
            'retry_after_seconds', greatest(
                1,
                ceil(extract(epoch from (v_round.active_claim_expires_at - v_now)))::integer
            )
        );
    end if;

    update public.speaking_foundation_rounds
    set active_claim_token = v_token,
        active_claim_question_id = p_question_id,
        active_claim_index = v_round.next_index,
        active_claimed_at = v_now,
        active_claim_expires_at = least(v_round.expires_at + interval '30 seconds', v_now + interval '2 minutes'),
        updated_at = v_now
    where id = v_round.id;

    return jsonb_build_object(
        'status', 'claimed',
        'claim_token', v_token,
        'next_index', v_round.next_index,
        'claim_expires_at', least(v_round.expires_at + interval '30 seconds', v_now + interval '2 minutes')
    );
end;
$$;

create or replace function public.release_speaking_foundation_round_claim_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_claim_token uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_round public.speaking_foundation_rounds%rowtype;
    v_now timestamptz := now();
begin
    if p_student_id is null or p_round_id is null or p_claim_token is null then
        return false;
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        concat('speaking-foundation-round-id:', p_round_id),
        0
    ));

    select round.* into v_round
    from public.speaking_foundation_rounds round
    where round.id = p_round_id
      and round.student_id = p_student_id
    for update;

    if not found or v_round.status <> 'open'
        or v_round.active_claim_token is distinct from p_claim_token then
        return false;
    end if;

    update public.speaking_foundation_rounds
    set status = case when expires_at <= v_now then 'expired' else status end,
        next_index = case when expires_at <= v_now then 0 else next_index end,
        active_claim_token = null, active_claim_question_id = null,
        active_claim_index = null, active_claimed_at = null,
        active_claim_expires_at = null, updated_at = v_now
    where id = v_round.id;

    return true;
end;
$$;

create or replace function public.record_speaking_foundation_round_attempt_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_attempt_id bigint,
    p_claim_token uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
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

    perform pg_advisory_xact_lock(hashtextextended(
        concat('speaking-foundation-round-id:', p_round_id),
        0
    ));

    select round.* into v_round
    from public.speaking_foundation_rounds round
    where round.id = p_round_id
      and round.student_id = p_student_id
    for update;

    if not found then
        raise exception 'FOUNDATION_ROUND_NOT_FOUND';
    end if;

    if v_round.last_attempt_id = p_attempt_id then
        return jsonb_build_object(
            'round_id', v_round.id,
            'status', v_round.status,
            'next_index', v_round.next_index,
            'completed', v_round.status = 'completed'
        );
    end if;

    if v_round.status <> 'open' then
        raise exception 'FOUNDATION_ROUND_NOT_OPEN';
    end if;

    if v_round.expires_at <= v_now and not (
        v_round.active_claim_token = p_claim_token
        and v_round.active_claimed_at < v_round.expires_at
        and v_round.active_claim_expires_at > v_now
    ) then
        update public.speaking_foundation_rounds
        set status = 'expired', next_index = 0,
            active_claim_token = null, active_claim_question_id = null,
            active_claim_index = null, active_claimed_at = null,
            active_claim_expires_at = null, updated_at = v_now
        where id = v_round.id;
        return jsonb_build_object(
            'round_id', v_round.id,
            'status', 'expired',
            'next_index', 0,
            'completed', false
        );
    end if;

    if not exists (
        select 1
        from public.speaking_question_sets question_set
        where question_set.id = v_round.question_set_id
          and question_set.status = 'published'
          and question_set.version = v_round.question_set_version
          and question_set.generation_metadata ->> 'interaction_type' = 'alphabet_round'
    ) then
        raise exception 'FOUNDATION_SET_CHANGED';
    end if;

    v_expected_question_id := v_round.question_order[v_round.next_index + 1];
    if v_round.active_claim_token is distinct from p_claim_token
        or v_round.active_claim_question_id is distinct from v_expected_question_id
        or v_round.active_claim_index is distinct from v_round.next_index
        or v_round.active_claim_expires_at is null
        or v_round.active_claim_expires_at <= v_now then
        raise exception 'FOUNDATION_ROUND_CLAIM_INVALID';
    end if;

    select attempt.* into v_attempt
    from public.speaking_pronunciation_attempts attempt
    where attempt.id = p_attempt_id
      and attempt.student_id = p_student_id
      and attempt.question_set_id = v_round.question_set_id
      and attempt.foundation_round_id = v_round.id
      and attempt.foundation_claim_token = p_claim_token
      and attempt.created_at >= v_round.started_at
      and attempt.created_at <= v_round.active_claim_expires_at;

    if not found or v_attempt.answer_match is null then
        raise exception 'FOUNDATION_ROUND_ATTEMPT_NOT_FOUND';
    end if;

    if v_attempt.question_id <> v_expected_question_id then
        raise exception 'FOUNDATION_ROUND_ATTEMPT_OUT_OF_ORDER';
    end if;

    if v_attempt.answer_match is not true then
        update public.speaking_foundation_rounds
        set status = 'failed', next_index = 0, failed_at = v_now,
            last_attempt_id = p_attempt_id,
            active_claim_token = null, active_claim_question_id = null,
            active_claim_index = null, active_claimed_at = null,
            active_claim_expires_at = null, updated_at = v_now
        where id = v_round.id;
        return jsonb_build_object(
            'round_id', v_round.id,
            'status', 'failed',
            'next_index', 0,
            'completed', false
        );
    end if;

    if v_round.next_index + 1 = cardinality(v_round.question_order) then
        foreach v_question_id in array v_round.question_order loop
            v_completion := public.complete_speaking_challenge_question_v2(
                p_student_id,
                v_round.question_set_id,
                v_question_id
            );
        end loop;

        update public.speaking_foundation_rounds
        set status = 'completed', next_index = 26, completed_at = v_now,
            last_attempt_id = p_attempt_id,
            active_claim_token = null, active_claim_question_id = null,
            active_claim_index = null, active_claimed_at = null,
            active_claim_expires_at = null, updated_at = v_now
        where id = v_round.id;

        return coalesce(v_completion, '{}'::jsonb) || jsonb_build_object(
            'round_id', v_round.id,
            'status', 'completed',
            'next_index', 26,
            'completed', true
        );
    end if;

    update public.speaking_foundation_rounds
    set next_index = v_round.next_index + 1,
        last_attempt_id = p_attempt_id,
        active_claim_token = null, active_claim_question_id = null,
        active_claim_index = null, active_claimed_at = null,
        active_claim_expires_at = null,
        updated_at = v_now
    where id = v_round.id;

    return jsonb_build_object(
        'round_id', v_round.id,
        'status', 'open',
        'next_index', v_round.next_index + 1,
        'completed', false
    );
end;
$$;

create or replace function public.record_speaking_foundation_assessment_v1(
    p_student_id bigint,
    p_round_id uuid,
    p_question_id bigint,
    p_claim_token uuid,
    p_pronunciation_score numeric,
    p_accuracy_score numeric,
    p_fluency_score numeric,
    p_completeness_score numeric,
    p_prosody_score numeric,
    p_recognized_text text,
    p_word_results jsonb,
    p_answer_match boolean
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_attempt_id bigint;
    v_round_result jsonb;
begin
    if p_student_id is null or p_round_id is null or p_question_id is null
        or p_claim_token is null or p_answer_match is null then
        raise exception 'INVALID_FOUNDATION_ASSESSMENT';
    end if;

    insert into public.speaking_pronunciation_attempts (
        student_id, question_set_id, question_id,
        pronunciation_score, accuracy_score, fluency_score,
        completeness_score, prosody_score, recognized_text,
        word_results, answer_match, foundation_round_id, foundation_claim_token
    )
    select
        p_student_id, round.question_set_id, p_question_id,
        p_pronunciation_score, p_accuracy_score, p_fluency_score,
        p_completeness_score, p_prosody_score, coalesce(p_recognized_text, ''),
        coalesce(p_word_results, '[]'::jsonb), p_answer_match, p_round_id, p_claim_token
    from public.speaking_foundation_rounds round
    where round.id = p_round_id
      and round.student_id = p_student_id
    returning id into v_attempt_id;

    if v_attempt_id is null then
        raise exception 'FOUNDATION_ROUND_NOT_FOUND';
    end if;

    v_round_result := public.record_speaking_foundation_round_attempt_v1(
        p_student_id,
        p_round_id,
        v_attempt_id,
        p_claim_token
    );

    if coalesce(v_round_result ->> 'status', '') not in ('open', 'failed', 'completed') then
        raise exception 'FOUNDATION_ROUND_NOT_PERSISTED';
    end if;

    return v_round_result || jsonb_build_object('attempt_id', v_attempt_id);
end;
$$;

revoke all on function public.start_speaking_foundation_round_v1(bigint, bigint, integer, bigint[])
    from public, anon, authenticated;
grant execute on function public.start_speaking_foundation_round_v1(bigint, bigint, integer, bigint[])
    to service_role;

revoke all on function public.claim_speaking_foundation_round_question_v1(bigint, uuid, bigint)
    from public, anon, authenticated;
grant execute on function public.claim_speaking_foundation_round_question_v1(bigint, uuid, bigint)
    to service_role;

revoke all on function public.release_speaking_foundation_round_claim_v1(bigint, uuid, uuid)
    from public, anon, authenticated;
grant execute on function public.release_speaking_foundation_round_claim_v1(bigint, uuid, uuid)
    to service_role;

revoke all on function public.record_speaking_foundation_round_attempt_v1(bigint, uuid, bigint, uuid)
    from public, anon, authenticated;
grant execute on function public.record_speaking_foundation_round_attempt_v1(bigint, uuid, bigint, uuid)
    to service_role;

revoke all on function public.record_speaking_foundation_assessment_v1(
    bigint, uuid, bigint, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.record_speaking_foundation_assessment_v1(
    bigint, uuid, bigint, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, boolean
) to service_role;

comment on function public.start_speaking_foundation_round_v1(bigint, bigint, integer, bigint[]) is
    'Service-role-only creation of one server-shuffled A-Z speaking round.';
comment on function public.claim_speaking_foundation_round_question_v1(bigint, uuid, bigint) is
    'Atomically reserves one A-Z question before any paid pronunciation request.';
comment on function public.release_speaking_foundation_round_claim_v1(bigint, uuid, uuid) is
    'Releases an unused A-Z provider claim after an assessment request fails.';
comment on function public.record_speaking_foundation_round_attempt_v1(bigint, uuid, bigint, uuid) is
    'Atomically fails or advances an A-Z round and only persists all 26 questions after uninterrupted success.';
comment on function public.record_speaking_foundation_assessment_v1(
    bigint, uuid, bigint, uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb, boolean
) is 'Atomically saves one paid pronunciation assessment and advances its claimed A-Z round; any failure rolls both writes back.';

commit;
