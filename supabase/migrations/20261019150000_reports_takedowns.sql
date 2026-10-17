-- Reports, takedowns and moderation history (docs/decisions.md, 2026-10-17).
-- * Signed-in visitors report a published pack (a reason + optional note) through
--   report_pack(): one open report per person per pack, rate-limited. Reporters
--   see only their own reports; moderators see all and dismiss them.
-- * moderate('takedown') now needs a published, live pack and a reason, and marks
--   the pack's open reports as acted on; 'restore' needs a taken-down pack.
-- * History is moderation_events (already recorded); moderators read it all.

create type public.report_reason as enum
  ('not_wallpaper', 'stolen', 'ai_undisclosed', 'offensive', 'broken', 'other');
create type public.report_status as enum ('open', 'dismissed', 'actioned');

create table public.pack_reports (
  id bigint generated always as identity primary key,
  pack_id uuid not null references public.packs (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  note text check (char_length(note) <= 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);
-- One open report per person per pack.
create unique index pack_reports_one_open on public.pack_reports (pack_id, reporter_id) where status = 'open';
create index pack_reports_open on public.pack_reports (pack_id) where status = 'open';
create index pack_reports_by_reporter on public.pack_reports (reporter_id, created_at);

alter table public.pack_reports enable row level security;
revoke all on public.pack_reports from anon, authenticated;
-- No direct writes: report_pack() and dismiss_reports() only.
grant select on public.pack_reports to authenticated;
create policy "see own reports, or all as moderator" on public.pack_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());

create function public.report_pack(p_pack uuid, p_reason public.report_reason, p_note text default null)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  p public.packs;
  new_id bigint;
begin
  if uid is null then
    raise exception 'sign in to report a pack' using errcode = 'insufficient_privilege';
  end if;
  select * into p from public.packs where id = p_pack;
  if not found or p.current_version_id is null or p.removed_at is not null then
    raise exception 'pack not found' using errcode = 'no_data_found';
  end if;
  if p.owner_id = uid then
    raise exception 'you can''t report your own pack' using errcode = 'check_violation';
  end if;
  if char_length(p_note) > 500 then
    raise exception 'keep the note under 500 characters' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.pack_reports where pack_id = p_pack and reporter_id = uid and status = 'open') then
    raise exception 'you already reported this pack' using errcode = 'unique_violation';
  end if;
  -- Spam brake: 5 reports in 10 minutes, 20 a day.
  if (select count(*) from public.pack_reports where reporter_id = uid and created_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.pack_reports where reporter_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many reports; try again later' using errcode = 'program_limit_exceeded';
  end if;
  insert into public.pack_reports (pack_id, reporter_id, reason, note)
  values (p_pack, uid, p_reason, nullif(trim(p_note), ''))
  returning id into new_id;
  return new_id;
end $$;

-- A moderator closes a pack's open reports without acting on the pack.
create function public.dismiss_reports(p_pack uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = 'insufficient_privilege';
  end if;
  update public.pack_reports set status = 'dismissed', resolved_at = now(), resolved_by = auth.uid()
  where pack_id = p_pack and status = 'open';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.report_pack(uuid, public.report_reason, text), public.dismiss_reports(uuid) from public, anon;
grant execute on function public.report_pack(uuid, public.report_reason, text), public.dismiss_reports(uuid) to authenticated;

-- moderate(): as before (20261018010000), with stricter takedown and restore.
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

  when 'decline' then
    -- A final no for a new pack (spam, rules broken): the version is rejected
    -- and the pack closed, so it can't be resubmitted. Updates to published
    -- packs get 'reject' (or 'takedown' for the whole pack) instead.
    if not public.is_moderator() then
      raise exception 'moderators only' using errcode = 'insufficient_privilege';
    end if;
    if v.status <> 'pending' then
      raise exception 'only pending versions can be declined (this one is %)', v.status;
    end if;
    if p.current_version_id is not null then
      raise exception 'published packs can''t be declined; request changes or take the pack down';
    end if;
    if coalesce(trim(p_notes), '') = '' then
      raise exception 'say why the pack is declined' using errcode = 'check_violation';
    end if;
    update public.pack_versions
      set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
      where id = v.id;
    update public.packs set removed_at = now(), removed_reason = p_notes where id = v.pack_id;

  when 'takedown' then
    -- A published pack comes down: hidden everywhere (site, CLI), its owner sees
    -- the reason. Open reports on it count as acted on.
    if not public.is_moderator() then
      raise exception 'moderators only' using errcode = 'insufficient_privilege';
    end if;
    if p.current_version_id is null then
      raise exception 'only published packs can be taken down; decline it in review instead' using errcode = 'check_violation';
    end if;
    if p.removed_at is not null then
      raise exception 'this pack is already taken down' using errcode = 'check_violation';
    end if;
    if coalesce(trim(p_notes), '') = '' then
      raise exception 'say why the pack is taken down' using errcode = 'check_violation';
    end if;
    update public.packs set removed_at = now(), removed_reason = p_notes where id = v.pack_id;
    update public.pack_reports set status = 'actioned', resolved_at = now(), resolved_by = auth.uid()
      where pack_id = v.pack_id and status = 'open';

  when 'restore' then
    if not public.is_moderator() then
      raise exception 'moderators only' using errcode = 'insufficient_privilege';
    end if;
    if p.removed_at is null or p.current_version_id is null then
      raise exception 'only taken-down published packs can be restored' using errcode = 'check_violation';
    end if;
    update public.packs set removed_at = null, removed_reason = null where id = v.pack_id;
  end case;

  insert into public.moderation_events (version_id, actor_id, action, notes)
  values (v.id, auth.uid(), p_action, p_notes);

  return (select status from public.pack_versions where id = v.id);
end $$;
