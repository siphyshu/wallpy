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
  (repeat('c', 64), 1000, 'image/jpeg', '00000000-0000-0000-0000-00000000000b'),
  (repeat('d', 64), 1000, 'image/webp', '00000000-0000-0000-0000-00000000000a');
insert into public.blob_uploads (sha256, profile_id) values
  (repeat('a', 64), '00000000-0000-0000-0000-00000000000a'),
  (repeat('b', 64), '00000000-0000-0000-0000-00000000000a'),
  (repeat('c', 64), '00000000-0000-0000-0000-00000000000b'),
  (repeat('d', 64), '00000000-0000-0000-0000-00000000000a');
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
  $q$insert into public.pack_versions (pack_id, title, schedule, status)
     select id, 'x', '{"spec":2,"name":"x","slot":[{"images":["a.jpg"],"rotate":"every 30m"}]}', 'approved'
     from public.packs where slug = 'sunset'$q$);
select pg_temp.expect_error('spec 1 schedules are rejected',
  $q$insert into public.pack_versions (pack_id, title, schedule)
     select id, 'x', '{"meta":{"type":"album","name":"x"},"album":{"images":["a.jpg"],"interval":"30m"}}'
     from public.packs where slug = 'sunset'$q$, '{23514}');
select pg_temp.expect_error('kind is derived, not chosen',
  $q$insert into public.pack_versions (pack_id, title, kind, schedule)
     select id, 'x', 'days', '{"spec":2,"name":"x","slot":[{"images":["a.jpg"]}]}'
     from public.packs where slug = 'sunset'$q$, '{42501,428C9}');
select pg_temp.expect_error('bad slot time rejected',
  $q$insert into public.pack_versions (pack_id, title, schedule)
     select id, 'x', '{"spec":2,"name":"x","slot":[{"at":"sunrise+1h99m","images":["a.jpg"]}]}'
     from public.packs where slug = 'sunset'$q$, '{23514}');
select pg_temp.expect_error('album interval below 5m rejected',
  $q$insert into public.pack_versions (pack_id, title, schedule)
     select id, 'x', '{"spec":2,"name":"x","slot":[{"images":["a.jpg"],"rotate":"every 1m"}]}'
     from public.packs where slug = 'sunset'$q$, '{23514}');
select pg_temp.expect_error('schedule cannot reference paths outside the pack',
  $q$insert into public.pack_versions (pack_id, title, schedule)
     select id, 'x', '{"spec":2,"name":"x","slot":[{"images":["../../etc.jpg"],"rotate":"every 30m"}]}'
     from public.packs where slug = 'sunset'$q$, '{23514}');

insert into public.pack_versions (pack_id, title, schedule)
  select id, 'Sunset', '{"spec":2,"name":"Sunset","slot":[{"images":["a.jpg","b.jpg"],"rotate":"every 30m"}]}'
  from public.packs where slug = 'sunset';
