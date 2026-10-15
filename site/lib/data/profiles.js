import { createClient } from '@/lib/supabase/server';
import { PROFILE_COLUMNS, toProfile } from '@/lib/data/profile-shape';

/** Public profile by username, or null. */
export async function getProfileByUsername(username) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('username', username)
    .maybeSingle();
  if (error) console.error('getProfileByUsername:', error);
  return toProfile(data);
}

/** The signed-in user's profile plus their account email, or null when signed out. */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();
  if (error) console.error('getCurrentProfile:', error);
  const profile = toProfile(data);
  return profile && { ...profile, email: user.email };
}
