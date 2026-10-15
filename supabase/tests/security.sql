-- Attack tests for data model v2 (RLS + column grants + moderate()).
-- Runs in a transaction and rolls back. Each check raises on failure, so a clean
-- run means every check passed.
--
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql   (fresh db only)
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/migrations/<each>.sql
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/tests/security.sql

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  if uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end $$;

-- The server: service role bypasses RLS and has no user.
create function pg_temp.as_server() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role service_role;
end $$;

create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Raises unless `stmt` fails with one of the given SQLSTATEs.
create function pg_temp.expect_error(label text, stmt text, codes text[] default '{42501}') returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL %: statement was allowed', label;
exception when others then
  if sqlstate = any(codes) then
    raise notice 'ok   %', label;
  else
    raise exception 'FAIL %: expected % but got % (%)', label, codes, sqlstate, sqlerrm;
  end if;
end $$;

create function pg_temp.expect(label text, ok boolean) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL %', label; end if;
  raise notice 'ok   %', label;
end $$;

grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- ---- fixtures ----------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.test', '{"username":"Alice_T","name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.test',   '{"username":"bob_t"}'),
  ('00000000-0000-0000-0000-00000000000c', 'mod@example.test',   '{"username":"mod_t"}');
update public.profiles set role = 'moderator' where username = 'mod_t';

-- Blobs are created by the upload endpoint (server).
select pg_temp.as_server();
insert into public.blobs (sha256, size, mime, uploaded_by) values
  (repeat('a', 64), 1000, 'image/jpeg', '00000000-0000-0000-0000-00000000000a'),
  (repeat('b', 64), 1000, 'image/jpeg', '00000000-0000-0000-0000-00000000000a'),
  (repeat('c', 64), 1000, 'image/jpeg', '00000000-0000-0000-0000-00000000000b');
select pg_temp.as_admin();

select pg_temp.expect('signup creates a lowercased profile',
  (select username from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'alice_t');

-- ---- profiles ----------------------------------------------------------------
select pg_temp.as_user(null);
select pg_temp.expect('anon can read profiles', (select count(*) from public.profiles where username like '%\_t') = 3);
select pg_temp.expect('profiles hold no email column',
  not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name ilike '%email' and column_name <> 'contact_email'));

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error('user cannot promote self to admin',
  $q$update public.profiles set role = 'admin' where id = auth.uid()$q$);
select pg_temp.expect_error('user cannot change their username',
  $q$update public.profiles set username = 'admin' where id = auth.uid()$q$);
select pg_temp.expect_error('avatar must be inside own folder',
  $q$update public.profiles set avatar_key = 'profiles/00000000-0000-0000-0000-00000000000b/' || repeat('c', 64) || '.jpg' where id = auth.uid()$q$,
  '{23514}');
select pg_temp.expect_error('javascript: links rejected',
  $q$update public.profiles set links = '[{"name":"x","url":"javascript:alert(1)"}]' where id = auth.uid()$q$, '{23514}');
update public.profiles set bio = 'hi', avatar_key = 'profiles/00000000-0000-0000-0000-00000000000a/' || repeat('a', 64) || '.jpg' where id = auth.uid();
update public.profiles set bio = 'pwned' where username = 'bob_t';
select pg_temp.as_admin();
select pg_temp.expect('user edits own profile', (select bio from public.profiles where username = 'alice_t') = 'hi');
select pg_temp.expect('user cannot edit another profile', (select bio from public.profiles where username = 'bob_t') is null);

-- ---- packs + drafts ----------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.packs (slug, owner_id) values ('sunset', auth.uid());
select pg_temp.expect_error('cannot create a pack for someone else',
  $q$insert into public.packs (slug, owner_id) values ('framed', '00000000-0000-0000-0000-00000000000b')$q$);
select pg_temp.expect_error('cannot set download_count',
  $q$update public.packs set download_count = 9999 where slug = 'sunset'$q$);
select pg_temp.expect_error('cannot set current_version_id directly',
  $q$update public.packs set current_version_id = gen_random_uuid() where slug = 'sunset'$q$);
select pg_temp.expect_error('cannot insert a version as approved',
  $q$insert into public.pack_versions (pack_id, title, kind, schedule, status)
     select id, 'x', 'album', '{"meta":{"type":"album","name":"x"},"album":{"images":["a.jpg"],"interval":"30m"}}', 'approved'
     from public.packs where slug = 'sunset'$q$);
select pg_temp.expect_error('schedule kind must match its type',
  $q$insert into public.pack_versions (pack_id, title, kind, schedule)
     select id, 'x', 'days', '{"meta":{"type":"album","name":"x"},"album":{"images":["a.jpg"],"interval":"30m"}}'
     from public.packs where slug = 'sunset'$q$, '{23514}');
select pg_temp.expect_error('album interval below 5m rejected',
  $q$insert into public.pack_versions (pack_id, title, kind, schedule)
     select id, 'x', 'album', '{"meta":{"type":"album","name":"x"},"album":{"images":["a.jpg"],"interval":"1m"}}'
     from public.packs where slug = 'sunset'$q$, '{23514}');
select pg_temp.expect_error('schedule cannot reference paths outside the pack',
  $q$insert into public.pack_versions (pack_id, title, kind, schedule)
     select id, 'x', 'album', '{"meta":{"type":"album","name":"x"},"album":{"images":["../../etc.jpg"],"interval":"30m"}}'
     from public.packs where slug = 'sunset'$q$, '{23514}');

insert into public.pack_versions (pack_id, title, kind, schedule)
  select id, 'Sunset', 'album', '{"meta":{"type":"album","name":"Sunset"},"album":{"images":["a.jpg","b.jpg"],"interval":"30m"}}'
  from public.packs where slug = 'sunset';
select pg_temp.expect('version numbers are assigned',
  (select number from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset') = 1);
select pg_temp.expect_error('only one open draft per pack',
  $q$insert into public.pack_versions (pack_id, title, kind, schedule)
     select id, 'again', 'album', '{"meta":{"type":"album","name":"x"},"album":{"images":["a.jpg"],"interval":"30m"}}'
     from public.packs where slug = 'sunset'$q$, '{23505}');
select pg_temp.expect_error('cannot attach a blob someone else uploaded',
  $q$insert into public.version_files (version_id, path, sha256)
     select v.id, 'c.jpg', repeat('c', 64) from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset'$q$);
insert into public.version_files (version_id, path, sha256)
  select v.id, 'a.jpg', repeat('a', 64) from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset';
select pg_temp.expect_error('duplicate filename differing only in case',
  $q$insert into public.version_files (version_id, path, sha256)
     select v.id, 'A.jpg', repeat('a', 64) from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset'$q$, '{23505}');
select pg_temp.expect_error('submit fails while the schedule references a missing image',
  $q$select public.moderate((select v.id from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset'), 'submit')$q$,
  '{23514}');
insert into public.version_files (version_id, path, sha256)
  select v.id, 'b.jpg', repeat('b', 64) from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset';

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect('other users cannot see drafts',
  not exists (select 1 from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset'));
select pg_temp.expect_error('other users cannot submit my draft',
  $q$select public.moderate((select v.id from public.pack_versions v where v.title = 'Sunset'), 'submit')$q$,
  '{42501,P0002}');
select pg_temp.expect('cannot read blobs of unpublished packs', not exists (select 1 from public.blobs where sha256 = repeat('a', 64)));

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('owner submits',
  public.moderate((select v.id from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset'), 'submit') = 'pending');
select pg_temp.expect_error('submitted version is frozen',
  $q$update public.pack_versions set title = 'Bait and switch' where title = 'Sunset'$q$);
select pg_temp.expect_error('files of a submitted version are frozen',
  $q$delete from public.version_files where path = 'b.jpg'$q$);
select pg_temp.expect_error('cannot change status directly',
  $q$update public.pack_versions set status = 'approved' where title = 'Sunset'$q$);
select pg_temp.expect_error('owner cannot approve own pack',
  $q$select public.moderate((select id from public.pack_versions where title = 'Sunset'), 'approve')$q$);
select pg_temp.expect_error('cannot forge moderation events',
  $q$insert into public.moderation_events (version_id, action) select id, 'approve' from public.pack_versions where title = 'Sunset'$q$);

select pg_temp.as_user(null);
select pg_temp.expect('anon cannot see pending pack', not exists (select 1 from public.packs where slug = 'sunset'));

-- ---- approval -----------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect('moderator sees pending versions', exists (select 1 from public.pack_versions where title = 'Sunset'));
select pg_temp.expect('moderator approves',
  public.moderate((select id from public.pack_versions where title = 'Sunset'), 'approve', 'looks good') = 'approved');

select pg_temp.as_user(null);
select pg_temp.expect('anon sees approved pack', exists (select 1 from public.packs where slug = 'sunset' and current_version_id is not null));
select pg_temp.expect('anon sees its files', (select count(*) from public.version_files where path in ('a.jpg', 'b.jpg')) = 2);
select pg_temp.expect('anon sees its blob metadata', (select count(*) from public.blobs where sha256 in (repeat('a', 64), repeat('b', 64))) = 2);
select pg_temp.expect('anon still cannot see unrelated blobs', not exists (select 1 from public.blobs where sha256 = repeat('c', 64)));
select pg_temp.expect_error('anon cannot read moderation notes', $q$select * from public.moderation_events$q$);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('owner can read review notes',
  (select notes from public.moderation_events where action = 'approve') = 'looks good');

-- v2 replaces v1 only once approved
insert into public.pack_versions (pack_id, title, kind, schedule)
  select id, 'Sunset II', 'album', '{"meta":{"type":"album","name":"Sunset II"},"album":{"images":["a.jpg"],"interval":"1h"}}'
  from public.packs where slug = 'sunset';
insert into public.version_files (version_id, path, sha256) select id, 'a.jpg', repeat('a', 64) from public.pack_versions where title = 'Sunset II';
select public.moderate((select id from public.pack_versions where title = 'Sunset II'), 'submit');
select pg_temp.as_user(null);
select pg_temp.expect('v1 stays live while v2 is pending',
  (select v.title from public.packs p join public.pack_versions v on v.id = p.current_version_id where p.slug = 'sunset') = 'Sunset');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.moderate((select id from public.pack_versions where title = 'Sunset II'), 'approve');
select pg_temp.as_admin();
select pg_temp.expect('approving v2 supersedes v1',
  (select string_agg(title || '=' || status, ',' order by number) from public.pack_versions) = 'Sunset=superseded,Sunset II=approved');

-- ---- takedown -------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error('owners cannot take packs down',
  $q$select public.moderate((select id from public.pack_versions where title = 'Sunset II'), 'takedown')$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.moderate((select id from public.pack_versions where title = 'Sunset II'), 'takedown', 'dmca');
select pg_temp.as_user(null);
select pg_temp.expect('takedown hides the pack', not exists (select 1 from public.packs where slug = 'sunset'));
select pg_temp.expect('and its files', not exists (select 1 from public.version_files where path = 'a.jpg'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error('owner cannot undo a takedown', $q$update public.packs set removed_at = null where slug = 'sunset'$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.moderate((select id from public.pack_versions where title = 'Sunset II'), 'restore');

-- ---- downloads -------------------------------------------------------------------
select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot record downloads',
  $q$insert into public.downloads (pack_id, client, ip_hash) select id, 'cli', repeat('0', 64) from public.packs where slug = 'sunset'$q$);
select pg_temp.as_server();
insert into public.downloads (pack_id, client, ip_hash) select id, 'cli', repeat('1', 64) from public.packs where slug = 'sunset';
insert into public.downloads (pack_id, client, ip_hash) select id, 'cli', repeat('1', 64) from public.packs where slug = 'sunset'
  on conflict do nothing;
insert into public.downloads (pack_id, client, ip_hash) select id, 'web', repeat('2', 64) from public.packs where slug = 'sunset';
select pg_temp.as_user(null);
select pg_temp.expect('downloads are deduped per IP per day',
  (select download_count from public.packs where slug = 'sunset') = 2);

-- ---- favourites ------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.favourites (profile_id, pack_id) select auth.uid(), id from public.packs where slug = 'sunset';
select pg_temp.expect_error('cannot favourite as someone else',
  $q$insert into public.favourites (profile_id, pack_id) select '00000000-0000-0000-0000-00000000000a', id from public.packs where slug = 'sunset'$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('favourites are private', not exists (select 1 from public.favourites));
select pg_temp.as_user(null);
select pg_temp.expect('favourite count is public', (select favourite_count from public.packs where slug = 'sunset') = 1);

-- ---- artists ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.artists (name, url) values ('ArseniXC', 'https://example.test/arsenixc');
select pg_temp.expect('artist records who added it',
  (select created_by from public.artists where name = 'ArseniXC') = '00000000-0000-0000-0000-00000000000b');
update public.artists set name = 'Vandalised' where name = 'ArseniXC';
select pg_temp.as_admin();
select pg_temp.expect('only moderators edit artists', exists (select 1 from public.artists where name = 'ArseniXC'));

select pg_temp.as_admin();
rollback;
