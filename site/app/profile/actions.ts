'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Delete one of your declined packs, with its versions and files (images in
 * storage are shared by hash and kept). RLS only lets owners delete their own
 * packs; this checks it really is declined: closed before it was ever published.
 */
export async function deleteDeclinedPack(packId: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in first.' };

  const { data: pack } = await supabase
    .from('packs')
    .select('id, owner_id, removed_at, current_version_id, owner:profiles!packs_owner_id_fkey(username)')
    .eq('id', packId)
    .maybeSingle();
  if (!pack || pack.owner_id !== user.id) return { ok: false, error: 'Pack not found.' };
  if (!pack.removed_at || pack.current_version_id) return { ok: false, error: 'Only declined packs can be deleted.' };

  const { error } = await supabase.from('packs').delete().eq('id', packId);
  if (error) {
    console.error('deleteDeclinedPack:', error);
    return { ok: false, error: 'Could not delete the pack.' };
  }
  if (pack.owner?.username) revalidatePath(`/profile/${pack.owner.username}`);
  return { ok: true };
}
