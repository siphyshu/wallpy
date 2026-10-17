-- Small copies of every pack image, not just the cover.
--
-- Each version file may name a thumbnail (640px WebP) and a preview (1920px
-- WebP) of its image, stored as content-addressed blobs like everything else.
-- The pack page and the moderation queue show these instead of running every
-- multi-megabyte original through the image optimizer. Originals are still
-- what the CLI downloads (the manifest is unchanged).
--
-- Renditions follow the same rule as the files themselves (can_use_blob): a
-- user can only name blobs they uploaded or that are already public.

alter table public.version_files
  add column thumb_sha256 text references public.blobs (sha256),
  add column preview_sha256 text references public.blobs (sha256);
create index on public.version_files (thumb_sha256);
create index on public.version_files (preview_sha256);

-- A published file's renditions are public, like the version's own thumbnail.
create or replace function public.blob_is_public(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.version_files f
                 where (f.sha256 = s or f.thumb_sha256 = s or f.preview_sha256 = s)
                   and public.is_public_version(f.version_id))
      or exists (select 1 from public.pack_versions v
                 where (v.thumb_sha256 = s or v.preview_sha256 = s) and public.is_public_version(v.id))
$$;

grant insert (version_id, path, sha256, sort_order, thumb_sha256, preview_sha256) on public.version_files to authenticated;

drop policy "write own draft files" on public.version_files;
create policy "write own draft files" on public.version_files for all to authenticated
  using (exists (select 1 from public.pack_versions v where v.id = version_id and public.owns_pack(v.pack_id)))
  with check (exists (select 1 from public.pack_versions v where v.id = version_id and public.owns_pack(v.pack_id))
              and public.can_use_blob(sha256)
              and (thumb_sha256 is null or public.can_use_blob(thumb_sha256))
              and (preview_sha256 is null or public.can_use_blob(preview_sha256)));

-- write_version: as before, plus each file's renditions.
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
