-- A version withdrawn from review is a draft, and a pack has at most one open
-- version (pack_versions_one_open). Sending a new version replaces the draft,
-- in one transaction: if the new version fails, the draft is kept.
-- Security invoker: RLS ("delete own drafts") and create_version()'s checks apply.
create function public.create_version_replacing_draft(p_slug text, p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.pack_versions v using public.packs k
  where v.pack_id = k.id and k.slug = p_slug and k.owner_id = auth.uid() and v.status = 'draft';
  return public.create_version(p_slug, p);
end $$;

revoke execute on function public.create_version_replacing_draft(text, jsonb) from public, anon;
grant execute on function public.create_version_replacing_draft(text, jsonb) to authenticated;
