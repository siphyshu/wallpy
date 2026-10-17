import { createClient } from '@/lib/supabase/server';
import { blobUrl } from '@/lib/storage';
import { latestRejectionNotes } from '@/lib/data/moderation';
import type { AiUse, PackKind, PackLicense, Schedule, VersionStatus } from '@/lib/types';

/** The newest version of a pack, as its owner sees it. */
export type LatestVersion = { id: string; number: number; status: VersionStatus; notes: string | null };

/** What the edit page needs: the version to start from, and its images. */
export type EditablePack = {
  slug: string;
  isPublic: boolean;
  removed: boolean;
  latest: LatestVersion;
  /** Versions in review are frozen: nothing can be submitted until it's decided. */
  canSubmit: boolean;
  base: {
    number: number;
    title: string;
    description: string;
    tags: string[];
    kind: PackKind;
    schedule: Schedule;
    license: PackLicense;
    aiUse: AiUse | null;
    uploaderIsArtist: boolean;
    artist: { name: string; url: string } | null;
    coverSha256: string | null;
    thumbSha256: string | null;
    previewSha256: string | null;
    /** `previewUrl` is the 1920px rendition when the file has one, else the original */
    files: { path: string; sha256: string; size: number; mime: string; url: string; previewUrl: string;
             thumbSha256: string | null; previewSha256: string | null }[];
  };
};

/** Newest version of a pack the caller owns (RLS shows owners all their versions). */
export async function latestVersion(packId: string): Promise<LatestVersion | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pack_versions')
    .select('id, number, status')
    .eq('pack_id', packId)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { ...data, notes: data.status === 'rejected' ? await latestRejectionNotes(data.id) : null };
}

/**
 * A pack its owner wants to change. Changes after a rejection start from the
 * rejected version; updates to a published pack start from the current one.
 * null unless the signed-in user owns the pack.
 */
export async function getPackForEditing(slug: string): Promise<EditablePack | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: pack } = await supabase
    .from('packs')
    .select('id, slug, owner_id, current_version_id, is_listed, removed_at')
    .eq('slug', slug)
    .maybeSingle();
  if (!pack || pack.owner_id !== user.id) return null;

  const latest = await latestVersion(pack.id);
  if (!latest) return null;
  const baseId = latest.status === 'rejected' || latest.status === 'draft' || !pack.current_version_id
    ? latest.id
    : pack.current_version_id;

  const { data: v, error } = await supabase
    .from('pack_versions')
    .select(`number, title, description, tags, kind, schedule, license, ai_use, uploader_is_artist,
             thumb_sha256, preview_sha256, cover_file_id,
             artist:artists(name, url),
             files:version_files!version_files_version_id_fkey(id, path, sort_order, thumb_sha256, preview_sha256,
               blob:blobs!version_files_sha256_fkey(sha256, size, mime))`)
    .eq('id', baseId)
    .single();
  if (error || !v) {
    console.error('getPackForEditing:', error);
    return null;
  }
  const files = [...v.files].sort((a, b) => a.sort_order - b.sort_order);
  return {
    slug: pack.slug,
    isPublic: Boolean(pack.current_version_id && pack.is_listed && !pack.removed_at),
    removed: Boolean(pack.removed_at),
    latest,
    canSubmit: latest.status !== 'pending' && !pack.removed_at,
    base: {
      number: v.number,
      title: v.title,
      description: v.description ?? '',
      tags: v.tags,
      kind: v.kind ?? 'timeblocks',
      schedule: v.schedule as Schedule,
      license: v.license,
      aiUse: v.ai_use,
      uploaderIsArtist: v.uploader_is_artist,
      artist: v.artist ? { name: v.artist.name, url: v.artist.url ?? '' } : null,
      coverSha256: files.find((f) => f.id === v.cover_file_id)?.blob?.sha256 ?? null,
      thumbSha256: v.thumb_sha256,
      previewSha256: v.preview_sha256,
      files: files.flatMap((f) => (f.blob
        ? [{
            path: f.path, sha256: f.blob.sha256, size: f.blob.size, mime: f.blob.mime, url: blobUrl(f.blob.sha256)!,
            previewUrl: blobUrl(f.preview_sha256) ?? blobUrl(f.blob.sha256)!,
            thumbSha256: f.thumb_sha256, previewSha256: f.preview_sha256,
          }]
        : [])),
    },
  };
}
