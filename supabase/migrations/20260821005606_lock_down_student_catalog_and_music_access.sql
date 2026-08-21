do $$
begin
  if not exists (select 1 from storage.buckets where id = 'music') then
    raise exception 'music storage bucket does not exist';
  end if;
end
$$;

update storage.buckets
set public = false
where id = 'music';

alter table public.students enable row level security;
alter table public.book_categories enable row level security;
alter table public.books enable row level security;
alter table public.music_tracks enable row level security;

drop policy if exists "Allow login student lookup" on public.students;
drop policy if exists "Allow login student update" on public.students;
drop policy if exists "Public can read book categories" on public.book_categories;
drop policy if exists "Public can read books" on public.books;
drop policy if exists "Allow music track inserts" on public.music_tracks;
drop policy if exists "Public can read music tracks" on public.music_tracks;
drop policy if exists "Allow music uploads" on storage.objects;
drop policy if exists "Public can read music" on storage.objects;

revoke all privileges on table public.students from anon, authenticated;
revoke all privileges on table public.book_categories from anon, authenticated;
revoke all privileges on table public.books from anon, authenticated;
revoke all privileges on table public.music_tracks from anon, authenticated;
