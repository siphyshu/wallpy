'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ModerationResult = { ok: true } | { ok: false; error: string };

/**
 * Approve, send back (reject: the uploader can resubmit) or decline (a final
 * no that closes a new pack) a pending version. moderate() (security definer) checks
 * the caller's role and the version's state, so this action is not the
 * security boundary; it only relays the request and refreshes pages.
 */
export async function moderateVersion(
  versionId: string,
  slug: string,
  action: 'approve' | 'reject' | 'decline',
  notes: string,
): Promise<ModerationResult> {
  const trimmed = notes.trim().slice(0, 1000);
  if (action === 'reject' && !trimmed) return { ok: false, error: 'Say what needs to change.' };
  if (action === 'decline' && !trimmed) return { ok: false, error: 'Say why the pack is declined.' };

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

/**
 * Take a published pack down or put it back, with a reason (on a takedown its
 * owner sees it). moderate() checks the role and the pack's state.
 */
export async function setPackRemoved(
  versionId: string,
  slug: string,
  removed: boolean,
  reason: string,
): Promise<ModerationResult> {
  const trimmed = reason.trim().slice(0, 1000);
  if (!trimmed) return { ok: false, error: removed ? 'Say why the pack is taken down.' : 'Say why the pack is restored.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('moderate', {
    p_version: versionId,
    p_action: removed ? 'takedown' : 'restore',
    p_notes: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/moderation');
  revalidatePath(`/packs/${slug}`);
  revalidatePath('/gallery');
  return { ok: true };
}

/** Close a pack's open reports without acting on the pack. */
export async function dismissReports(packId: string): Promise<ModerationResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('dismiss_reports', { p_pack: packId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/moderation');
  return { ok: true };
}
