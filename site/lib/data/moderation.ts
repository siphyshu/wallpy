import { createClient } from '@/lib/supabase/server';
import { blobUrl, fileUrl } from '@/lib/storage';
import { DEFAULT_AVATAR } from '@/lib/data/profile-shape';
import { KIND_LABELS } from '@/lib/data/packs';
import type { AiUse, PackLicense } from '@/lib/types';

export type PendingVersion = {
  versionId: string;
  number: number;
  title: string;
  description: string | null;
  kindLabel: string;
  aiUse: AiUse | null;
  license: PackLicense;
  submittedAt: string | null;
  slug: string;
  /** true when this replaces an already published version */
  isUpdate: boolean;
  uploader: { username: string; name: string; avatar: string };
  credit: string;
  thumbUrl: string | null;
  /** `url` is the thumbnail when the file has one (`small`), else the original */
  images: { path: string; url: string; small: boolean }[];
  slotCount: number;
};

/** Versions waiting for review, oldest first. RLS lets only moderators see others' pending versions. */
export async function listPendingVersions(): Promise<PendingVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pack_versions')
    .select(`id, number, title, description, kind, ai_use, license, submitted_at, uploader_is_artist, schedule,
             artist:artists(name),
             thumb:blobs!pack_versions_thumb_sha256_fkey(sha256),
             files:version_files!version_files_version_id_fkey(path, sort_order, sha256, thumb_sha256),
             pack:packs!pack_versions_pack_id_fkey(slug, current_version_id,
               owner:profiles!packs_owner_id_fkey(username, display_name, avatar_key))`)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });
  if (error) {
    console.error('listPendingVersions:', error);
    return [];
  }
  return data.map((v) => {
    const owner = v.pack?.owner;
    const ownerName = owner?.display_name || owner?.username || 'unknown';
    const schedule = v.schedule as { slot?: unknown[] } | null;
    const images = [...v.files].sort((a, b) => a.sort_order - b.sort_order).map((f) => ({
      path: f.path,
      url: blobUrl(f.thumb_sha256 ?? f.sha256)!,
      // Renditions are small WebPs: shown as they are, not through the image optimizer.
      small: Boolean(f.thumb_sha256),
    }));
    return {
      versionId: v.id,
      number: v.number,
      title: v.title,
      description: v.description,
      kindLabel: v.kind ? KIND_LABELS[v.kind] : 'Pack',
      aiUse: v.ai_use,
      license: v.license,
      submittedAt: v.submitted_at,
      slug: v.pack?.slug ?? '',
      isUpdate: Boolean(v.pack?.current_version_id),
      uploader: {
        username: owner?.username ?? '',
        name: ownerName,
        avatar: fileUrl(owner?.avatar_key) || DEFAULT_AVATAR,
      },
      credit: v.uploader_is_artist ? `${ownerName} (uploader)` : v.artist?.name ?? 'Unknown artist',
      images,
      // Uploads made through the site always include a thumbnail; fall back to the first image.
      thumbUrl: blobUrl(v.thumb?.sha256) ?? images[0]?.url ?? null,
      slotCount: schedule?.slot?.length ?? 0,
    };
  });
}

/** Notes from the latest rejection of a version (owners see their own). */
export async function latestRejectionNotes(versionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('moderation_events')
    .select('notes')
    .eq('version_id', versionId)
    .eq('action', 'reject')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.notes ?? null;
}
