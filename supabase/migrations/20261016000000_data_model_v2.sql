-- Data model v2. Design and rationale: docs/schema-design.md
--
-- Access model, in one place:
--   * Supabase grants nothing on these tables by default here: every grant below
--     is explicit, per column where it matters.
--   * RLS decides which rows; column grants decide which fields.
--   * Anything that changes review state goes through moderate() (security definer).
--   * downloads and blobs are written only by the server (service role).

-- ---------------------------------------------------------------------------
-- Park the v1 tables (with their indexes) out of the way; migrated and dropped below
-- ---------------------------------------------------------------------------

create schema legacy;
alter table public.users set schema legacy;
alter table public.packs set schema legacy;
alter table public.pack_images set schema legacy;
alter table public.favourites set schema legacy;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.pack_kind as enum ('timeblocks', 'days', 'album');
create type public.version_status as enum ('draft', 'pending', 'approved', 'rejected', 'superseded');
create type public.moderation_action as enum ('submit', 'approve', 'reject', 'takedown', 'restore');
create type public.pack_license as enum ('personal-use', 'cc-by-4.0', 'cc-by-nc-4.0', 'cc0', 'other');
create type public.download_client as enum ('cli', 'web');

-- ---------------------------------------------------------------------------
-- Validation helpers (immutable, usable in check constraints)
-- ---------------------------------------------------------------------------

create function public.is_http_url(u text) returns boolean
language sql immutable as $$
  select u ~ '^https?://[^\s/$.?#][^\s]*$' and char_length(u) <= 300
$$;

