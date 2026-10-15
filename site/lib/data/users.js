import { createClient } from '@/lib/supabase/server';
import { PUBLIC_USER_COLUMNS } from '@/lib/data/user-columns';

/**
 * Get a public profile by username. Returns null if not found.
 */
export async function getUserByUsername(username) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select(PUBLIC_USER_COLUMNS)
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error('getUserByUsername error:', error);
    return null;
  }
  return data;
}

/**
 * Get the signed-in user's profile (server-side), or null when signed out.
 * The account email comes from the auth session, not the users table.
 */
export async function getCurrentUser() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select(PUBLIC_USER_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    console.error('getCurrentUser error:', error);
    return null;
  }
  return { ...profile, email: user.email };
}
