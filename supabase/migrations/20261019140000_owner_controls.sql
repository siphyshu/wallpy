-- Owner controls (docs/decisions.md, 2026-10-17):
-- * Unlisted packs leave the gallery, search and their owner's public profile,
--   but their link and CLI installs keep working. Listing is now a site
--   concern (queries filter is_listed); RLS only hides unpublished and
--   taken-down packs.
-- * Owners can withdraw a version in review: it goes back to draft.
-- * Account deletion: delete_my_account() removes the caller's profile,
--   favourites and unpublished packs; published packs are deleted or kept,
--   ownerless (owner_id null), credited to "deleted user".
-- * profiles.website moves into links and is dropped.

-- ---- unlisted = hidden from listings, not from links ---------------------------

create or replace function public.is_public_version(v uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.packs p
    where p.current_version_id = v and p.removed_at is null
  )
$$;

drop policy "see packs" on public.packs;
create policy "see packs" on public.packs for select using (
  (current_version_id is not null and removed_at is null)
  or owner_id = auth.uid() or public.is_moderator()
);

-- ---- withdraw a version in review ------------------------------------------------

alter type public.moderation_action add value if not exists 'withdraw';

-- The owner takes a pending version back: it becomes a draft again (editable,
-- deletable, resubmittable). A new pack goes back to being an unpublished draft.
create function public.withdraw_version(p_version uuid) returns public.version_status
language plpgsql security definer set search_path = '' as $$
declare
  v public.pack_versions;
begin
  select * into v from public.pack_versions where id = p_version for update;
  if not found or not exists (select 1 from public.packs where id = v.pack_id and owner_id = auth.uid()) then
    raise exception 'version not found' using errcode = 'no_data_found';
  end if;
  if v.status <> 'pending' then
    raise exception 'only versions in review can be withdrawn (this one is %)', v.status using errcode = 'check_violation';
  end if;
  update public.pack_versions set status = 'draft', submitted_at = null where id = v.id;
  insert into public.moderation_events (version_id, actor_id, action) values (v.id, auth.uid(), 'withdraw');
  return 'draft';
end $$;

-- ---- account deletion ----------------------------------------------------------------

-- Kept packs outlive their owner.
alter table public.packs alter column owner_id drop not null;

-- Deletes the caller's account: auth user, profile and favourites (by cascade),
-- every unpublished pack, and published ones unless p_keep_published. Kept packs
-- lose their unreviewed versions and their owner. Images stay in storage.
create function public.delete_my_account(p_keep_published boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_keep_published then
    delete from public.pack_versions v using public.packs p
    where v.pack_id = p.id and p.owner_id = uid
      and p.current_version_id is not null and p.removed_at is null
      and v.status in ('draft', 'pending', 'rejected');
    update public.packs set owner_id = null
    where owner_id = uid and current_version_id is not null and removed_at is null;
  end if;
  delete from public.packs where owner_id = uid;
  delete from auth.users where id = uid;
end $$;

revoke execute on function public.withdraw_version(uuid), public.delete_my_account(boolean) from public, anon;
grant execute on function public.withdraw_version(uuid), public.delete_my_account(boolean) to authenticated;

-- ---- website -> links ------------------------------------------------------------------

update public.profiles
set links = jsonb_build_array(jsonb_build_object('name', 'Website', 'url', website)) || links
where website is not null
  and jsonb_array_length(links) < 10
  and not exists (select 1 from jsonb_array_elements(links) e
                  where rtrim(lower(e ->> 'url'), '/') = rtrim(lower(website), '/'));

alter table public.profiles drop column website;
