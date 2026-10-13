-- Seeds the page → video time table for Workbook 1–4 from the chapter times the
-- site already uses for the 看影片 button (src/constants/workbookVideoChapters.js).
-- Each segment ends where the next chapter of the same video starts; the last one runs to the end.
-- Safe to re-run: rows that already exist (same book, video and start time) are skipped.
with source(book_code, video_id, pages) as (values
    ('Workbook_1', 'IgMCnPvCHyI', '{"22":233,"26":728,"27":778,"28":886,"30":1053,"32":1425,"35":1551,"40":1856,"47":2138,"48":2676,"49":3001,"50":3375,"60":3934,"70":4088,"71":4597,"73":4726,"75":4854,"78":4980,"80":5716,"84":5933,"90":6173,"92":6216,"94":6365,"96":6771,"99":6849,"100":6983,"104":7471,"105":7720,"106":8030,"108":8316,"109":8534,"112":8773,"114":8905}'::jsonb),
    ('Workbook_2', '7I0kOD_xFxU', '{"4":0,"6":100,"8":409,"10":520,"14":630,"16":736,"18":848,"20":963,"21":1128,"24":1283,"26":1495,"28":1710,"30":1907,"31":1990,"32":2065,"34":2253,"36":2370,"38":2496,"40":2606,"42":2721,"43":2916,"44":3037,"46":3243,"48":3362,"50":3493,"52":3635,"53":3760,"54":3917,"56":4140,"58":4257,"60":4396,"62":4526,"64":4663,"65":4759,"66":4855,"68":5063,"69":5240,"70":5375,"72":5498,"74":5618,"76":5915,"78":6061,"80":6182,"82":6338,"84":6481,"86":6625,"88":6776,"90":7003,"92":7210,"93":7308,"94":7429,"96":7578,"98":7720,"100":7861,"102":7976,"103":8126,"104":8240,"106":8375,"108":8484,"110":8590,"112":8702,"114":8862,"115":9060,"8question":302,"8answer":202}'::jsonb),
    ('Workbook_3', 'zqgkmTWoTYc', '{"4":0,"5":112,"9":322,"11":457,"15":578,"17":688,"20":790,"23":1116,"26":1298,"28":1432,"30":1555,"32":1640,"36":1732,"38":1838,"40":1932,"42":2025,"43":2136,"46":2233,"49":2468,"51":2554,"52":2703,"53":2852,"54":2994,"55":3115,"56":3303,"59":3420,"61":3557,"63":3685,"67":3815,"69":3936,"71":4119,"73":4280,"77":4427,"79":4562,"81":4700,"83":4838,"84":4968,"85":5096,"87":5243,"91":5366,"93":5495,"95":5640,"97":5772,"99":5913,"100":6055,"101":6178,"105":6311,"106":6542}'::jsonb),
    ('Workbook_4', 'Dr2G4S_0Htw', '{"8":0,"9":382,"13":758,"15":933,"17":1605,"19":1789,"20":1969,"24":2768,"26":3248,"28":3445,"30":3603,"32":3904,"34":4107,"36":4290,"38":4495,"40":4693,"46":4872,"48":5057,"50":5214,"52":5393,"54":5564,"59":5728,"61":5893,"63":6041,"64":6215,"76":6522,"80":6700,"81":6823,"82":6975,"86":7432,"89":7626,"91":7813,"93":8009,"95":8187,"9question":252,"13question":622,"13answer":533,"15question":1033,"17question":1464,"17answer":1368,"21-1":2145,"21-2":2354,"24question":2628,"24answer":2514,"26question":3090,"26answer":2970,"86question":7925,"86answer":7145}'::jsonb)
), chapters as (
    select source.book_code, source.video_id, page.key, page.value::integer as start_seconds
    from source, jsonb_each_text(source.pages) as page
), segments as (
    select
        book_code,
        'https://www.youtube.com/watch?v=' || video_id as video_url,
        (regexp_match(key, '^(\d+)'))[1]::integer as page,
        replace(book_code, '_', ' ') || ' P.' || (regexp_match(key, '^(\d+)'))[1]
            || case when key like '%question' then ' 題目' when key like '%answer' then ' 解答' else coalesce(substring(key from '-\d+$'), '') end as title,
        start_seconds,
        lead(start_seconds) over (partition by book_code order by start_seconds) as end_seconds
    from chapters
)
insert into public.book_video_segments (book_id, title, page_from, page_to, video_url, start_seconds, end_seconds)
select books.id, segments.title, segments.page, segments.page, segments.video_url, segments.start_seconds, segments.end_seconds
from segments
join public.books on books.code = segments.book_code
where not exists (
    select 1 from public.book_video_segments existing
    where existing.book_id = books.id
      and existing.video_url = segments.video_url
      and existing.start_seconds = segments.start_seconds
);
