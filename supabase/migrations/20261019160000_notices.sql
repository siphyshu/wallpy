-- In-site notices for pack owners (docs/decisions.md, 2026-10-17): a dot on the
-- navbar avatar plus a /notices list of review outcomes for their own packs
-- (approved, changes requested, declined, taken down, restored). Built on the
-- moderation log already kept (moderation_events); nothing is duplicated.
--
-- notices_seen_at marks what the owner has already read. Existing rows default
-- to now() so the deploy itself doesn't surface years of old history as unread.

alter table public.profiles add column notices_seen_at timestamptz not null default now();
-- RLS: the existing "edit own profile" policy (id = auth.uid()) already covers
-- updates to this column; it just needs the grant.
grant update (notices_seen_at) on public.profiles to authenticated;

-- A pack owner's own review events, newest first. Deliberately leaves out the
-- moderator's identity (actor_id) -- owners are told what happened, not who
-- did it. Security definer so it can read moderation_events (RLS there is
-- `is_moderator() or owns_pack(...)`, which this satisfies via the owner_id
-- check below) and packs/pack_versions regardless of listing/removal state.
create function public.my_notices()
returns table (
  id bigint,
  pack_id uuid,
  slug text,
  title text,
  action public.moderation_action,
  notes text,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select e.id, p.id, p.slug, v.title, e.action, e.notes, e.created_at
  from public.moderation_events e
  join public.pack_versions v on v.id = e.version_id
  join public.packs p on p.id = v.pack_id
  where p.owner_id = auth.uid()
    and e.action in ('approve', 'reject', 'decline', 'takedown', 'restore')
  order by e.created_at desc, e.id desc
  limit 200
$$;
revoke execute on function public.my_notices() from public, anon;
grant execute on function public.my_notices() to authenticated;

-- Cheap check for the navbar dot: an event the owner hasn't seen yet.
create function public.has_unseen_notices() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.moderation_events e
    join public.pack_versions v on v.id = e.version_id
    join public.packs p on p.id = v.pack_id
    join public.profiles me on me.id = auth.uid()
    where p.owner_id = auth.uid()
      and e.action in ('approve', 'reject', 'decline', 'takedown', 'restore')
      and e.created_at > me.notices_seen_at
  )
$$;
revoke execute on function public.has_unseen_notices() from public, anon;
grant execute on function public.has_unseen_notices() to authenticated;
