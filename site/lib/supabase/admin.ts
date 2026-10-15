import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicEnv, serverEnv } from '@/lib/env';

// Service-role client: bypasses RLS. Only for writes the API roles are not
// allowed to make (recording downloads, creating blob rows). Never import
// this from client components; 'server-only' makes that a build error.
let admin: SupabaseClient<Database> | undefined;

export function createAdminClient() {
  admin ??= createClient<Database>(publicEnv.supabaseUrl, serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
