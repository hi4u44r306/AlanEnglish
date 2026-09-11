alter table public.speaking_questions
    add column if not exists visual_aid jsonb not null default '{}'::jsonb;

alter table public.speaking_questions
    drop constraint if exists speaking_questions_visual_aid_object;

alter table public.speaking_questions
    add constraint speaking_questions_visual_aid_object
    check (jsonb_typeof(visual_aid) = 'object');

comment on column public.speaking_questions.visual_aid is
    'Optional student-facing visual cue. Only a safe local visual kind, value and Traditional-Chinese alt text are stored; no remote image URL is accepted.';

update public.speaking_questions
set question_text = case when id = 31 then 'Look at the clock. What time is it?' else question_text end,
    hint_zh = case when id = 31 then '請看時鐘，用完整句說出時間。' else hint_zh end,
    visual_aid = case id
    when 6 then '{"kind":"flag","value":"taiwan","alt_zh":"台灣國旗"}'::jsonb
    when 7 then '{"kind":"flag","value":"japan","alt_zh":"日本國旗"}'::jsonb
    when 8 then '{"kind":"flag","value":"france","alt_zh":"法國國旗"}'::jsonb
    when 9 then '{"kind":"flag","value":"england","alt_zh":"英國國旗"}'::jsonb
    when 10 then '{"kind":"flag","value":"australia","alt_zh":"澳洲國旗"}'::jsonb
    when 19 then '{"kind":"color-object","value":"banana","alt_zh":"一根黃色香蕉"}'::jsonb
    when 20 then '{"kind":"color-object","value":"sky","alt_zh":"晴朗的藍色天空"}'::jsonb
    when 21 then '{"kind":"color-object","value":"eggplant","alt_zh":"一顆紫色茄子"}'::jsonb
    when 22 then '{"kind":"color-object","value":"orange","alt_zh":"一顆橘色柳橙"}'::jsonb
    when 23 then '{"kind":"color-object","value":"apple","alt_zh":"一顆紅色蘋果"}'::jsonb
    when 24 then '{"kind":"color-object","value":"rainbow","alt_zh":"七色彩虹"}'::jsonb
    when 31 then '{"kind":"clock","value":"7","alt_zh":"時鐘顯示七點整"}'::jsonb
    when 32 then '{"kind":"routine","value":"breakfast-seven","alt_zh":"七點的時鐘和早餐"}'::jsonb
    when 34 then '{"kind":"routine","value":"homework-before-nine","alt_zh":"晚上九點前寫功課的書桌與時鐘"}'::jsonb
    when 36 then '{"kind":"routine","value":"brush-bedtime","alt_zh":"刷牙後準備上床睡覺"}'::jsonb
    else visual_aid
end,
updated_at = now()
where id in (6, 7, 8, 9, 10, 19, 20, 21, 22, 23, 24, 31, 32, 34, 36);
