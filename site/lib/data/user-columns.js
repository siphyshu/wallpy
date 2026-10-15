// Columns the API roles are allowed to read on public.users. `email` is
// deliberately absent: it isn't granted to anon/authenticated, so `select('*')`
// fails. Shared by server and client code.
export const PUBLIC_USER_COLUMNS =
  'id, username, name, avatar_url, bio, website, role, is_verified, created_at, cover_url, links, email_contact';