select pg_temp.expect('version numbers are assigned',
  (select number from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset') = 1);
select pg_temp.expect_error('only one open draft per pack',
  $q$insert into public.pack_versions (pack_id, title, schedule)
     select id, 'again', '{"spec":2,"name":"x","slot":[{"images":["a.jpg"],"rotate":"every 30m"}]}'
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
select pg_temp.expect_error('submit needs an AI-use answer',
  $q$select public.moderate((select v.id from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset'), 'submit')$q$,
  '{23514}');
update public.pack_versions set ai_use = 'assisted' where title = 'Sunset';
select pg_temp.expect_error('submit needs a category',
  $q$select public.moderate((select v.id from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'sunset'), 'submit')$q$,
  '{23514}');
select pg_temp.expect_error('unknown category rejected',
  $q$update public.pack_versions set categories = '{sunsets}' where title = 'Sunset'$q$, '{22P02}');
select pg_temp.expect_error('retired category (nature, 2026-10-19) rejected',
  $q$update public.pack_versions set categories = '{nature}' where title = 'Sunset'$q$, '{22P02}');
select pg_temp.expect_error('more than two categories rejected',
  $q$update public.pack_versions set categories = '{landscapes,space,illustration}' where title = 'Sunset'$q$, '{23514}');
select pg_temp.expect_error('duplicate categories rejected',
  $q$update public.pack_versions set categories = '{landscapes,landscapes}' where title = 'Sunset'$q$, '{23514}');
select pg_temp.expect_error('uppercase tags rejected',
  $q$update public.pack_versions set tags = '{Sunset}' where title = 'Sunset'$q$, '{23514}');
select pg_temp.expect_error('tags with spaces rejected',
  $q$update public.pack_versions set tags = '{golden hour}' where title = 'Sunset'$q$, '{23514}');
select pg_temp.expect_error('duplicate tags rejected',
  $q$update public.pack_versions set tags = '{sea,sea}' where title = 'Sunset'$q$, '{23514}');
select pg_temp.expect_error('more than 10 tags rejected',
  $q$update public.pack_versions set tags = '{a,b,c,d,e,f,g,h,i,j,k}' where title = 'Sunset'$q$, '{23514}');
update public.pack_versions set categories = '{landscapes,pixel-art}', tags = '{golden-hour}' where title = 'Sunset';
select pg_temp.expect('kind is derived from the schedule', (select kind from public.pack_versions where title = 'Sunset') = 'album');
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
insert into public.pack_versions (pack_id, title, ai_use, categories, schedule)
  select id, 'Sunset II', 'none', '{landscapes}', '{"spec":2,"name":"Sunset II","slot":[{"images":["a.jpg"],"rotate":"every 1h"}]}'
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
  (select string_agg(title || '=' || status, ',' order by number) from public.pack_versions
   where pack_id = (select id from public.packs where slug = 'sunset')) = 'Sunset=superseded,Sunset II=approved');

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
insert into public.artists (name, url) values ('Test Artist T', 'https://example.test/artist');
select pg_temp.expect('artist records who added it',
  (select created_by from public.artists where name = 'Test Artist T') = '00000000-0000-0000-0000-00000000000b');
update public.artists set name = 'Vandalised' where name = 'Test Artist T';
select pg_temp.as_admin();
select pg_temp.expect('only moderators edit artists', exists (select 1 from public.artists where name = 'Test Artist T'));

-- ---- upload pipeline -------------------------------------------------------------
create function pg_temp.payload(title text, images text[], files jsonb, submit boolean default true) returns jsonb
language sql as $$
  select jsonb_build_object(
    'slug', 'beach', 'title', title, 'tags', '["sea"]'::jsonb, 'categories', '["landscapes"]'::jsonb, 'ai_use', 'none', 'submit', submit,
    'uploader_is_artist', true, 'files', files, 'cover', files -> 0 ->> 'path',
    'schedule', jsonb_build_object('spec', 2, 'name', title,
      'slot', jsonb_build_array(jsonb_build_object('images', to_jsonb(images), 'rotate', 'every 1h'))))
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot create packs',
  $q$select public.create_pack(pg_temp.payload('Beach', '{a.jpg}', '[{"path":"a.jpg","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]'))$q$);

-- Bob has a private draft called "beach"; Alice can't see it, but mustn't collide with it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.create_pack(pg_temp.payload('Bob Beach', '{c.jpg}', jsonb_build_array(jsonb_build_object('path', 'c.jpg', 'sha256', repeat('c', 64))), false));

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table created as
  select public.create_pack(pg_temp.payload('Beach', '{a.jpg,b.jpg}',
    jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)),
                      jsonb_build_object('path', 'b.jpg', 'sha256', repeat('b', 64))))) as r;
select pg_temp.expect('create_pack creates and submits, picking a free slug past an invisible draft',
  (select r ->> 'slug' = 'beach-2' and r ->> 'status' = 'pending' from created));
select pg_temp.expect('cover defaults to the first file',
  (select f.path from public.pack_versions v join public.version_files f on f.id = v.cover_file_id
   join public.packs p on p.id = v.pack_id where p.slug = 'beach-2') = 'a.jpg');
