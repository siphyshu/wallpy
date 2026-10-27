import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicEnv } from '@/lib/env';

// Anonymous client with no cookies: reads exactly what a signed-out visitor
// sees (RLS applies). For pages that are cached and the same for everyone:
// the sitemap, share images, the homepage's gallery.
let client: SupabaseClient<Database> | undefined;

export function createPublicClient() {
  client ??= createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
