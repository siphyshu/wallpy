-- File renditions without foreign keys.
--
-- With three foreign keys from version_files to blobs, PostgREST can no longer
-- tell which one `version_files -> blobs(...)` means and refuses the embed, so
-- every existing query of a file's blob broke. The rendition columns keep the
-- same integrity through triggers instead: a rendition must be a stored blob,
-- and a blob can't be deleted while a file names it as a rendition.

alter table public.version_files
  drop constraint version_files_thumb_sha256_fkey,
  drop constraint version_files_preview_sha256_fkey;

create function public.version_files_renditions_exist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.thumb_sha256 is not null and not exists (select 1 from public.blobs where sha256 = new.thumb_sha256))
     or (new.preview_sha256 is not null and not exists (select 1 from public.blobs where sha256 = new.preview_sha256)) then
    raise exception 'rendition is not a stored blob' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger version_files_renditions_exist before insert or update of thumb_sha256, preview_sha256 on public.version_files
  for each row execute function public.version_files_renditions_exist();

create function public.blobs_keep_renditions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.version_files where thumb_sha256 = old.sha256 or preview_sha256 = old.sha256) then
    raise exception 'blob % is still a rendition of a pack file', old.sha256 using errcode = 'foreign_key_violation';
  end if;
  return old;
end $$;
create trigger blobs_keep_renditions before delete on public.blobs
  for each row execute function public.blobs_keep_renditions();

revoke execute on function public.version_files_renditions_exist(), public.blobs_keep_renditions() from public, anon, authenticated;
