-- Declining: a final no for a new pack, next to 'reject' (request changes).
-- The pack is closed (removed_at), and closed packs take no new versions.

alter type public.moderation_action add value if not exists 'decline';

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

create or replace function public.create_version(p_slug text, p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_pack uuid;
  v_removed timestamptz;
begin
  select id, removed_at into v_pack, v_removed from public.packs where slug = p_slug and owner_id = auth.uid();
  if v_pack is null then
    raise exception 'pack not found' using errcode = 'no_data_found';
  end if;
  if v_removed is not null then
    raise exception 'this pack was closed by a moderator' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object('slug', p_slug) || public.write_version(v_pack, p);
end $$;
