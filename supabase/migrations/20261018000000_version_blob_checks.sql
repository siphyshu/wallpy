-- A version's thumbnail and preview follow the same rule as its files: only
-- blobs the owner uploaded, or that are already public (can_use_blob). Before
-- this, any stored hash could be named as a thumbnail without uploading it.

drop policy "create drafts" on public.pack_versions;
create policy "create drafts" on public.pack_versions for insert to authenticated
  with check (
    public.owns_pack(pack_id) and status = 'draft'
    and (thumb_sha256 is null or public.can_use_blob(thumb_sha256))
    and (preview_sha256 is null or public.can_use_blob(preview_sha256))
  );

drop policy "edit own drafts" on public.pack_versions;
create policy "edit own drafts" on public.pack_versions for update to authenticated
  using (public.owns_pack(pack_id))
  with check (
    public.owns_pack(pack_id)
    and (thumb_sha256 is null or public.can_use_blob(thumb_sha256))
    and (preview_sha256 is null or public.can_use_blob(preview_sha256))
  );
