-- Pack format spec 2 (spec/README.md) and AI-use disclosure.
--
-- * pack_versions.schedule now holds spec 2: {"spec": 2, "name", "slot": [...]}.
--   The database checks structure; ordering, duplicate starts and day coverage
--   are checked by the server validator (a port of spec/reference) on submit.
-- * kind (Daypack / Weekpack / Album) is derived from the schedule, so it can
--   never disagree with it.
-- * ai_use: how AI was used to make the images. Required to submit; null only
--   for older versions nobody has answered for yet.

-- ---------------------------------------------------------------------------
-- Spec 2 structure
-- ---------------------------------------------------------------------------

create function public.spec_time_ok(t text) returns boolean
language sql immutable as $$
  select t ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|(midnight|dawn|sunrise|noon|sunset|dusk)([+-]([1-9][0-9]?h([1-5]?[0-9]m)?|[1-9][0-9]{0,3}m))?)$'
$$;

create function public.spec_rotate_ok(r text) returns boolean
language sql immutable as $$
  select r = 'spread'
      or (r ~ '^every [1-9][0-9]{0,4}[mhd]$'
          and public.interval_minutes(substr(r, 7)) between 5 and 10080)
$$;

create function public.schedule_ok(s jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(s) = 'object'
     and s -> 'spec' = '2'::jsonb
     and char_length(coalesce(s ->> 'name', '')) between 1 and 80
     and jsonb_typeof(s -> 'slot') = 'array'
     and jsonb_array_length(s -> 'slot') between 1 and 48
     and not exists (
       select 1 from jsonb_array_elements(s -> 'slot') slot
       where jsonb_typeof(slot) <> 'object'
          or jsonb_typeof(slot -> 'images') is distinct from 'array'
          or jsonb_array_length(slot -> 'images') not between 1 and 100
          or exists (
            select 1 from jsonb_array_elements(slot -> 'images') img
            where jsonb_typeof(img) <> 'string'
               or img #>> '{}' !~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{0,99}\.(jpg|jpeg|png|webp)$'
          )
          or (slot ? 'at' and not coalesce(public.spec_time_ok(slot ->> 'at'), false))
          or (slot ? 'rotate' and not coalesce(public.spec_rotate_ok(slot ->> 'rotate'), false))
          or (slot ? 'days' and (
                jsonb_typeof(slot -> 'days') <> 'array'
                or jsonb_array_length(slot -> 'days') not between 1 and 7
                or exists (select 1 from jsonb_array_elements(slot -> 'days') d
                           where d #>> '{}' not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'))))
     )
$$;

-- Daypack / Weekpack / Album: presets of one format (spec/README.md).
create function public.schedule_kind(s jsonb) returns public.pack_kind
language sql immutable as $$
  select case
    when exists (select 1 from jsonb_array_elements(s -> 'slot') slot where slot ? 'days') then 'days'
    when not exists (select 1 from jsonb_array_elements(s -> 'slot') slot where slot ? 'at') then 'album'
    else 'timeblocks'
  end::public.pack_kind
$$;

create or replace function public.schedule_images(s jsonb) returns setof text
language sql immutable as $$
  select distinct jsonb_path_query(s, '$.slot[*].images[*]') #>> '{}'
$$;

-- ---------------------------------------------------------------------------
-- Convert the stored schedules (equivalence verified by spec/tests/test_v1_equivalence.py)
-- ---------------------------------------------------------------------------

alter table public.pack_versions drop constraint pack_versions_check;
alter table public.pack_versions drop column kind;
drop function public.schedule_shape_ok(public.pack_kind, jsonb);

update public.pack_versions set schedule = '{"spec":2,"name":"Greasy Diner","slot":[{"label":"dawn","at":"dawn","images":["dawn.jpg"]},{"label":"day","at":"sunrise+60m","images":["morning.jpg"]},{"label":"dusk","at":"sunset-30m","images":["dusk.jpg"]},{"label":"night","at":"dusk+60m","images":["night1.jpg","night2.jpg"]}]}'::jsonb
  where pack_id = (select id from public.packs where slug = 'greasy-diner');
update public.pack_versions set schedule = '{"spec":2,"name":"Ocean Hours","author":"siphyshu","slot":[{"label":"dawn","at":"dawn","images":["golden_hour.png"]},{"label":"morning","at":"sunrise+90m","images":["morning.png"]},{"label":"afternoon","at":"noon-30m","images":["noon.png","morning.png"]},{"label":"evening","at":"sunset-30m","images":["sunset.png"]},{"label":"night","at":"sunset+60m","images":["night.png"]}]}'::jsonb
  where pack_id = (select id from public.packs where slug = 'ocean-hours');
update public.pack_versions set schedule = '{"spec":2,"name":"Tokyo Street","author":"ArseniXC","slot":[{"label":"dawn","at":"dawn","images":["dawn.jpg"]},{"label":"day","at":"sunrise+60m","images":["day.jpg"]},{"label":"dusk","at":"sunset-30m","images":["dusk.jpg"]},{"label":"night","at":"dusk+120m","images":["night.jpg"]}]}'::jsonb
  where pack_id = (select id from public.packs where slug = 'tokyo-street');
update public.pack_versions set schedule = '{"spec":2,"name":"Zelda Wind Waker","author":"Matt Vince","description":"A really cool wallpack from Zelda Wind Walker","slot":[{"label":"dawn","at":"dawn","images":["dawn1.jpg","dawn2.jpg","dawn3.jpg"]},{"label":"morning","at":"sunrise","images":["morning1.jpg","morning2.jpg","morning3.jpg","morning4.jpg"]},{"label":"dusk","at":"sunset","images":["dusk1.jpg","dusk2.jpg","dusk3.jpg"]},{"label":"night","at":"dusk","images":["night1.jpg","night2.jpg","night3.jpg","night4.jpg","night5.jpg","night6.jpg"]}]}'::jsonb
  where pack_id = (select id from public.packs where slug = 'zelda-wind-waker');

alter table public.pack_versions
  add constraint pack_versions_schedule_check check (public.schedule_ok(schedule)),
  add column kind public.pack_kind generated always as (public.schedule_kind(schedule)) stored;

-- ---------------------------------------------------------------------------
-- AI use
-- ---------------------------------------------------------------------------

create type public.ai_use as enum ('none', 'assisted', 'generated');
alter table public.pack_versions add column ai_use public.ai_use;

update public.pack_versions set ai_use = 'none'
  where pack_id in (select id from public.packs where slug in ('zelda-wind-waker', 'tokyo-street'));
update public.pack_versions set ai_use = 'generated'
  where pack_id = (select id from public.packs where slug = 'ocean-hours');

grant insert (ai_use) on public.pack_versions to authenticated;
grant update (ai_use) on public.pack_versions to authenticated;

-- ---------------------------------------------------------------------------
-- moderate(): submitting now also requires an AI-use answer
-- ---------------------------------------------------------------------------

create or replace function public.moderate(p_version uuid, p_action public.moderation_action, p_notes text default null)
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
    if v.ai_use is null then
      raise exception 'say whether AI was used to make these images' using errcode = 'check_violation';
    end if;
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
    if v.ai_use is null then
      raise exception 'record whether AI was used before approving' using errcode = 'check_violation';
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

revoke execute on function public.spec_time_ok(text), public.spec_rotate_ok(text), public.schedule_ok(jsonb),
  public.schedule_kind(jsonb) from public;
grant execute on function public.spec_time_ok(text), public.spec_rotate_ok(text), public.schedule_ok(jsonb),
  public.schedule_kind(jsonb), public.schedule_images(jsonb) to anon, authenticated;
