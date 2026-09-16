begin;

alter table public.speaking_question_audio
    drop constraint if exists speaking_question_audio_purpose_check;

alter table public.speaking_question_audio
    add constraint speaking_question_audio_purpose_check
    check (purpose in ('model_answer', 'question_prompt'));

comment on table public.speaking_question_audio is
    'Server-only link from a speaking question to its approved model-answer or safe visible-prompt audio asset.';

commit;
