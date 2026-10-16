'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ModerationResult = { ok: true } | { ok: false; error: string };

/**
 * Approve or reject a pending version. moderate() (security definer) checks
 * the caller's role and the version's state, so this action is not the
 * security boundary; it only relays the request and refreshes pages.
 */
export async function moderateVersion(
  versionId: string,
  slug: string,
  action: 'approve' | 'reject',
  notes: string,
): Promise<ModerationResult> {
  const trimmed = notes.trim().slice(0, 1000);
  if (action === 'reject' && !trimmed) return { ok: false, error: 'Say what needs to change.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('moderate', {
    p_version: versionId,
    p_action: action,
    p_notes: trimmed || undefined,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/moderation');
  revalidatePath(`/packs/${slug}`);
  revalidatePath('/gallery');
  return { ok: true };
}