select pg_temp.expect_error('cannot build a pack from someone else''s private blob',
  $q$select public.create_pack(pg_temp.payload('Stolen', '{c.jpg}', jsonb_build_array(jsonb_build_object('path', 'c.jpg', 'sha256', repeat('c', 64)))))$q$);
select pg_temp.expect_error('a failed submission leaves nothing behind (missing image)',
  $q$select public.create_pack(pg_temp.payload('Broken', '{a.jpg,ghost.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))))$q$,
  '{23514}');
select pg_temp.expect('no half-created pack', not exists (select 1 from public.packs where slug like 'beach-3%'));
select pg_temp.expect_error('cannot add a version to someone else''s pack',
  $q$select public.create_version('beach', pg_temp.payload('Hijack', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))))$q$,
  '{P0002}');

-- Bob uploads the same image Alice did: one blob, both may use it.
select pg_temp.as_server();
insert into public.blob_uploads (sha256, profile_id) values (repeat('a', 64), '00000000-0000-0000-0000-00000000000b');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect('a shared blob can be used by everyone who uploaded it',
  (public.create_pack(pg_temp.payload('Same Pic', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))))) ->> 'status' = 'pending');
select pg_temp.expect_error('users cannot claim blobs directly',
  $q$insert into public.blob_uploads (sha256, profile_id) values (repeat('b', 64), auth.uid())$q$);

-- Thumbnails follow the same rule as files.
select pg_temp.expect_error('cannot use someone else''s private blob as a thumbnail',
  $q$select public.create_pack(pg_temp.payload('Thumb Thief', '{c.jpg}', jsonb_build_array(jsonb_build_object('path', 'c.jpg', 'sha256', repeat('c', 64))))
     || jsonb_build_object('thumb_sha256', repeat('b', 64)))$q$,
  '{42501}');

-- So do each file's renditions (thumbnail and preview).
select pg_temp.expect_error('cannot use someone else''s private blob as a file thumbnail',
  $q$select public.create_pack(pg_temp.payload('File Thumb Thief', '{a.jpg}',
     jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64), 'thumb_sha256', repeat('b', 64)))))$q$,
  '{42501}');
select pg_temp.expect_error('cannot use someone else''s private blob as a file preview',
  $q$select public.create_pack(pg_temp.payload('File Preview Thief', '{a.jpg}',
     jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64), 'preview_sha256', repeat('d', 64)))))$q$,
  '{42501}');

-- New versions: one open version at a time; after a rejection, the owner resubmits.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error('cannot submit a new version while one is in review',
  $q$select public.create_version('beach-2', pg_temp.payload('Beach again', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))))$q$,
  '{23505}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.moderate((select v.id from public.pack_versions v join public.packs p on p.id = v.pack_id where p.slug = 'beach-2'), 'reject', 'needs a night image');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table resubmitted as
  select public.create_version('beach-2', pg_temp.payload('Beach at night', '{a.jpg,b.jpg}',
    jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64),
                                         'thumb_sha256', repeat('d', 64), 'preview_sha256', repeat('d', 64)),
                      jsonb_build_object('path', 'b.jpg', 'sha256', repeat('b', 64))))
    || jsonb_build_object('thumb_sha256', repeat('a', 64))) as r;
grant select on resubmitted to anon, service_role;
select pg_temp.expect('after a rejection the owner can submit version 2',
  (select v.number = 2 and v.status = 'pending' and v.thumb_sha256 = repeat('a', 64)
   from resubmitted join public.pack_versions v on v.id = (r ->> 'version_id')::uuid));
select pg_temp.expect('file renditions are saved with the file',
  (select f.thumb_sha256 = repeat('d', 64) and f.preview_sha256 = repeat('d', 64)
   from resubmitted join public.version_files f on f.version_id = (r ->> 'version_id')::uuid and f.path = 'a.jpg'));
select pg_temp.expect_error('file renditions cannot be changed directly',
  $q$update public.version_files set thumb_sha256 = repeat('c', 64) where path = 'a.jpg'$q$);