-- links: [{"name": "...", "url": "https://..."}], at most 10
create function public.valid_links(l jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(l) = 'array'
     and jsonb_array_length(l) <= 10
     and not exists (
       select 1 from jsonb_array_elements(l) e
       where jsonb_typeof(e) <> 'object'
          or not public.is_http_url(e ->> 'url')
          or char_length(coalesce(e ->> 'name', '')) > 40
     )
$$;

create function public.valid_tags(t text[]) returns boolean
language sql immutable as $$
  select cardinality(t) <= 10
     and not exists (select 1 from unnest(t) x where x !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(x) > 30)
$$;

-- Every image a schedule references, in any of the three kinds.
create function public.schedule_images(s jsonb) returns setof text
language sql immutable as $$
  select jsonb_path_query(s, '$.timeblocks.*.images[*]') #>> '{}'
  union
  select jsonb_path_query(s, '$.days.*.images[*]') #>> '{}'
  union
  select jsonb_path_query(s, '$.album.images[*]') #>> '{}'
$$;

-- Album interval ("30m" | "2h" | "1d") in minutes; null if malformed.
create function public.interval_minutes(i text) returns int
language sql immutable as $$
  select case
    when i !~ '^[1-9][0-9]{0,4}[mhd]$' then null
    when right(i, 1) = 'm' then left(i, -1)::int
    when right(i, 1) = 'h' then left(i, -1)::int * 60
    else left(i, -1)::int * 1440
  end
$$;

-- Structural checks the database can do cheaply. The full JSON Schema
-- (spec/schedule.schema.json) is enforced by the server before insert.
create function public.schedule_shape_ok(k public.pack_kind, s jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(s) = 'object'
     and s -> 'meta' ->> 'type' = k::text
     and char_length(coalesce(s -> 'meta' ->> 'name', '')) between 1 and 80
     and case k
       when 'timeblocks' then jsonb_typeof(s -> 'timeblocks') = 'object' and not (s ? 'days') and not (s ? 'album')
       when 'days'       then jsonb_typeof(s -> 'days') = 'object' and not (s ? 'timeblocks') and not (s ? 'album')
       when 'album'      then jsonb_typeof(s -> 'album') = 'object' and not (s ? 'timeblocks') and not (s ? 'days')
                              and coalesce(public.interval_minutes(s -> 'album' ->> 'interval') between 5 and 10080, false)
     end
     and not exists (
       select 1 from public.schedule_images(s) img
       where img !~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{0,99}\.(jpg|jpeg|png|webp)$'
     )
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text check (char_length(display_name) <= 60),
  bio text check (char_length(bio) <= 500),
  website text check (public.is_http_url(website)),
  links jsonb not null default '[]' check (public.valid_links(links)),
  contact_email text check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(contact_email) <= 254),
  avatar_key text,
  cover_key text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A profile can only point at images inside its own folder.
  check (avatar_key ~ ('^profiles/' || id || '/[0-9a-f]{64}\.(jpg|png|webp)$')),
  check (cover_key ~ ('^profiles/' || id || '/[0-9a-f]{64}\.(jpg|png|webp)$'))
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  url text check (public.is_http_url(url)),
  avatar_key text check (avatar_key ~ '^artists/[0-9a-f]{64}\.(jpg|png|webp)$'),
  profile_id uuid unique references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index artists_name_key on public.artists (lower(name));

create table public.packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  current_version_id uuid,
  is_listed boolean not null default true,
  removed_at timestamptz,
  removed_reason text check (char_length(removed_reason) <= 1000),
  download_count integer not null default 0,
  favourite_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.blobs (
  sha256 text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  size bigint not null check (size > 0 and size <= 30 * 1024 * 1024),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  width integer check (width between 1 and 20000),
  height integer check (height between 1 and 20000),
  blurhash text check (char_length(blurhash) <= 100),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.pack_versions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.packs (id) on delete cascade,
  number integer not null,
  status public.version_status not null default 'draft',
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 2000),
  tags text[] not null default '{}' check (public.valid_tags(tags)),
  kind public.pack_kind not null,
  schedule jsonb not null check (public.schedule_shape_ok(kind, schedule)),
  cover_file_id uuid,
  thumb_sha256 text references public.blobs (sha256),
  preview_sha256 text references public.blobs (sha256),
  artist_id uuid references public.artists (id) on delete set null,
  uploader_is_artist boolean not null default false,
  license public.pack_license not null default 'personal-use',
  license_notes text check (char_length(license_notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  unique (pack_id, number)
);
-- At most one work-in-progress version per pack.
create unique index pack_versions_one_open on public.pack_versions (pack_id)
  where status in ('draft', 'pending');

create table public.version_files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.pack_versions (id) on delete cascade,
  path text not null check (path ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{0,99}\.(jpg|jpeg|png|webp)$'),
  sha256 text not null references public.blobs (sha256),
  sort_order integer not null default 0
);
-- Case-insensitive: macOS/Windows can't hold "Dawn.jpg" and "dawn.jpg" side by side.
create unique index version_files_path_key on public.version_files (version_id, lower(path));

alter table public.packs
  add constraint packs_current_version_fkey foreign key (current_version_id)
  references public.pack_versions (id) on delete set null deferrable initially deferred;
alter table public.pack_versions
  add constraint pack_versions_cover_file_fkey foreign key (cover_file_id)
  references public.version_files (id) on delete set null deferrable initially deferred;

create table public.moderation_events (
  id bigint generated always as identity primary key,
  version_id uuid not null references public.pack_versions (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action public.moderation_action not null,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create table public.downloads (
  id bigint generated always as identity primary key,
  pack_id uuid not null references public.packs (id) on delete cascade,
  version_id uuid references public.pack_versions (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  client public.download_client not null,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);
-- One counted download per pack per client IP per day.
create unique index downloads_dedupe on public.downloads (pack_id, ip_hash, day);

create table public.favourites (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pack_id uuid not null references public.packs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, pack_id)
);

create index on public.packs (owner_id);
create index on public.pack_versions (pack_id);
create index on public.pack_versions using gin (tags);
create index on public.version_files (sha256);
create index on public.moderation_events (version_id);
create index on public.downloads (pack_id);
create index on public.favourites (pack_id);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('moderator', 'admin') from public.profiles where id = auth.uid()), false)
$$;

create function public.owns_pack(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.packs where id = p and owner_id = auth.uid())
$$;

-- The version anyone may see: a pack's current approved version, if the pack is public.
create function public.is_public_version(v uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.packs p
    where p.current_version_id = v and p.is_listed and p.removed_at is null
  )
$$;

create function public.can_see_version(v uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_public_version(v)
      or public.is_moderator()
      or exists (select 1 from public.pack_versions pv where pv.id = v and public.owns_pack(pv.pack_id))
$$;

-- blobs and version_files each need to look at the other. Doing that inside
-- their policies recurses (each read re-enters the other's RLS), so the
-- cross-table checks live here, in security definer functions.
create function public.blob_is_public(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.version_files f where f.sha256 = s and public.is_public_version(f.version_id))
      or exists (select 1 from public.pack_versions v
                 where (v.thumb_sha256 = s or v.preview_sha256 = s) and public.is_public_version(v.id))
$$;

-- A user may put a blob in their pack if they uploaded it or it's already public.
create function public.can_use_blob(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blobs b where b.sha256 = s and b.uploaded_by = auth.uid())
      or public.blob_is_public(s)
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Version numbers are assigned, never chosen.
create function public.pack_versions_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(max(number), 0) + 1 into new.number
  from public.pack_versions where pack_id = new.pack_id;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;
create trigger pack_versions_before_insert before insert on public.pack_versions
  for each row execute function public.pack_versions_before_insert();

-- Rules for API callers. current_user is 'anon'/'authenticated' for API
-- requests; it is the function owner inside security definer functions such as
-- moderate(), and 'service_role'/'postgres' for the server and migrations.
-- Unlike a session flag, it can't be set by the caller.
create function public.is_api_caller() returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated')
$$;

-- Once submitted, a version's content is frozen, and status only changes
-- through moderate().
create function public.pack_versions_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_api_caller() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.submitted_at is distinct from old.submitted_at
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.pack_id is distinct from old.pack_id
     or new.number is distinct from old.number then
    raise exception 'version status and identity can only change through moderate()'
      using errcode = 'insufficient_privilege';
  end if;
  if old.status <> 'draft' then
    raise exception 'version % is % and can no longer be edited; create a new version', old.number, old.status
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger pack_versions_guard before update on public.pack_versions
  for each row execute function public.pack_versions_guard();

create function public.version_files_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v uuid := coalesce(new.version_id, old.version_id);
begin
  if public.is_api_caller()
     and (select status from public.pack_versions where id = v) <> 'draft' then
    raise exception 'files of a submitted version are frozen' using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end $$;
create trigger version_files_guard before insert or update or delete on public.version_files
  for each row execute function public.version_files_guard();

-- Cached counters.
create function public.downloads_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.packs set download_count = download_count + 1 where id = new.pack_id;
  return new;
end $$;
create trigger downloads_count after insert on public.downloads
  for each row execute function public.downloads_count();

create function public.favourites_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.packs
  set favourite_count = favourite_count + case when tg_op = 'INSERT' then 1 else -1 end
  where id = coalesce(new.pack_id, old.pack_id);
  return coalesce(new, old);
end $$;
create trigger favourites_count after insert or delete on public.favourites
  for each row execute function public.favourites_count();

-- ---------------------------------------------------------------------------
-- moderate(): the only way review state changes
-- ---------------------------------------------------------------------------

create function public.moderate(p_version uuid, p_action public.moderation_action, p_notes text default null)
returns public.version_status
language plpgsql security definer set search_path = '' as $$
declare
  v public.pack_versions;
  p public.packs;
  missing text;
  unused text;
begin
  select * into v from public.pack_versions where id = p_version for update;
  if not found then
    raise exception 'version not found' using errcode = 'no_data_found';
  end if;
  select * into p from public.packs where id = v.pack_id for update;

  case p_action
  when 'submit' then
    if p.owner_id is distinct from auth.uid() then
      raise exception 'only the pack owner can submit' using errcode = 'insufficient_privilege';
    end if;
    if v.status <> 'draft' then
      raise exception 'only drafts can be submitted (this one is %)', v.status;
    end if;
    -- Every image the schedule names must be in the version, and vice versa.
    select string_agg(img, ', ') into missing
    from public.schedule_images(v.schedule) img
    where not exists (select 1 from public.version_files f where f.version_id = v.id and lower(f.path) = lower(img));
    if missing is not null then
      raise exception 'schedule references missing images: %', missing using errcode = 'check_violation';
    end if;
    select string_agg(f.path, ', ') into unused
    from public.version_files f
    where f.version_id = v.id
      and not exists (select 1 from public.schedule_images(v.schedule) img where lower(img) = lower(f.path));
    if unused is not null then
      raise exception 'images not used by the schedule: %', unused using errcode = 'check_violation';
    end if;
    update public.pack_versions set status = 'pending', submitted_at = now() where id = v.id;

  when 'approve' then
    if not public.is_moderator() then
      raise exception 'moderators only' using errcode = 'insufficient_privilege';
    end if;
    if v.status <> 'pending' then
      raise exception 'only pending versions can be approved (this one is %)', v.status;
    end if;
    update public.pack_versions set status = 'superseded'
      where pack_id = v.pack_id and status = 'approved';
    update public.pack_versions
      set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
      where id = v.id;
    update public.packs set current_version_id = v.id where id = v.pack_id;

  when 'reject' then
    if not public.is_moderator() then
      raise exception 'moderators only' using errcode = 'insufficient_privilege';
    end if;
    if v.status <> 'pending' then
      raise exception 'only pending versions can be rejected (this one is %)', v.status;
    end if;
    update public.pack_versions
      set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
      where id = v.id;

  when 'takedown' then
    if not public.is_moderator() then
      raise exception 'moderators only' using errcode = 'insufficient_privilege';
    end if;
    update public.packs set removed_at = now(), removed_reason = p_notes where id = v.pack_id;

  when 'restore' then
    if not public.is_moderator() then
      raise exception 'moderators only' using errcode = 'insufficient_privilege';
    end if;
    update public.packs set removed_at = null, removed_reason = null where id = v.pack_id;
  end case;

  insert into public.moderation_events (version_id, actor_id, action, notes)
  values (v.id, auth.uid(), p_action, p_notes);

  return (select status from public.pack_versions where id = v.id);
end $$;

-- ---------------------------------------------------------------------------
-- Signup: create the profile
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(trim(new.raw_user_meta_data ->> 'username')),
    nullif(trim(new.raw_user_meta_data ->> 'name'), '')
  );
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Move the existing data, then drop the v1 tables
-- ---------------------------------------------------------------------------

insert into public.profiles (id, username, display_name, bio, website, links, contact_email, role, created_at)
select u.id, u.username, nullif(u.name, ''), nullif(u.bio, ''),
       case when public.is_http_url(u.website) then u.website end,
       case when jsonb_typeof(u.links) = 'array' and public.valid_links(u.links) then u.links else '[]'::jsonb end,
       nullif(u.email_contact, ''),
       coalesce(u.role, 'user')::public.user_role,
       coalesce(u.created_at, now())
from legacy.users u;

-- Pack identities keep their ids. Slugs are tidied while nothing links to them
-- yet: random upload suffixes dropped, and the zelda-wind-"walker" typo fixed.
-- Content (versions, files) is loaded by supabase/seed/load_recovered_packs.py.
insert into public.packs (id, slug, owner_id, is_listed, created_at)
select p.id,
       case p.slug
         when 'zelda-wind-walker' then 'zelda-wind-waker'
         when 'ocean-hours-mj3csy5s' then 'ocean-hours'
         when 'tokyo-street-mj32fzzl' then 'tokyo-street'
         else p.slug
       end,
       p.uploaded_by, true, coalesce(p.created_at, now())
from legacy.packs p
where p.uploaded_by is not null;

-- Run the deferred foreign-key checks now: Postgres refuses ALTER TABLE (below)
-- while a table has pending trigger events.
set constraints all immediate;

drop schema legacy cascade;
drop function if exists public.record_download(text);
drop function if exists public.packs_before_update();

-- ---------------------------------------------------------------------------
-- Grants and row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.packs enable row level security;
alter table public.blobs enable row level security;
alter table public.pack_versions enable row level security;
alter table public.version_files enable row level security;
alter table public.moderation_events enable row level security;
alter table public.downloads enable row level security;
alter table public.favourites enable row level security;

revoke all on public.profiles, public.artists, public.packs, public.blobs, public.pack_versions,
  public.version_files, public.moderation_events, public.downloads, public.favourites
  from anon, authenticated;

-- profiles: public; owners edit their own profile fields.
grant select on public.profiles to anon, authenticated;
grant update (display_name, bio, website, links, contact_email, avatar_key, cover_key)
  on public.profiles to authenticated;
create policy "profiles are public" on public.profiles for select using (true);
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- artists: public; anyone signed in can add one (when crediting); moderators edit.
grant select on public.artists to anon, authenticated;
grant insert (name, url) on public.artists to authenticated;
grant update (name, url, avatar_key, profile_id) on public.artists to authenticated;
create policy "artists are public" on public.artists for select using (true);
create policy "add artists" on public.artists for insert to authenticated
  with check (created_by = auth.uid());
create policy "moderators edit artists" on public.artists for update to authenticated
  using (public.is_moderator());
create function public.artists_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;
create trigger artists_before_insert before insert on public.artists
  for each row execute function public.artists_before_insert();

-- packs: visible when public, to the owner, or to moderators.
grant select on public.packs to anon, authenticated;
grant insert (slug, owner_id, is_listed) on public.packs to authenticated;
grant update (is_listed) on public.packs to authenticated;
grant delete on public.packs to authenticated;
create policy "see packs" on public.packs for select using (
  (current_version_id is not null and is_listed and removed_at is null)
  or owner_id = auth.uid() or public.is_moderator()
);
create policy "create own packs" on public.packs for insert to authenticated
  with check (owner_id = auth.uid());
create policy "update own packs" on public.packs for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own packs" on public.packs for delete to authenticated
  using (owner_id = auth.uid());

-- pack_versions: owners write drafts; status changes only via moderate().
grant select on public.pack_versions to anon, authenticated;
grant insert (pack_id, title, description, tags, kind, schedule, cover_file_id, thumb_sha256,
              preview_sha256, artist_id, uploader_is_artist, license, license_notes)
  on public.pack_versions to authenticated;
grant update (title, description, tags, kind, schedule, cover_file_id, thumb_sha256,
              preview_sha256, artist_id, uploader_is_artist, license, license_notes)
  on public.pack_versions to authenticated;
grant delete on public.pack_versions to authenticated;
create policy "see versions" on public.pack_versions for select using (public.can_see_version(id));
create policy "create drafts" on public.pack_versions for insert to authenticated
  with check (public.owns_pack(pack_id) and status = 'draft');
create policy "edit own drafts" on public.pack_versions for update to authenticated
  using (public.owns_pack(pack_id)) with check (public.owns_pack(pack_id));
create policy "delete own drafts" on public.pack_versions for delete to authenticated
  using (public.owns_pack(pack_id) and status = 'draft');

-- version_files: follow the version.
grant select on public.version_files to anon, authenticated;
grant insert (version_id, path, sha256, sort_order) on public.version_files to authenticated;
grant update (path, sort_order) on public.version_files to authenticated;
grant delete on public.version_files to authenticated;
create policy "see files" on public.version_files for select using (public.can_see_version(version_id));
create policy "write own draft files" on public.version_files for all to authenticated
  using (exists (select 1 from public.pack_versions v where v.id = version_id and public.owns_pack(v.pack_id)))
  with check (exists (select 1 from public.pack_versions v where v.id = version_id and public.owns_pack(v.pack_id))
              and public.can_use_blob(sha256));

-- blobs: rows are created by the upload endpoint (service role) only.
grant select on public.blobs to anon, authenticated;
create policy "see blobs" on public.blobs for select using (
  uploaded_by = auth.uid() or public.is_moderator() or public.blob_is_public(sha256)
);

-- moderation_events: owners read their own history (e.g. rejection notes); no direct writes.
grant select on public.moderation_events to authenticated;
create policy "see own and moderated events" on public.moderation_events for select to authenticated using (
  public.is_moderator()
  or exists (select 1 from public.pack_versions v where v.id = version_id and public.owns_pack(v.pack_id))
);

-- downloads: server only (service role bypasses RLS). No grants to API roles.

-- favourites: private to their owner.
grant select, insert, delete on public.favourites to authenticated;
create policy "own favourites" on public.favourites for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Functions callable from the API.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.moderate(uuid, public.moderation_action, text) to authenticated;
grant execute on function public.is_api_caller(), public.is_moderator(), public.owns_pack(uuid), public.is_public_version(uuid),
  public.can_see_version(uuid), public.blob_is_public(text), public.can_use_blob(text) to anon, authenticated;
grant execute on function public.is_http_url(text), public.valid_links(jsonb), public.valid_tags(text[]),
  public.schedule_images(jsonb), public.interval_minutes(text),
  public.schedule_shape_ok(public.pack_kind, jsonb) to anon, authenticated;
