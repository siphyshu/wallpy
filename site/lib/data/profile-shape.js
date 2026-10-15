import { fileUrl } from '@/lib/storage';

// Shared by server and client code (no server-only imports here).
export const PROFILE_COLUMNS =
  'id, username, display_name, bio, website, links, contact_email, avatar_key, cover_key, role, created_at';

export const DEFAULT_AVATAR = '/avatar_placeholder.png';

/** Database row -> the shape the profile components use. */
export function toProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.display_name,
    bio: row.bio,
    website: row.website,
    links: Array.isArray(row.links) ? row.links : [],
    contact_email: row.contact_email,
    avatar_key: row.avatar_key,
    cover_key: row.cover_key,
    avatar_url: fileUrl(row.avatar_key),
    cover_url: fileUrl(row.cover_key),
    role: row.role,
    created_at: row.created_at,
  };
}
