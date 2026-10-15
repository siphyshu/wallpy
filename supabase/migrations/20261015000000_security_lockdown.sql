-- Security lockdown.
--
-- Supabase grants anon/authenticated full privileges on public tables, so RLS
-- row checks were the only guard. Row checks can't stop a user from changing
-- *columns* on their own row (users.role, packs.status) or reading sensitive
-- columns (users.email). Column-level grants close that gap; RLS still decides
-- which rows.

-- ---------------------------------------------------------------------------
-- users: hide email, allow only profile fields to be edited
-- ---------------------------------------------------------------------------

revoke all on public.users from anon, authenticated;

grant select (
  id, username, name, avatar_url, bio, website, role, is_verified,
  created_at, cover_url, links, email_contact
) on public.users to anon, authenticated;

grant update (
  name, bio, website, avatar_url, cover_url, links, email_contact
) on public.users to authenticated;

-- Profile rows are created only by the handle_new_user trigger.
drop policy "Users can insert into their own profile" on public.users;

drop policy "Users can update their own profile" on public.users;
create policy "Users can update their own profile" on public.users
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

alter table public.users
  add constraint users_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  add constraint users_role_valid check (role in ('user', 'moderator', 'admin'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name, username)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    lower(trim(new.raw_user_meta_data ->> 'username'))
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- packs: uploaders can't approve themselves
-- ---------------------------------------------------------------------------

revoke all on public.packs from anon, authenticated;

grant select on public.packs to anon, authenticated;

grant insert (
  title, slug, description, is_original, author_name, author_url, uploaded_by,
  is_published, preview_image_url, blurhash, zip_file_url, tags, previews, pack_type
) on public.packs to authenticated;

grant update (
  title, description, is_original, author_name, author_url, is_published,
  preview_image_url, blurhash, zip_file_url, tags, previews, pack_type
) on public.packs to authenticated;

grant delete on public.packs to authenticated;

alter table public.packs
  add constraint packs_status_valid check (status in ('pending', 'approved', 'rejected')),
  add constraint packs_type_valid check (pack_type in ('daypack', 'weekpack', 'album')),
  add constraint packs_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

drop policy "Published packs are viewable by everyone" on public.packs;
create policy "Approved published packs are viewable by everyone" on public.packs
  for select using (is_published and status = 'approved');

-- Changing what a pack contains sends it back to review, so an approved pack
-- can't be swapped for different files. Requests without a user (service role,
-- migrations) are trusted.
create or replace function public.packs_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null
     and (new.zip_file_url, new.previews, new.preview_image_url)
         is distinct from (old.zip_file_url, old.previews, old.preview_image_url) then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

create trigger packs_before_update
  before update on public.packs
  for each row execute function public.packs_before_update();

-- Download counts can only be bumped through this function, one at a time,
-- and only for packs that are publicly visible.
create or replace function public.record_download(pack_slug text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.packs
  set download_count = coalesce(download_count, 0) + 1
  where slug = pack_slug and is_published and status = 'approved';
$$;

revoke execute on function public.record_download(text) from public;
grant execute on function public.record_download(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- pack_images: follow the pack's visibility
-- ---------------------------------------------------------------------------

revoke all on public.pack_images from anon, authenticated;
grant select on public.pack_images to anon, authenticated;
grant insert, update, delete on public.pack_images to authenticated;

drop policy "Images of published packs are viewable" on public.pack_images;
create policy "Images of approved published packs are viewable" on public.pack_images
  for select using (exists (
    select 1 from public.packs
    where packs.id = pack_images.pack_id and packs.is_published and packs.status = 'approved'
  ));

-- ---------------------------------------------------------------------------
-- favourites
-- ---------------------------------------------------------------------------

revoke all on public.favourites from anon, authenticated;
grant select, insert, delete on public.favourites to authenticated;

alter table public.favourites
  add constraint favourites_user_pack_unique unique (user_id, pack_id);
