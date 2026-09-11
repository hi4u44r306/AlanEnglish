begin;

alter table public.speaking_question_sets
    add column if not exists intro_zh text,
    add column if not exists learning_goal_zh text;

update public.speaking_question_sets
set
    intro_zh = coalesce(
        nullif(btrim(intro_zh), ''),
        case
            when title ilike '%名字%' then '你會遇到一位新朋友。先仔細聽對方的問題，再用完整英文句子介紹自己的名字。'
            when title ilike '%打招呼%' then '和外國朋友見面時，練習在不同時間打招呼、關心對方，並有禮貌地說再見。'
            when title ilike '%來自%' then '和新朋友聊聊大家來自哪裡。聽懂問題後，用完整句子介紹自己或其他人的國家。'
            else '先聽角色提出問題，想一想後用完整英文句子回答；需要時再打開提示。'
        end
    ),
    learning_goal_zh = coalesce(
        nullif(btrim(learning_goal_zh), ''),
        '聽懂簡短問題，並能不看答案完成口說回應。'
    )
where intro_zh is null or btrim(intro_zh) = ''
   or learning_goal_zh is null or btrim(learning_goal_zh) = '';

alter table public.speaking_question_sets
    drop constraint if exists speaking_question_sets_intro_length_check,
    drop constraint if exists speaking_question_sets_goal_length_check;

alter table public.speaking_question_sets
    add constraint speaking_question_sets_intro_length_check
        check (intro_zh is null or char_length(intro_zh) between 1 and 800),
    add constraint speaking_question_sets_goal_length_check
        check (learning_goal_zh is null or char_length(learning_goal_zh) between 1 and 500);

alter table public.speaking_question_audio
    drop constraint if exists speaking_question_audio_purpose_check;

alter table public.speaking_question_audio
    add constraint speaking_question_audio_purpose_check
        check (purpose in ('question_prompt', 'model_answer'));

alter table public.speaking_question_audio
    drop constraint if exists speaking_question_audio_pkey;

alter table public.speaking_question_audio
    add constraint speaking_question_audio_pkey primary key (question_id, purpose);

comment on column public.speaking_question_sets.intro_zh is 'Short learner-facing scenario shown before entering the question set.';
comment on column public.speaking_question_sets.learning_goal_zh is 'Short learner-facing speaking objective shown on the challenge card.';
comment on table public.speaking_question_audio is 'Server-only links from a speaking question to cached question-prompt and model-answer TTS assets.';

commit;