select pg_temp.expect_error('cannot attach someone else''s private blob as a rendition directly',
  $q$insert into public.version_files (version_id, path, sha256, thumb_sha256)
     select v.id, 'z.jpg', repeat('a', 64), repeat('c', 64) from public.pack_versions v join public.packs p on p.id = v.pack_id
     where p.slug = 'sunset' and v.number = 2$q$);
select pg_temp.as_user(null);
select pg_temp.expect('renditions of an unpublished file stay private',
  not exists (select 1 from public.blobs where sha256 = repeat('d', 64)));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.moderate((select (r ->> 'version_id')::uuid from resubmitted), 'approve');
select pg_temp.as_user(null);
select pg_temp.expect('a published file''s renditions are public',
  exists (select 1 from public.blobs where sha256 = repeat('d', 64))
  and (select thumb_sha256 from public.version_files where version_id = (select (r ->> 'version_id')::uuid from resubmitted) and path = 'a.jpg') = repeat('d', 64));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect('anyone may reuse a public rendition', public.can_use_blob(repeat('d', 64)));
select pg_temp.as_server();
select pg_temp.expect_error('a rendition must be a stored blob',
  $q$update public.version_files set preview_sha256 = repeat('e', 64)
     where version_id = (select (r ->> 'version_id')::uuid from resubmitted) and path = 'a.jpg'$q$, '{23503}');
select pg_temp.expect_error('a blob in use as a rendition cannot be deleted',
  $q$delete from public.blobs where sha256 = repeat('d', 64)$q$, '{23503}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('the rejected version stays as it was',
  (select status = 'rejected' and title = 'Beach' from public.pack_versions v join public.packs p on p.id = v.pack_id
   where p.slug = 'beach-2' and v.number = 1));

-- Declining closes a new pack for good.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
create temp table spam as
  select public.create_pack(pg_temp.payload('Spam', '{c.jpg}', jsonb_build_array(jsonb_build_object('path', 'c.jpg', 'sha256', repeat('c', 64))))) as r;
select pg_temp.expect_error('uploaders cannot decline',
  $q$select public.moderate((select (r ->> 'version_id')::uuid from spam), 'decline', 'no')$q$, '{42501}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error('declining needs a reason',
  $q$select public.moderate((select (r ->> 'version_id')::uuid from spam), 'decline', ' ')$q$, '{23514}');
select public.moderate((select (r ->> 'version_id')::uuid from spam), 'decline', 'spam');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect('a declined pack is closed and its version rejected',
  (select p.removed_at is not null and p.removed_reason = 'spam' and v.status = 'rejected'
   from spam join public.pack_versions v on v.id = (r ->> 'version_id')::uuid join public.packs p on p.id = v.pack_id));
select pg_temp.expect_error('a closed pack takes no new versions',
  $q$select public.create_version((select r ->> 'slug' from spam), pg_temp.payload('Spam again', '{c.jpg}', jsonb_build_array(jsonb_build_object('path', 'c.jpg', 'sha256', repeat('c', 64)))))$q$,
  '{42501}');

-- Owners can delete a declined pack (versions, files and events go with it).
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
delete from public.packs where slug = (select r ->> 'slug' from spam);
select pg_temp.as_admin();
select pg_temp.expect('others cannot delete someone''s pack',
  exists (select 1 from public.packs where slug = (select r ->> 'slug' from spam)));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
delete from public.packs where slug = (select r ->> 'slug' from spam);
select pg_temp.expect('the owner can delete a declined pack',
  not exists (select 1 from public.pack_versions where id = (select (r ->> 'version_id')::uuid from spam)));

-- ---- categories + tags ------------------------------------------------------------
select pg_temp.as_admin();
create temp table expected_tags as
  select distinct t from public.pack_versions v, unnest(v.tags) t where public.is_public_version(v.id);
create temp table draft_only_tags as
  select distinct t from public.pack_versions v, unnest(v.tags) t where not public.is_public_version(v.id)
  except select t from expected_tags;
