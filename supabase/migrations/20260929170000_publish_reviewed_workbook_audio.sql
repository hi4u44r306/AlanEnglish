begin;

create temporary table _workbook_audio_release (
    action text not null,
    book_id bigint not null,
    track_id bigint,
    page text not null,
    track_key text not null,
    old_url text,
    new_url text not null,
    music_name text not null,
    byte_size bigint not null,
    etag text not null,
    duration_seconds numeric not null,
    sort_order integer not null
) on commit drop;

insert into _workbook_audio_release
    (action, book_id, track_id, page, track_key, old_url, new_url, music_name, byte_size, etag, duration_seconds, sort_order)
values
    ('insert', 1, null, 'P26',  'p26:main:0',  null, 'Workbook_1/releases/2026-09-29/Workbook_1_P26_7fdddab849aa.mp3',   'Workbook_1_P26.mp3',  1221314, '0ae5708bd7ce5a698dda75aea39262ea',  50.856,  2620),
    ('update', 1, 25,   'P48',  'p48:main:0',  'Workbook_1/Workbook_1_P48.mp3',  'Workbook_1/releases/2026-09-29/Workbook_1_P48_5910e563ec72.mp3',   'Workbook_1_P48.mp3',  7847618, '1b36ea43b679c7ea66b2105507c6f100', 326.952,  4820),
    ('insert', 1, null, 'P84',  'p84:main:0',  null, 'Workbook_1/releases/2026-09-29/Workbook_1_P84_557e6fc8fb24.mp3',   'Workbook_1_P84.mp3',  5767106, '5de1d28661eabbe1ca7c0f1533694145', 240.264,  8420),
    ('insert', 1, null, 'P99',  'p99:main:0',  null, 'Workbook_1/releases/2026-09-29/Workbook_1_P99_8bbb8441b6bf.mp3',   'Workbook_1_P99.mp3',  3216002, '61bb3020ebadb1926333872e19062265', 133.968,  9920),
    ('update', 1, 4,    'P104', 'p104:main:0', 'Workbook_1/Workbook_1_P104.mp3', 'Workbook_1/releases/2026-09-29/Workbook_1_P104_1338e271c2ff.mp3', 'Workbook_1_P104.mp3', 5977922, 'f61fd073809ad14b4133ea8b3d07bdc2', 249.048, 10420),
    ('update', 1, 5,    'P105', 'p105:main:0', 'Workbook_1/Workbook_1_P105.mp3', 'Workbook_1/releases/2026-09-29/Workbook_1_P105_77b8679938fc.mp3', 'Workbook_1_P105.mp3', 7453634, '8db64bed7b4d2e78693fd6832767a15e', 310.536, 10520),
    ('update', 1, 6,    'P106', 'p106:main:0', 'Workbook_1/Workbook_1_P106.mp3', 'Workbook_1/releases/2026-09-29/Workbook_1_P106_160e26558b01.mp3', 'Workbook_1_P106.mp3', 6885698, 'b4990a59746fab4253578b4a7951dd74', 286.872, 10620),
    ('update', 1, 11,   'P114', 'p114:main:0', 'Workbook_1/Workbook_1_P114.mp3', 'Workbook_1/releases/2026-09-29/Workbook_1_P114_94d74e247632.mp3', 'Workbook_1_P114.mp3', 3044930, '9cccc8773792004bd46c1672c7e28a89', 126.840, 11420),
    ('update', 2, 48,   'P4',   'p4:main:0',   'Workbook_2/Workbook_2_P4.mp3',   'Workbook_2/releases/2026-09-29/Workbook_2_P4_a749b8ca48bd.mp3',     'Workbook_2_P4.mp3',   2058242, '9395ed4343977e8a732e1ee2b5a18a49',  85.728,   420),
    ('update', 2, 52,   'P8',   'p8:main:0',   'Workbook_2/Workbook_2_P8.mp3',   'Workbook_2/releases/2026-09-29/Workbook_2_P8_847c0dc8761b.mp3',     'Workbook_2_P8.mp3',   2150978, '9f2db1bcbdb99189a85d00cce5adc810',  89.592,   820),
    ('update', 2, 112,  'P10',  'p10:main:0',  'Workbook_2/Workbook_2_P10.mp3',  'Workbook_2/releases/2026-09-29/Workbook_2_P10_ff76fafbb920.mp3',   'Workbook_2_P10.mp3',  2163650, '32bcc36699c238423a86fcd8ed91f7f3',  90.120,  1020),
    ('update', 4, 203,  'P9',   'p9:main:0',   'Workbook_4/Workbook_4_P9.mp3',   'Workbook_4/releases/2026-09-29/Workbook_4_P9_13aaed2915d4.mp3',     'Workbook_4_P9.mp3',   2210733, 'ab2b35fa0985b0b54ed9167bea0f3bac',  92.088,   920),
    ('update', 5, 215,  'P27',  'p27:main:0',  'Workbook_5/Workbook_5_P27.mp3',  'Workbook_5/releases/2026-09-29/Workbook_5_P27_b8fc797c799f.mp3',   'Workbook_5_P27.mp3',  3301826, '701076f500a053469a4bb06f385c10eb', 137.544,  2720);

