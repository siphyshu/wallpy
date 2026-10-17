-- Categories (a short curated list) alongside free tags.
--
-- Every pack version picks one or two categories. They live on the version,
-- like tags, because the version is what gets reviewed. The enum is the list:
-- the API can't invent others. Drafts may have none yet; a version can't leave
-- draft (submit, approve) without at least one.
--
-- Tags stay free-form but normalised: lowercase kebab-case, at most 30 chars,
-- at most 10, and now no duplicates. public_tags() feeds the tag autocomplete.

create type public.pack_category as enum
  ('nature', 'landscapes', 'cities', 'space', 'anime', 'games', 'art', 'minimal', 'abstract', 'seasons');

create function public.valid_categories(c public.pack_category[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(c) <= 2
     and array_position(c, null) is null
     and cardinality(c) = (select count(distinct x) from unnest(c) x)
$$;

create or replace function public.valid_tags(t text[]) returns boolean
language sql immutable as $$
  select cardinality(t) <= 10
     and not exists (select 1 from unnest(t) x where x is null or x !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(x) > 30)
     and cardinality(t) = (select count(distinct x) from unnest(t) x)
$$;

alter table public.pack_versions
  add column categories public.pack_category[] not null default '{}' check (public.valid_categories(categories));
create index on public.pack_versions using gin (categories);

-- Backfill the packs that exist today (all approved).
update public.pack_versions v set categories = c.cats::public.pack_category[]
from (values
  ('zelda-wind-waker', '{games,landscapes}'),
  ('tokyo-street', '{cities,anime}'),
  ('ocean-hours', '{nature}'),
  ('greasy-diner', '{art,cities}')
) as c(slug, cats), public.packs p
where p.id = v.pack_id and p.slug = c.slug;

alter table public.pack_versions
  add constraint pack_versions_categories_required check (status = 'draft' or cardinality(categories) >= 1);

grant insert (categories) on public.pack_versions to authenticated;
grant update (categories) on public.pack_versions to authenticated;

-- Tags in use on public packs, most used first (for the upload autocomplete).
create function public.public_tags() returns table (tag text, uses bigint)
language sql stable security invoker set search_path = '' as $$
  select t, count(*) from public.pack_versions v, unnest(v.tags) t
  where public.is_public_version(v.id)
  group by t order by count(*) desc, t
  limit 500
$$;
revoke execute on function public.public_tags() from public;
grant execute on function public.public_tags() to anon, authenticated;
grant execute on function public.valid_categories(public.pack_category[]) to anon, authenticated;

-- write_version: as before (20261019120000), plus categories.
create or replace function public.write_version(p_pack_id uuid, p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_artist uuid;
  v_version uuid;
  v_cover uuid;
  f jsonb;
  i int := 0;
begin
  if coalesce((p ->> 'uploader_is_artist')::boolean, false) is false and p -> 'artist' ->> 'name' is not null then
    select id into v_artist from public.artists where lower(name) = lower(trim(p -> 'artist' ->> 'name'));
    if v_artist is null then
      insert into public.artists (name, url)
      values (trim(p -> 'artist' ->> 'name'), nullif(trim(p -> 'artist' ->> 'url'), ''))
      returning id into v_artist;
    end if;
  end if;

  insert into public.pack_versions (pack_id, title, description, tags, categories, schedule, ai_use, license, license_notes,
                                    uploader_is_artist, artist_id, thumb_sha256, preview_sha256)
  values (
    p_pack_id,
    p ->> 'title',
    nullif(p ->> 'description', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p -> 'categories')), '{}')::public.pack_category[],
    p -> 'schedule',
    (p ->> 'ai_use')::public.ai_use,
    coalesce((p ->> 'license')::public.pack_license, 'personal-use'),
    nullif(p ->> 'license_notes', ''),
    coalesce((p ->> 'uploader_is_artist')::boolean, false),
    v_artist,
    p ->> 'thumb_sha256',
    p ->> 'preview_sha256'
  )
  returning id into v_version;

  for f in select * from jsonb_array_elements(p -> 'files') loop
    insert into public.version_files (version_id, path, sha256, sort_order, thumb_sha256, preview_sha256)
    values (v_version, f ->> 'path', f ->> 'sha256', i, f ->> 'thumb_sha256', f ->> 'preview_sha256');
    i := i + 1;
  end loop;

  select id into v_cover from public.version_files where version_id = v_version and path = p ->> 'cover';
  update public.pack_versions set cover_file_id = coalesce(v_cover,
    (select id from public.version_files where version_id = v_version order by sort_order limit 1))
  where id = v_version;

  if coalesce((p ->> 'submit')::boolean, false) then
    perform public.moderate(v_version, 'submit');
  end if;

  return jsonb_build_object(
    'version_id', v_version,
    'status', (select status from public.pack_versions where id = v_version)
  );
end $$;