grant select on expected_tags, draft_only_tags to anon;
select pg_temp.as_user(null);
select pg_temp.expect('anon autocompletes from public packs'' tags only',
  (select count(*) from expected_tags) > 0 and (select count(*) from draft_only_tags) > 0
  and (select array_agg(tag order by tag) from public.public_tags()) = (select array_agg(t order by t) from expected_tags));
select pg_temp.expect_error('anon cannot change categories',
  $q$update public.pack_versions set categories = '{space}' where title = 'Sunset'$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.pack_versions set categories = '{space}' where title = 'Sunset';
select pg_temp.as_admin();
select pg_temp.expect('others cannot change categories',
  (select categories from public.pack_versions where title = 'Sunset') = '{landscapes,pixel-art}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error('owner cannot change categories of a published version',
  $q$update public.pack_versions set categories = '{space}' where title = 'Sunset'$q$);
select pg_temp.expect_error('create_pack rejects an unknown category',
  $q$select public.create_pack(pg_temp.payload('Cat', '{a.jpg}', '[{"path":"a.jpg","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]') || '{"categories":["memes"]}')$q$,
  '{22P02}');
select pg_temp.expect_error('create_pack rejects three categories',
  $q$select public.create_pack(pg_temp.payload('Cat', '{a.jpg}', '[{"path":"a.jpg","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]') || '{"categories":["illustration","space","anime"]}')$q$,
  '{23514}');
select pg_temp.expect_error('create_pack cannot submit without a category',
  $q$select public.create_pack(pg_temp.payload('Cat', '{a.jpg}', '[{"path":"a.jpg","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]') || '{"categories":[]}')$q$,
  '{23514}');
select pg_temp.expect_error('create_pack rejects unnormalised tags',
  $q$select public.create_pack(pg_temp.payload('Cat', '{a.jpg}', '[{"path":"a.jpg","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]') || '{"tags":["Big Sea"]}')$q$,
  '{23514}');

-- ---- owner controls: unlist, delete, withdraw, delete account ----------------
select pg_temp.as_admin();
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.test', '{"username":"dave_t"}'),
  ('00000000-0000-0000-0000-00000000000e', 'erin@example.test', '{"username":"erin_t"}');
insert into public.blob_uploads (sha256, profile_id) values (repeat('a', 64), '00000000-0000-0000-0000-00000000000d'), (repeat('a', 64), '00000000-0000-0000-0000-00000000000e');
create temp table owned (k text, r jsonb);
grant all on owned to anon, authenticated;
create function pg_temp.slug_of(key text) returns text language sql as $$ select r ->> 'slug' from owned where k = key $$;
create function pg_temp.version_of(key text) returns uuid language sql as $$ select (r ->> 'version_id')::uuid from owned where k = key $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into owned select 'pub', public.create_pack(pg_temp.payload('Dave Pub', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))));
insert into owned select 'unl', public.create_pack(pg_temp.payload('Dave Unlisted', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))));
insert into owned select 'gone', public.create_pack(pg_temp.payload('Dave Gone', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))));
insert into owned select 'draft', public.create_pack(pg_temp.payload('Dave Draft', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64))), false));
insert into owned select 'pend', public.create_pack(pg_temp.payload('Dave Pending', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
insert into owned select 'erin', public.create_pack(pg_temp.payload('Erin Pub', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.moderate(pg_temp.version_of(k), 'approve') from owned where k in ('pub', 'unl', 'gone', 'erin');

-- Unlist: only the owner, and the pack stays reachable by link.
select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot unlist a pack',
  $q$update public.packs set is_listed = false where slug = pg_temp.slug_of('unl')$q$);
select pg_temp.expect_error('anon cannot delete a pack',
  $q$delete from public.packs where slug = pg_temp.slug_of('unl')$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
update public.packs set is_listed = false where slug = pg_temp.slug_of('unl');
delete from public.packs where slug = pg_temp.slug_of('unl');
select pg_temp.expect('others cannot unlist or delete someone''s published pack',
  (select is_listed from public.packs where slug = pg_temp.slug_of('unl')));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update public.packs set is_listed = false where slug = pg_temp.slug_of('unl');
select pg_temp.as_user(null);
select pg_temp.expect('an unlisted pack still opens by link',
  exists (select 1 from public.packs p join public.pack_versions v on v.id = p.current_version_id
          where v.title = 'Dave Unlisted' and not p.is_listed));
select pg_temp.expect('an unlisted pack''s files stay installable',
  exists (select 1 from public.version_files f join public.pack_versions v on v.id = f.version_id where v.title = 'Dave Unlisted'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update public.packs set is_listed = true where slug = pg_temp.slug_of('unl');
select pg_temp.expect('the owner can list it again',
  (select is_listed from public.packs where slug = pg_temp.slug_of('unl')));

-- Delete a published pack: gone for everyone.
delete from public.packs where slug = pg_temp.slug_of('gone');
select pg_temp.as_admin();
select pg_temp.expect('the owner can delete a published pack',
  not exists (select 1 from public.packs where slug = pg_temp.slug_of('gone'))
  and not exists (select 1 from public.pack_versions where id = pg_temp.version_of('gone')));

-- Withdraw a version in review.
select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot withdraw',
  $q$select public.withdraw_version(pg_temp.version_of('pend'))$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error('others cannot withdraw someone''s version',
  $q$select public.withdraw_version(pg_temp.version_of('pend'))$q$, '{P0002}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error('only versions in review can be withdrawn',
  $q$select public.withdraw_version(pg_temp.version_of('pub'))$q$, '{23514}');
select pg_temp.expect('withdrawing returns draft', public.withdraw_version(pg_temp.version_of('pend')) = 'draft');
select pg_temp.expect('the owner withdraws a version in review',
  (select status = 'draft' and submitted_at is null from public.pack_versions where id = pg_temp.version_of('pend')));
select pg_temp.expect('a withdrawal is logged',
  exists (select 1 from public.moderation_events where version_id = pg_temp.version_of('pend') and action = 'withdraw'));
update public.pack_versions set title = 'Dave Pending 2' where id = pg_temp.version_of('pend');
select pg_temp.expect('a withdrawn version is editable again',
  (select title from public.pack_versions where id = pg_temp.version_of('pend')) = 'Dave Pending 2');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error('others cannot replace someone''s draft',
  $q$select public.create_version_replacing_draft(pg_temp.slug_of('pend'), pg_temp.payload('Hijack', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))))$q$, '{P0002}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect('their draft survives', exists (select 1 from public.pack_versions where id = pg_temp.version_of('pend')));
select pg_temp.expect_error('a failed resubmission keeps the draft',
  $q$select public.create_version_replacing_draft(pg_temp.slug_of('pend'), pg_temp.payload('Broken', '{a.jpg,ghost.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))))$q$, '{23514}');
select pg_temp.expect('the draft is still there after the failure', exists (select 1 from public.pack_versions where id = pg_temp.version_of('pend')));
insert into owned select 'pend2', public.create_version_replacing_draft(pg_temp.slug_of('pend'), pg_temp.payload('Dave Pending 3', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))));
select pg_temp.expect('resubmitting replaces the draft',
  not exists (select 1 from public.pack_versions where id = pg_temp.version_of('pend'))
  and (select status from public.pack_versions where id = pg_temp.version_of('pend2')) = 'pending');
select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot resubmit',
  $q$select public.create_version_replacing_draft(pg_temp.slug_of('pend'), '{}'::jsonb)$q$);

-- Delete an account.
select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot delete an account',
  $q$select public.delete_my_account(false)$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
-- an update in review on a published pack is dropped when the pack is kept
insert into owned select 'pub2', public.create_version(pg_temp.slug_of('pub'), pg_temp.payload('Dave Pub v2', '{a.jpg}', jsonb_build_array(jsonb_build_object('path', 'a.jpg', 'sha256', repeat('a', 64)))));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select public.delete_my_account(false);
select pg_temp.as_admin();
select pg_temp.expect('deleting an account removes only the caller',
  not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000e')
  and not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000e')
  and exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000d'));
select pg_temp.expect('without keeping, published packs go too',
  not exists (select 1 from public.packs where slug = pg_temp.slug_of('erin')));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.delete_my_account(true);
select pg_temp.as_admin();
select pg_temp.expect('the account and profile are gone',
  not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000d') and not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000d'));
select pg_temp.expect('unpublished packs are deleted',
  not exists (select 1 from public.packs where slug in (pg_temp.slug_of('draft'), pg_temp.slug_of('pend'))));
select pg_temp.expect('their packs in review are deleted with them',
  not exists (select 1 from public.pack_versions where id = pg_temp.version_of('pend2')));
select pg_temp.expect('kept packs drop their unreviewed versions',
  not exists (select 1 from public.pack_versions where id = pg_temp.version_of('pub2')));
select pg_temp.as_user(null);
select pg_temp.expect('kept published packs stay public, credited to no one',
  (select count(*) from public.packs p join public.pack_versions v on v.id = p.current_version_id
   where v.title in ('Dave Pub', 'Dave Unlisted') and p.owner_id is null) = 2);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error('nobody can claim an ownerless pack',
  $q$update public.packs set owner_id = auth.uid() where slug = pg_temp.slug_of('pub')$q$);
select pg_temp.expect('profiles have no website column (moved into links)',
  not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'website'));

-- ---- reports, takedown, restore, history -------------------------------------------
select pg_temp.as_admin();
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000f', 'fay@example.test', '{"username":"fay_t"}');
create function pg_temp.sunset() returns uuid language sql security definer as $$ select id from public.packs where slug = 'sunset' $$;
create function pg_temp.sunset_v() returns uuid language sql security definer as $$ select current_version_id from public.packs where slug = 'sunset' $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot report a pack',
  $q$select public.report_pack(pg_temp.sunset(), 'stolen')$q$);
select pg_temp.expect_error('anon cannot read reports', $q$select * from public.pack_reports$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error('reports cannot be written directly',
  $q$insert into public.pack_reports (pack_id, reporter_id, reason) values (pg_temp.sunset(), auth.uid(), 'other')$q$);
select pg_temp.expect('a signed-in visitor can report a published pack',
  public.report_pack(pg_temp.sunset(), 'stolen', 'my art, uncredited') is not null);
select pg_temp.expect_error('one open report per person per pack',
  $q$select public.report_pack(pg_temp.sunset(), 'offensive')$q$, '{23505}');
select pg_temp.expect_error('report notes are capped at 500 characters',
  $q$select public.report_pack(pg_temp.sunset(), 'other', repeat('x', 501))$q$, '{23514}');
select pg_temp.expect_error('reporters cannot dismiss reports',
  $q$select public.dismiss_reports(pg_temp.sunset())$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error('owners cannot report their own pack',
  $q$select public.report_pack(pg_temp.sunset(), 'broken')$q$, '{23514}');
select pg_temp.expect('owners cannot read reports on their pack', not exists (select 1 from public.pack_reports));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select public.report_pack(pg_temp.sunset(), 'broken');
select pg_temp.expect('reporters see only their own reports',
  (select count(*) from public.pack_reports) = 1 and (select reason from public.pack_reports) = 'broken');
select pg_temp.expect('strangers cannot read a pack''s moderation history',
  not exists (select 1 from public.moderation_events where version_id = pg_temp.sunset_v()));
select pg_temp.expect_error('non-moderators cannot take a pack down',
  $q$select public.moderate(pg_temp.sunset_v(), 'takedown', 'spite')$q$);
select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot read moderation history', $q$select * from public.moderation_events$q$);

-- Spam brake.
select pg_temp.as_admin();
insert into public.pack_reports (pack_id, reporter_id, reason, status)
  select pg_temp.sunset(), '00000000-0000-0000-0000-00000000000b', 'other', 'dismissed' from generate_series(1, 5);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error('reporting is rate-limited',
  $q$select public.report_pack((select id from public.packs where slug = pg_temp.slug_of('pub')), 'other')$q$, '{54000}');

-- Moderators: read, dismiss, take down (reason required), restore.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect('moderators read every open report',
  (select count(*) from public.pack_reports where status = 'open') = 2);
select pg_temp.expect('moderators read the history',
  exists (select 1 from public.moderation_events where version_id = pg_temp.sunset_v() and action = 'takedown'));
select pg_temp.expect_error('a takedown needs a reason',
  $q$select public.moderate(pg_temp.sunset_v(), 'takedown', '  ')$q$, '{23514}');
select pg_temp.expect_error('only taken-down packs can be restored',
  $q$select public.moderate(pg_temp.sunset_v(), 'restore')$q$, '{23514}');
select public.moderate(pg_temp.sunset_v(), 'takedown', 'Uses art without credit.');
select pg_temp.expect('a takedown closes the open reports',
  not exists (select 1 from public.pack_reports where status = 'open')
  and (select count(*) from public.pack_reports where status = 'actioned') = 2);
select pg_temp.expect_error('a pack cannot be taken down twice',
  $q$select public.moderate(pg_temp.sunset_v(), 'takedown', 'again')$q$, '{23514}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select pg_temp.expect_error('taken-down packs cannot be reported',
  $q$select public.report_pack(pg_temp.sunset(), 'other')$q$, '{P0002}');
select pg_temp.expect_error('non-moderators cannot restore a pack',
  $q$select public.moderate(pg_temp.sunset_v(), 'restore', 'please')$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('the owner sees the takedown reason',
  (select removed_reason from public.packs where slug = 'sunset') = 'Uses art without credit.');
select pg_temp.expect_error('owners cannot restore their own pack',
  $q$select public.moderate(pg_temp.sunset_v(), 'restore', 'fixed')$q$);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.moderate(pg_temp.sunset_v(), 'restore', 'Credit added.');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select public.report_pack(pg_temp.sunset(), 'other');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect('a restored pack is public again',
  (select removed_at from public.packs where slug = 'sunset') is null);
select pg_temp.expect('moderators dismiss a pack''s open reports', public.dismiss_reports(pg_temp.sunset()) = 1);
select pg_temp.expect('the restore is logged with its note',
  exists (select 1 from public.moderation_events where version_id = pg_temp.sunset_v() and action = 'restore' and notes = 'Credit added.'));

-- ---- notices (dot + /notices) -------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('the owner sees their own review events, newest first',
  (select count(*) from public.my_notices()) = 8
  and (select notes from public.my_notices() order by created_at desc, id desc limit 1) = 'Credit added.');
select pg_temp.expect('the takedown reason is visible to the owner',
  exists (select 1 from public.my_notices() where action = 'takedown' and notes = 'Uses art without credit.'));
select pg_temp.expect('the restore note is visible too',
  exists (select 1 from public.my_notices() where action = 'restore' and notes = 'Credit added.'));
select pg_temp.expect('my_notices never names the moderator',
  not exists (select 1 from public.my_notices() n where to_jsonb(n)::text ilike '%mod_t%'));
-- Everything in this file runs in one transaction, so now() never advances;
-- backdate notices_seen_at to simulate a profile that hasn't looked in a while.
update public.profiles set notices_seen_at = '2000-01-01' where id = auth.uid();
select pg_temp.expect('the dot is on before marking notices seen', public.has_unseen_notices());

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect('another user sees none of alice''s events', not exists (select 1 from public.my_notices()));
select pg_temp.expect('and no dot for events on someone else''s pack', not public.has_unseen_notices());
update public.profiles set notices_seen_at = '1999-01-01' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.as_admin();
select pg_temp.expect('a user cannot mark another user''s notices seen',
  (select notices_seen_at from public.profiles where id = '00000000-0000-0000-0000-00000000000a') <> timestamptz '1999-01-01');

select pg_temp.as_user(null);
select pg_temp.expect_error('anon cannot call my_notices', $q$select * from public.my_notices()$q$);
select pg_temp.expect_error('anon cannot call has_unseen_notices', $q$select public.has_unseen_notices()$q$);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.profiles set notices_seen_at = now() where id = auth.uid();
select pg_temp.expect('marking them seen turns the dot off', not public.has_unseen_notices());

select pg_temp.as_admin();
rollback;
