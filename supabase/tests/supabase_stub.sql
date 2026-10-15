-- Minimal stand-in for the Supabase platform (roles, auth schema, default grants),
-- so migrations and supabase/tests/*.sql can run on a plain local Postgres.

do $$ begin create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create function auth.jwt() returns json language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::json $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- Supabase's default: every new public table is fully granted to API roles
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