do $release_guard$
declare
    update_rows integer;
    incompatible_rows integer;
    insert_conflicts integer;
begin
    select count(*) into update_rows
    from _workbook_audio_release release
    join public.music_tracks track on track.id = release.track_id
    where release.action = 'update'
      and track.book_id = release.book_id
      and track.page = release.page
      and track.track_key = release.track_key;

    if update_rows <> 10 then
        raise exception 'Workbook audio release stopped: expected 10 existing tracks, found %', update_rows;
    end if;

    select count(*) into incompatible_rows
    from _workbook_audio_release release
    join public.music_tracks track on track.id = release.track_id
    where release.action = 'update'
      and (track.audio_url not in (release.old_url, release.new_url)
        or track.storage_provider <> 'r2');

    if incompatible_rows <> 0 then
        raise exception 'Workbook audio release stopped: % existing tracks changed unexpectedly', incompatible_rows;
    end if;

    select count(*) into insert_conflicts
    from _workbook_audio_release release
    join public.music_tracks track
      on track.book_id = release.book_id and track.track_key = release.track_key
    where release.action = 'insert'
      and (track.audio_url <> release.new_url or track.storage_provider <> 'r2');

    if insert_conflicts <> 0 then
        raise exception 'Workbook audio release stopped: % new track keys already point elsewhere', insert_conflicts;
    end if;
end
$release_guard$;

update public.music_tracks track
set audio_url = release.new_url,
    storage_provider = 'r2',
    storage_size_bytes = release.byte_size,
    storage_etag = release.etag,
    storage_verified_at = now(),
    duration_seconds = round(release.duration_seconds, 2),
    updated_at = now()
from _workbook_audio_release release
where release.action = 'update'
  and track.id = release.track_id
  and track.audio_url = release.old_url;

insert into public.music_tracks (
    book_id, page, base_page, display_page, track_type, part_number,
    track_key, title, music_name, audio_url, sort_order, enabled,
    storage_provider, storage_size_bytes, storage_etag, storage_verified_at,
    duration_seconds
)
select
    release.book_id,
    release.page,
    release.page,
    release.page,
    'main',
    null,
    release.track_key,
    format('Workbook %s %s', release.book_id, release.page),
    release.music_name,
    release.new_url,
    release.sort_order,
    true,
    'r2',
    release.byte_size,
    release.etag,
    now(),
    round(release.duration_seconds, 2)
from _workbook_audio_release release
where release.action = 'insert'
  and not exists (
      select 1
      from public.music_tracks track
      where track.book_id = release.book_id
        and track.track_key = release.track_key
  );

do $release_verify$
declare
    verified_rows integer;
begin
    select count(*) into verified_rows
    from _workbook_audio_release release
    join public.music_tracks track
      on track.book_id = release.book_id and track.track_key = release.track_key
    where track.page = release.page
      and track.audio_url = release.new_url
      and track.storage_provider = 'r2'
      and track.storage_size_bytes = release.byte_size
      and track.storage_etag = release.etag
      and track.duration_seconds = round(release.duration_seconds, 2)
      and track.enabled = true;

    if verified_rows <> 13 then
        raise exception 'Workbook audio release verification failed: expected 13 rows, found %', verified_rows;
    end if;
end
$release_verify$;

commit;
