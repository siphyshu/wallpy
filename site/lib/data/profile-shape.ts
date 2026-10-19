import { fileUrl } from '@/lib/storage';
import type { Database } from '@/lib/database.types';
import type { Profile, ProfileLink } from '@/lib/types';

// Shared by server and client code (no server-only imports here).
export const PROFILE_COLUMNS =
  'id, username, display_name, bio, links, contact_email, avatar_key, cover_key, role, created_at' as const;

export const DEFAULT_AVATAR = '/avatar_placeholder.png';

/** Fired on window after you save your profile, so the navbar's avatar and name follow. */
export const PROFILE_UPDATED_EVENT = 'wallpy:profile-updated';

type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'username' | 'display_name' | 'bio' | 'links' | 'contact_email' | 'avatar_key' | 'cover_key' | 'role' | 'created_at'
>;

/** Database row -> the shape the profile components use. */
export function toProfile(row: ProfileRow | null | undefined): Profile | null {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.display_name,
    bio: row.bio,
    // Shape enforced by the valid_links() check constraint.
    links: Array.isArray(row.links) ? (row.links as ProfileLink[]) : [],
    contact_email: row.contact_email,
    avatar_key: row.avatar_key,
    cover_key: row.cover_key,
    avatar_url: fileUrl(row.avatar_key),
    cover_url: fileUrl(row.cover_key),
    role: row.role,
    created_at: row.created_at,
  };
}
