alter table public.speaking_question_set_audio_sequences
    add column if not exists assembly_token uuid;

create or replace function public.claim_speaking_alphabet_audio_sequence(
    p_question_set_id bigint,
    p_question_set_version integer,
    p_source_fingerprint text,
    p_assembler_version text,
    p_assembly_token uuid,
    p_force_rebuild boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    claimed_row public.speaking_question_set_audio_sequences%rowtype;
    current_row public.speaking_question_set_audio_sequences%rowtype;
begin
    insert into public.speaking_question_set_audio_sequences (
        question_set_id,
        purpose,
        question_set_version,
        source_fingerprint,
        assembler_version,
        mime_type,
        segments,
        status,
        assembly_token,
        updated_at
    ) values (
        p_question_set_id,
        'alphabet_master',
        p_question_set_version,
        p_source_fingerprint,
        p_assembler_version,
        'audio/wav',
        '[]'::jsonb,
        'processing',
        p_assembly_token,
        now()
    )
    on conflict (question_set_id, purpose) do nothing
    returning * into claimed_row;

    if found then
        return jsonb_build_object('claimed', true, 'status', claimed_row.status);
    end if;

    update public.speaking_question_set_audio_sequences
    set question_set_version = p_question_set_version,
        source_fingerprint = p_source_fingerprint,
        assembler_version = p_assembler_version,
        private_object_key = null,
        mime_type = 'audio/wav',
        byte_size = null,
        duration_ms = null,
        segments = '[]'::jsonb,
        status = 'processing',
        error_code = null,
        error_message = null,
        completed_at = null,
        assembly_token = p_assembly_token,
        updated_at = now()
    where question_set_id = p_question_set_id
      and purpose = 'alphabet_master'
      and (
          status = 'failed'
          or updated_at < now() - interval '10 minutes'
          or question_set_version <> p_question_set_version
          or source_fingerprint <> p_source_fingerprint
          or assembler_version <> p_assembler_version
          or (p_force_rebuild and status = 'ready')
      )
    returning * into claimed_row;

    if found then
        return jsonb_build_object('claimed', true, 'status', claimed_row.status);
    end if;

    select * into current_row
    from public.speaking_question_set_audio_sequences
    where question_set_id = p_question_set_id
      and purpose = 'alphabet_master';

    return jsonb_build_object(
        'claimed', false,
        'status', current_row.status,
        'source_fingerprint', current_row.source_fingerprint,
        'question_set_version', current_row.question_set_version,
        'assembler_version', current_row.assembler_version
    );
end;
$$;

revoke all on function public.claim_speaking_alphabet_audio_sequence(bigint, integer, text, text, uuid, boolean)
    from public, anon, authenticated;
grant execute on function public.claim_speaking_alphabet_audio_sequence(bigint, integer, text, text, uuid, boolean)
    to service_role;

comment on function public.claim_speaking_alphabet_audio_sequence(bigint, integer, text, text, uuid, boolean)
    is 'Service-role-only atomic claim for one A-Z master audio assembly attempt.';
