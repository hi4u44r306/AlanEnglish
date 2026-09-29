begin;

-- The audio objects already exist in the private R2 bucket under
-- basic-reading/{collection}/Track{number}.mp3.  This migration only adds
-- their formal learning-catalog records so the authenticated Playlist,
-- listening coverage, progress and reward flow can use the same objects.
with collections(level_value, book_number, collection_id, track_count, sort_order) as (
    values
        (400,  1, 'br400_1',  51, 401),
        (400,  2, 'br400_2',  51, 402),
        (400,  3, 'br400_3',  51, 403),
        (800,  1, 'br800_1',  49, 801),
        (800,  2, 'br800_2',  49, 802),
        (800,  3, 'br800_3',  49, 803),
        (1200, 1, 'br1200_1', 33, 1201),
        (1200, 2, 'br1200_2', 33, 1202),
        (1200, 3, 'br1200_3', 33, 1203)
)
insert into public.books (
    category_id,
    name,
    code,
    sort_order,
    enabled,
    archived_at,
    content_scope,
    description
)
select
    category.id,
    format('Basic Reading %s 第 %s 冊', collection.level_value, collection.book_number),
    format('BasicReading_%s_%s', collection.level_value, collection.book_number),
    collection.sort_order,
    true,
    null,
    'formal',
    format('Basic Reading %s 第 %s 冊，共 %s 軌。', collection.level_value, collection.book_number, collection.track_count)
from collections collection
cross join lateral (
    select id
    from public.book_categories
    where code = 'textbook'
      and enabled = true
    limit 1
) category
on conflict (code) do update
set
    category_id = excluded.category_id,
    name = excluded.name,
    sort_order = excluded.sort_order,
    enabled = true,
    archived_at = null,
    content_scope = 'formal',
    description = excluded.description,
    updated_at = now();

with collections(level_value, book_number, collection_id, track_count) as (
    values
        (400,  1, 'br400_1',  51),
        (400,  2, 'br400_2',  51),
        (400,  3, 'br400_3',  51),
        (800,  1, 'br800_1',  49),
        (800,  2, 'br800_2',  49),
        (800,  3, 'br800_3',  49),
        (1200, 1, 'br1200_1', 33),
        (1200, 2, 'br1200_2', 33),
        (1200, 3, 'br1200_3', 33)
), catalog_books as (
    select
        book.id as book_id,
        book.name as book_name,
        collection.collection_id,
        collection.track_count
    from collections collection
    join public.books book
      on book.code = format('BasicReading_%s_%s', collection.level_value, collection.book_number)
), desired_tracks as (
    select
        catalog_book.book_id,
        catalog_book.book_name,
        catalog_book.collection_id,
        track_number
    from catalog_books catalog_book
    cross join lateral generate_series(1, catalog_book.track_count) track_number
)
insert into public.music_tracks (
    book_id,
    page,
    base_page,
    display_page,
    track_type,
    part_number,
    track_key,
    title,
    music_name,
    audio_url,
    sort_order,
    enabled,
    storage_provider,
    subtitle_status,
    subtitle_cues,
    preview_enabled
)
select
    desired.book_id,
    format('Track %s', desired.track_number),
    format('Track %s', desired.track_number),
    format('Track %s', desired.track_number),
    'main',
    null,
    format('track_%s', desired.track_number),
    format('%s Track %s', desired.book_name, desired.track_number),
    format('Track%s.mp3', desired.track_number),
    format('basic-reading/%s/Track%s.mp3', desired.collection_id, desired.track_number),
    desired.track_number,
    true,
    'r2',
    'none',
    '[]'::jsonb,
    false
from desired_tracks desired
where not exists (
    select 1
    from public.music_tracks existing
    where existing.book_id = desired.book_id
      and existing.track_key = format('track_%s', desired.track_number)
);

do $$
declare
    basic_reading_book_count integer;
    basic_reading_track_count integer;
begin
    select count(*) into basic_reading_book_count
    from public.books
    where code ~ '^BasicReading_(400|800|1200)_[123]$'
      and enabled = true
      and archived_at is null
      and content_scope = 'formal';

    select count(*) into basic_reading_track_count
    from public.music_tracks track
    join public.books book on book.id = track.book_id
    where book.code ~ '^BasicReading_(400|800|1200)_[123]$'
      and track.enabled = true
      and track.storage_provider = 'r2'
      and track.audio_url ~ '^basic-reading/br(400|800|1200)_[123]/Track[1-9][0-9]*\.mp3$';

    if basic_reading_book_count <> 9 then
        raise exception 'Basic Reading catalog expected 9 enabled books, found %', basic_reading_book_count;
    end if;
    if basic_reading_track_count <> 399 then
        raise exception 'Basic Reading catalog expected 399 enabled R2 tracks, found %', basic_reading_track_count;
    end if;
end;
$$;

commit;
