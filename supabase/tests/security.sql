-- Attack tests for RLS + column grants. Runs in a transaction and rolls back.
-- Usage: psql <db> -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
-- Each check raises on failure, so a clean run means every check passed.

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

create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Raises unless `stmt` fails with insufficient_privilege (42501).
create function pg_temp.expect_denied(label text, stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL %: statement was allowed', label;
exception when insufficient_privilege then
  raise notice 'ok   %', label;
end $$;

create function pg_temp.expect(label text, ok boolean) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL %', label; end if;
  raise notice 'ok   %', label;
end $$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- Fixtures: signup goes through the handle_new_user trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"username":"Alice","name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com',   '{"username":"bob","name":"Bob"}');

select pg_temp.expect('signup lowercases username',
  (select username from public.users where id = '00000000-0000-0000-0000-00000000000a') = 'alice');

do $$ begin
  insert into auth.users (email, raw_user_meta_data) values ('x@example.com', '{"username":"bad name!"}');
  raise exception 'FAIL invalid username rejected';
exception when check_violation then raise notice 'ok   invalid username rejected';
end $$;

-- ---- users ---------------------------------------------------------------
select pg_temp.as_user(null);
select pg_temp.expect_denied('anon cannot read emails', 'select email from public.users');
select pg_temp.expect('anon can read public profile fields',
  (select count(*) from public.users where username in ('alice', 'bob')) = 2);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_denied('user cannot promote self to admin',
  $q$update public.users set role = 'admin' where id = auth.uid()$q$);
select pg_temp.expect_denied('user cannot self-verify',
  $q$update public.users set is_verified = true where id = auth.uid()$q$);
select pg_temp.expect_denied('user cannot insert profile rows',
  $q$insert into public.users (id, username, email) values (gen_random_uuid(), 'evil', 'e@x')$q$);
update public.users set bio = 'hello' where id = auth.uid();
update public.users set bio = 'pwned' where username = 'bob';
select pg_temp.as_admin();
select pg_temp.expect('user can edit own bio',
  (select bio from public.users where username = 'alice') = 'hello');
select pg_temp.expect('user cannot edit another profile',
  (select bio from public.users where username = 'bob') is null);

-- ---- packs ---------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_denied('uploader cannot insert as approved',
  $q$insert into public.packs (title, slug, zip_file_url, uploaded_by, status)
     values ('x', 'x', 'u', auth.uid(), 'approved')$q$);
insert into public.packs (title, slug, zip_file_url, uploaded_by, is_published)
  values ('Sunset', 'sunset', 'https://files/sunset.zip', auth.uid(), true);
select pg_temp.expect_denied('uploader cannot approve own pack',
  $q$update public.packs set status = 'approved' where slug = 'sunset'$q$);
select pg_temp.expect_denied('uploader cannot set download_count',
  $q$update public.packs set download_count = 9999 where slug = 'sunset'$q$);
select pg_temp.expect('uploader sees own pending pack',
  exists (select 1 from public.packs where slug = 'sunset'));

select pg_temp.as_user(null);
select pg_temp.expect('anon cannot see pending pack',
  not exists (select 1 from public.packs where slug = 'sunset'));
select public.record_download('sunset');

select pg_temp.as_admin();
select pg_temp.expect('downloads of pending packs are not counted',
  (select download_count from public.packs where slug = 'sunset') = 0);
update public.packs set status = 'approved' where slug = 'sunset';

select pg_temp.as_user(null);
select pg_temp.expect('anon sees approved pack',
  exists (select 1 from public.packs where slug = 'sunset'));
select public.record_download('sunset');
select pg_temp.expect('download of approved pack is counted',
  (select download_count from public.packs where slug = 'sunset') = 1);
select pg_temp.expect_denied('anon cannot insert packs',
  $q$insert into public.packs (title, slug, zip_file_url) values ('x', 'y', 'u')$q$);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.packs set title = 'stolen' where slug = 'sunset';
delete from public.packs where slug = 'sunset';
select pg_temp.as_admin();
select pg_temp.expect('other users cannot edit or delete a pack',
  (select title from public.packs where slug = 'sunset') = 'Sunset');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.packs set title = 'Sunset Deluxe' where slug = 'sunset';
select pg_temp.as_admin();
select pg_temp.expect('metadata edit keeps approval',
  (select status from public.packs where slug = 'sunset') = 'approved');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.packs set zip_file_url = 'https://files/other.zip' where slug = 'sunset';
select pg_temp.as_admin();
select pg_temp.expect('swapping files sends pack back to review',
  (select status from public.packs where slug = 'sunset') = 'pending');

-- ---- favourites ----------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_denied('user cannot favourite on behalf of someone else',
  $q$insert into public.favourites (user_id, pack_id)
     values ('00000000-0000-0000-0000-00000000000a', null)$q$);

select pg_temp.as_admin();
rollback;
