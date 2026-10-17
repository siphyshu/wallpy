'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Owner controls for a pack. RLS and withdraw_version() decide who may do what;
// these only add the checks a person can act on.

export type OwnerActionResult = { ok: true } | { ok: false; error: string };

async function ownedPack(packId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, pack: null, error: 'Sign in first.' };
  const { data: pack } = await supabase
    .from('packs')
    .select('id, slug, owner_id, current_version_id, removed_at, owner:profiles!packs_owner_id_fkey(username)')
    .eq('id', packId)
    .maybeSingle();
  if (!pack || pack.owner_id !== user.id) return { supabase, pack: null, error: 'Pack not found.' };
  return { supabase, pack, error: null };
}

function refresh(pack: { slug: string; owner: { username: string } | null }) {
  revalidatePath(`/packs/${pack.slug}`);
  revalidatePath('/gallery');
  if (pack.owner?.username) revalidatePath(`/profile/${pack.owner.username}`);
}

/** Show a published pack in the gallery, search and your profile, or hide it there. Its link keeps working. */
export async function setPackListed(packId: string, listed: boolean): Promise<OwnerActionResult> {
  const { supabase, pack, error } = await ownedPack(packId);
  if (!pack) return { ok: false, error: error! };
  const { error: updateError } = await supabase.from('packs').update({ is_listed: listed }).eq('id', packId);
  if (updateError) {
    console.error('setPackListed:', updateError);
    return { ok: false, error: listed ? 'Could not list the pack.' : 'Could not unlist the pack.' };
  }
  refresh(pack);
  return { ok: true };
}

/**
 * Delete one of your packs, with its versions and files. Images in storage are
 * shared by hash and kept. `confirmName` must match the pack's slug or title.
 */
export async function deletePack(packId: string, confirmName: string): Promise<OwnerActionResult> {
  const { supabase, pack, error } = await ownedPack(packId);
  if (!pack) return { ok: false, error: error! };
  if (pack.current_version_id) {
    const { data: v } = await supabase.from('pack_versions').select('title').eq('id', pack.current_version_id).maybeSingle();
    const typed = confirmName.trim().toLowerCase();
    if (typed !== pack.slug && typed !== v?.title.trim().toLowerCase()) {
      return { ok: false, error: 'Type the pack name to confirm.' };
    }
  }
  const { error: deleteError } = await supabase.from('packs').delete().eq('id', packId);
  if (deleteError) {
    console.error('deletePack:', deleteError);
    return { ok: false, error: 'Could not delete the pack.' };
  }
  refresh(pack);
  return { ok: true };
}

/** Take a version back out of review: it becomes a draft again. */
export async function withdrawVersion(packId: string, versionId: string): Promise<OwnerActionResult> {
  const { supabase, pack, error } = await ownedPack(packId);
  if (!pack) return { ok: false, error: error! };
  const { error: rpcError } = await supabase.rpc('withdraw_version', { p_version: versionId });
  if (rpcError) {
    console.error('withdrawVersion:', rpcError);
    return { ok: false, error: rpcError.code === '23514' ? 'That version is no longer in review.' : 'Could not withdraw the version.' };
  }
  refresh(pack);
  return { ok: true };
}
