import { createClient } from '@/lib/supabase/server';
import { PROFILE_COLUMNS, toProfile } from '@/lib/data/profile-shape';
import type { Profile } from '@/lib/types';
import { createPublicClient } from '@/lib/supabase/public';
import { blobUrl, fileUrl } from '@/lib/storage';

/** Public profile by username, or null. */
export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('username', username).maybeSingle();
  if (error) console.error('getProfileByUsername:', error);
  return toProfile(data);
}

/** The signed-in user's profile plus their account email, or null when signed out. */
export async function getCurrentProfile(): Promise<(Profile & { email: string | undefined }) | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle();
  if (error) console.error('getCurrentProfile:', error);
  const profile = toProfile(data);
  return profile && { ...profile, email: user.email };
}

/**
 * What a profile's share card shows: name, avatar, cover, how many public
 * packs they have and their four most downloaded (title + cover preview).
 */
export async function getProfileShare(username: string): Promise<{
  username: string;
  name: string;
  avatar: string | null;
  cover: string | null;
  packCount: number;
  packs: { title: string; cover: string | null }[];
} | null> {
  const supabase = createPublicClient();
  const { data: profile, error } = await supabase.from('profiles').select('id, username, display_name, avatar_key, cover_key').eq('username', username).maybeSingle();
  if (error) console.error('getProfileShare:', error);
  if (!profile) return null;
  const { data: packs, count } = await supabase
    .from('packs')
    .select('slug, version:pack_versions!packs_current_version_fkey!inner(title, preview:blobs!pack_versions_preview_sha256_fkey(sha256))', { count: 'exact' })
    .eq('owner_id', profile.id)
    .eq('is_listed', true)
    .is('removed_at', null)
    .not('current_version_id', 'is', null)
    .order('download_count', { ascending: false })
    .limit(4);
  return {
    username: profile.username,
    name: profile.display_name || profile.username,
    avatar: fileUrl(profile.avatar_key),
    cover: fileUrl(profile.cover_key),
    packCount: count ?? 0,
    packs: (packs ?? []).map((p) => ({ title: p.version.title, cover: blobUrl(p.version.preview?.sha256) })),
  };
}
