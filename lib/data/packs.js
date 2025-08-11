import { createClient } from '@/lib/supabase/server'

export async function getPublishedPacks() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .eq('is_published', true);

    if (error) {
      console.error('Error fetching packs:', error);
      throw new Error('Failed to fetch packs');
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching packs:', error);
    throw new Error('Failed to fetch packs');
  }  
}


export async function getPackCount() {
  try {
    const packs = await getPublishedPacks();
    return packs.length;
  } catch (error) {
    console.error('Error fetching pack count:', error);
    throw new Error('Failed to fetch pack count');
  }
}

/**
 * Get packs uploaded by a specific user (by username)
 */
export async function getPacksByUsername(username) {
  try {
    const supabase = await createClient();
    // First, get the user id from username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    if (userError || !user) {
      throw new Error('User not found');
    }
    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .eq('uploaded_by', user.id);
    if (error) {
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching packs by username:', error);
    return [];
  }
}

/**
 * Get packs favourited by a specific user (by username)
 * Assumes a 'favourites' table with user_id and pack_id
 */
export async function getFavouritedPacksByUsername(username) {
  try {
    const supabase = await createClient();
    // Get user id from username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    if (userError || !user) {
      throw new Error('User not found');
    }
    // Get all favourited pack ids
    const { data: favourites, error: favError } = await supabase
      .from('favourites')
      .select('pack_id')
      .eq('user_id', user.id);
    if (favError) {
      throw favError;
    }
    const packIds = favourites.map(fav => fav.pack_id);
    if (packIds.length === 0) return [];
    // Fetch packs by ids
    const { data: packs, error: packsError } = await supabase
      .from('packs')
      .select('*')
      .in('id', packIds);
    if (packsError) {
      throw packsError;
    }
    return packs || [];
  } catch (error) {
    console.error('Error fetching favourited packs by username:', error);
    return [];
  }
}