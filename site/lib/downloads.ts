import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Hash of the client IP that is only comparable within one UTC day: enough to
 * count a download once per person per day, useless for tracking anyone.
 */
function dailyIpHash(request: Request): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${day}:${ip}:${serverEnv.downloadHashSecret()}`).digest('hex');
}

/** Count a download of a public pack. Repeats from the same IP on the same day are ignored. */
export async function recordDownload(
  request: Request,
  { packId, versionId, profileId, client }: {
    packId: string;
    versionId: string;
    profileId: string | null | undefined;
    client: Database['public']['Enums']['download_client'];
  },
): Promise<void> {
  const { error } = await createAdminClient()
    .from('downloads')
    .upsert(
      { pack_id: packId, version_id: versionId, profile_id: profileId ?? null, client, ip_hash: dailyIpHash(request) },
      { onConflict: 'pack_id,ip_hash,day', ignoreDuplicates: true },
    );
  if (error) console.error('recordDownload:', error);
}
