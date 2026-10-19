-- Category list, second pass (2026-10-19).
--
-- Nature overlapped Landscapes; "Art" fitted everything; Seasons is a theme
-- (a tag) rather than a kind of wallpaper. New list:
--   landscapes, cities, space, anime, games, illustration, photography,
--   pixel-art, minimal, abstract
-- Existing versions: nature and seasons -> landscapes, art -> illustration,
-- duplicates collapsed (so no version is left without a category).
--
-- Postgres can't drop enum values, so the type is rebuilt: the old one is
-- renamed, the column converted through a mapping function, then dropped.

alter type public.pack_category rename to pack_category_old;

create type public.pack_category as enum
  ('landscapes', 'cities', 'space', 'anime', 'games', 'illustration', 'photography', 'pixel-art', 'minimal', 'abstract');

create function public.migrate_categories_v2(c public.pack_category_old[]) returns public.pack_category[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct m order by m), '{}')::public.pack_category[]
  from (
    select case x::text
      when 'nature' then 'landscapes'
      when 'seasons' then 'landscapes'
      when 'art' then 'illustration'
      else x::text end as m
    from unnest(c) x
  ) s
$$;

alter table public.pack_versions drop constraint pack_versions_categories_check;
alter table public.pack_versions alter column categories drop default;
alter table public.pack_versions
  alter column categories type public.pack_category[] using public.migrate_categories_v2(categories);
alter table public.pack_versions alter column categories set default '{}';

drop function public.migrate_categories_v2(public.pack_category_old[]);
drop function public.valid_categories(public.pack_category_old[]);
drop type public.pack_category_old;

create function public.valid_categories(c public.pack_category[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(c) <= 2
     and array_position(c, null) is null
     and cardinality(c) = (select count(distinct x) from unnest(c) x)
$$;
grant execute on function public.valid_categories(public.pack_category[]) to anon, authenticated;

alter table public.pack_versions
  add constraint pack_versions_categories_check check (public.valid_categories(categories));
