-- Upload pipeline.
--
-- * blob_uploads: who has uploaded each blob. Content-addressed storage means
--   two people uploading the same image share one blob; both may use it.
-- * create_pack() / create_version(): create a pack (or a new version), its
--   files and cover, and optionally submit it, in one transaction. They run as
--   the caller (security invoker), so every RLS rule still applies.
--
-- The server validates the full spec (lib/spec/validate.ts) before calling
-- these; the database enforces structure and ownership.

-- ---------------------------------------------------------------------------
-- Shared blob ownership
-- ---------------------------------------------------------------------------

create table public.blob_uploads (
  sha256 text not null references public.blobs (sha256) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sha256, profile_id)
);
alter table public.blob_uploads enable row level security;
revoke all on public.blob_uploads from anon, authenticated;
grant select on public.blob_uploads to authenticated;
create policy "see own uploads" on public.blob_uploads for select to authenticated
  using (profile_id = auth.uid());
-- Rows are written by the upload endpoint (service role) after it confirms the
-- object is in R2.

insert into public.blob_uploads (sha256, profile_id)
select sha256, uploaded_by from public.blobs where uploaded_by is not null
on conflict do nothing;

-- Policies run with the caller's privileges, and API roles can't read other
-- people's blob_uploads rows, so the check lives in a security definer helper.
create function public.uploaded_by_me(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blob_uploads u where u.sha256 = s and u.profile_id = auth.uid())
$$;

create or replace function public.can_use_blob(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.uploaded_by_me(s) or public.blob_is_public(s)
$$;

drop policy "see blobs" on public.blobs;
create policy "see blobs" on public.blobs for select using (
  public.uploaded_by_me(sha256) or public.is_moderator() or public.blob_is_public(sha256)
);

-- INSERT ... RETURNING also checks the read policy against the new row. The
-- old policy, can_see_version(id), looked the row up by id, which a row being
-- inserted isn't visible to yet; so check the row's own columns instead.
drop policy "see versions" on public.pack_versions;
create policy "see versions" on public.pack_versions for select using (
  public.is_public_version(id) or public.owns_pack(pack_id) or public.is_moderator()
);

-- ---------------------------------------------------------------------------
-- Creating packs and versions
-- ---------------------------------------------------------------------------

-- Shared by create_pack and create_version: the draft version, its files and
-- cover, and (if asked) the submission.
create function public.write_version(p_pack_id uuid, p jsonb) returns jsonb
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

  insert into public.pack_versions (pack_id, title, description, tags, schedule, ai_use, license, license_notes,
                                    uploader_is_artist, artist_id, thumb_sha256, preview_sha256)
  values (
    p_pack_id,
    p ->> 'title',
    nullif(p ->> 'description', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
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
    insert into public.version_files (version_id, path, sha256, sort_order)
    values (v_version, f ->> 'path', f ->> 'sha256', i);
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

-- A new pack: its first version, files and cover. Finds a free slug
-- (slug, slug-2, slug-3, ...), including against packs the caller can't see.
create function public.create_pack(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_base text := p ->> 'slug';
  v_slug text;
  v_pack uuid;
  n int := 1;
begin
  if auth.uid() is null then
    raise exception 'sign in to upload' using errcode = 'insufficient_privilege';
  end if;
  loop
    v_slug := case when n = 1 then v_base else left(v_base, 56) || '-' || n end;
    begin
      insert into public.packs (slug, owner_id) values (v_slug, auth.uid()) returning id into v_pack;
      exit;
    exception when unique_violation then
      n := n + 1;
      if n > 50 then raise; end if;
    end;
  end loop;
  return jsonb_build_object('slug', v_slug) || public.write_version(v_pack, p);
end $$;

-- A new version of one of the caller's packs (it replaces the current one
-- once approved).
create function public.create_version(p_slug text, p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_pack uuid;
begin
  select id into v_pack from public.packs where slug = p_slug and owner_id = auth.uid();
  if v_pack is null then
    raise exception 'pack not found' using errcode = 'no_data_found';
  end if;
  return jsonb_build_object('slug', p_slug) || public.write_version(v_pack, p);
end $$;

revoke execute on function public.uploaded_by_me(text) from public;
grant execute on function public.uploaded_by_me(text) to anon, authenticated;
revoke execute on function public.write_version(uuid, jsonb), public.create_pack(jsonb),
  public.create_version(text, jsonb) from public, anon;
grant execute on function public.create_pack(jsonb), public.create_version(text, jsonb) to authenticated;
-- write_version is only called from the two functions above.
grant execute on function public.write_version(uuid, jsonb) to authenticated;
