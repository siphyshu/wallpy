-- Baseline: the live schema as it existed when the project was revived (2026-10).
-- Reconstructed from the production catalog because `supabase db dump` fails on
-- this restored project. Already applied in production; recorded in migration
-- history without being re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key default gen_random_uuid()
    references auth.users (id) on update cascade on delete cascade,
  username text not null unique,
  email text not null,
  name text,
  avatar_url text,
  bio text,
  website text,
  role text default 'user',
  is_verified boolean default false,
  created_at timestamptz default now(),
  cover_url text,
  links jsonb default '{}'::jsonb,
  email_contact text
);

create table public.packs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  is_original boolean not null default false,
  author_name text,
  author_url text,
  uploaded_by uuid references public.users (id) on delete set null,
  is_published boolean not null default false,
  status text default 'pending',
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  preview_image_url text,
  blurhash text,
  zip_file_url text not null,
  tags text[],
  download_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  previews text[],
  pack_type text not null default 'daypack'
);

create table public.pack_images (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.packs (id) on delete cascade,
  image_url text not null,
  blurhash text,
  sort_order integer default 0
);

create table public.favourites (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.packs (id) on delete cascade,
  user_id uuid references public.users (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Profile row on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name, username)
  values (new.id, new.email, new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security (as found; tightened in the next migration)
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.packs enable row level security;
alter table public.pack_images enable row level security;
alter table public.favourites enable row level security;

create policy "User profiles are viewable by everyone" on public.users
  for select using (true);
create policy "Users can insert into their own profile" on public.users
  for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.users
  for update using (auth.uid() = id);

create policy "Published packs are viewable by everyone" on public.packs
  for select using (is_published = true);
create policy "Users can view their own packs" on public.packs
  for select to authenticated using (uploaded_by = auth.uid());
create policy "Users can create their own packs" on public.packs
  for insert to authenticated with check (uploaded_by = auth.uid());
create policy "Users can update their own packs" on public.packs
  for update to authenticated using (uploaded_by = auth.uid()) with check (uploaded_by = auth.uid());
create policy "Users can delete their own packs" on public.packs
  for delete to authenticated using (uploaded_by = auth.uid());

create policy "Images of published packs are viewable" on public.pack_images
  for select using (exists (select 1 from public.packs where packs.id = pack_images.pack_id and packs.is_published = true));
create policy "Users can view their own pack images" on public.pack_images
  for select to authenticated using (exists (select 1 from public.packs where packs.id = pack_images.pack_id and packs.uploaded_by = auth.uid()));
create policy "Users can add images to their packs" on public.pack_images
  for insert to authenticated with check (exists (select 1 from public.packs where packs.id = pack_images.pack_id and packs.uploaded_by = auth.uid()));
create policy "Users can update their pack images" on public.pack_images
  for update to authenticated using (exists (select 1 from public.packs where packs.id = pack_images.pack_id and packs.uploaded_by = auth.uid()));
create policy "Users can delete their pack images" on public.pack_images
  for delete to authenticated using (exists (select 1 from public.packs where packs.id = pack_images.pack_id and packs.uploaded_by = auth.uid()));

create policy "Users can view their own favorites" on public.favourites
  for select to authenticated using (user_id = auth.uid());
create policy "Users can add favorites" on public.favourites
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users can remove favorites" on public.favourites
  for delete to authenticated using (user_id = auth.uid());
