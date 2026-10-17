import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

export type NoticeAction = 'approve' | 'reject' | 'decline' | 'takedown' | 'restore';

export type Notice = {
  id: number;
  packId: string;
  slug: string;
  title: string;
  action: NoticeAction;
  notes: string | null;
  at: string;
};

/** Owner-facing label for a notice (moderator-facing wording lives in lib/data/moderation.ts). */
export const NOTICE_LABELS: Record<NoticeAction, string> = {
  approve: 'Approved',
  reject: 'Changes requested',
  decline: 'Declined',
  takedown: 'Taken down',
  restore: 'Restored',
};

export const NOTICE_PILL: Record<NoticeAction, string> = {
  approve: 'bg-green-500/20 text-green-300 border-green-500/30',
  restore: 'bg-green-500/20 text-green-300 border-green-500/30',
  reject: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
  decline: 'bg-red-500/20 text-red-300 border-red-500/30',
  takedown: 'bg-red-500/20 text-red-300 border-red-500/30',
};

type NoticeRow = Database['public']['Functions']['my_notices']['Returns'][number];

/**
 * The signed-in owner's own review events, newest first: approved, changes
 * requested, declined, taken down, restored. `my_notices()` (security definer)
 * keeps this to the caller's own packs and never names the moderator.
 */
export async function listMyNotices(): Promise<Notice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_notices');
  if (error) {
    console.error('listMyNotices:', error);
    return [];
  }
  return (data ?? []).map((n: NoticeRow) => ({
    id: n.id,
    packId: n.pack_id,
    slug: n.slug,
    title: n.title,
    action: n.action as NoticeAction,
    notes: n.notes,
    at: n.created_at,
  }));
}

/** Marks every notice as read for the given (already-authenticated) user. */
export async function markNoticesSeen(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ notices_seen_at: new Date().toISOString() }).eq('id', userId);
  if (error) console.error('markNoticesSeen:', error);
}
