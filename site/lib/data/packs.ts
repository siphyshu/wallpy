import { createClient } from '@/lib/supabase/server';
import { blobUrl, fileUrl } from '@/lib/storage';
import { DEFAULT_AVATAR } from '@/lib/data/profile-shape';
import type { AiUse, Credit, PackCard, PackDetail, PackFile, PackKind, Schedule, VersionStatus } from '@/lib/types';

// Read side of the pack data model (docs/schema-design.md). Row level security
// decides what each viewer may see; these helpers only shape the results.

const OWNER = 'owner:profiles!packs_owner_id_fkey(username, display_name, avatar_key)';
const VERSION_SUMMARY = `
  id, number, status, title, kind, tags, uploader_is_artist, ai_use,
  artist:artists(name, url, avatar_key),
  thumb:blobs!pack_versions_thumb_sha256_fkey(sha256, blurhash)`;
const PACK_COLUMNS = 'id, slug, current_version_id, is_listed, removed_at, download_count, favourite_count, created_at';

export const KIND_LABELS: Record<PackKind, string> = { timeblocks: 'Daypack', days: 'Weekpack', album: 'Album' };

export type PackSort = 'newest' | 'popular' | 'rating';
const SORT_COLUMNS = { newest: 'created_at', popular: 'download_count', rating: 'favourite_count' } as const;

type OwnerRow = { username: string; display_name: string | null; avatar_key: string | null } | null;
type ArtistRow = { name: string; url: string | null; avatar_key: string | null } | null;
type VersionSummaryRow = {
  id: string;
  number: number;
  status: VersionStatus;
  title: string;
  kind: PackKind | null;
  tags: string[];
  uploader_is_artist: boolean;
  ai_use: AiUse | null;
  artist: ArtistRow;
  thumb: { sha256: string; blurhash: string | null } | null;
};
type PackRow = {
  id: string;
  slug: string;
  current_version_id: string | null;
  is_listed: boolean;
  removed_at: string | null;
  download_count: number;
  favourite_count: number;
  created_at: string;
  owner: OwnerRow;
};

/** Who gets the credit: the uploader if they made it, else the credited artist. */
function credit(version: Pick<VersionSummaryRow, 'uploader_is_artist' | 'artist'> | null | undefined, owner: OwnerRow): Credit {
  if (version?.uploader_is_artist && owner) {
    return {
      name: owner.display_name || owner.username,
      url: `/profile/${owner.username}`,
      avatar: fileUrl(owner.avatar_key) || DEFAULT_AVATAR,
      internal: true,
    };
  }
  if (version?.artist) {
    return {
      name: version.artist.name,
      url: version.artist.url,
      avatar: fileUrl(version.artist.avatar_key) || DEFAULT_AVATAR,
      internal: false,
    };
  }
  return { name: 'Unknown artist', url: null, avatar: DEFAULT_AVATAR, internal: false };
}

/** A pack row (with owner + one version) -> what GalleryCard renders. */
function toCard(pack: PackRow, version: VersionSummaryRow | null | undefined): PackCard {
  const c = credit(version, pack.owner);
  return {
    id: pack.id,
    slug: pack.slug,
    name: version?.title ?? pack.slug,
    url: `/packs/${pack.slug}`,
    preview: blobUrl(version?.thumb?.sha256) || '/wallpapers/day.jpg',
    blurhash: version?.thumb?.blurhash ?? null,
    author: c.name,
    author_url: c.url,
    author_profile: c.avatar,
    downloads: pack.download_count,
    favourites: pack.favourite_count,
    createdAt: pack.created_at,
    category: version?.kind ?? null,
    kindLabel: version?.kind ? KIND_LABELS[version.kind] : 'Pack',
    aiUse: version?.ai_use ?? null,
    status: version?.status ?? null,
    isPublic: Boolean(pack.current_version_id && pack.is_listed && !pack.removed_at),
  };
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Gallery: public packs only, filtered and paginated in the database. */
export async function listPublicPacks({ search, tag, kind, hideAi = false, sort = 'newest', limit = 9, offset = 0 }: {
  search?: string;
  /** only packs made without AI */
  hideAi?: boolean;
  tag?: string;
  kind?: PackKind;
  sort?: PackSort;
  limit?: number;
  offset?: number;
} = {}): Promise<{ packs: PackCard[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from('packs')
    .select(`${PACK_COLUMNS}, ${OWNER}, version:pack_versions!packs_current_version_fkey!inner(${VERSION_SUMMARY})`, {
      count: 'exact',
    })
    .not('current_version_id', 'is', null)
    .eq('is_listed', true)
    .is('removed_at', null);

  if (search) query = query.ilike('version.title', `%${escapeLike(search.slice(0, 80))}%`);
  if (tag) query = query.contains('version.tags', [tag]);
  if (kind) query = query.eq('version.kind', kind);
  if (hideAi) query = query.eq('version.ai_use', 'none');

  query = query.order(SORT_COLUMNS[sort], { ascending: false }).order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) {
    console.error('listPublicPacks:', error);
    throw new Error('Failed to load packs');
  }
  return { packs: data.map((p) => toCard(p, p.version)), total: count ?? 0 };
}

/**
 * Packs owned by a user. Everyone sees the public ones; the owner (and
 * moderators) also see drafts and pending ones, because RLS lets them.
 */
export async function listPacksByOwner(ownerId: string): Promise<PackCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('packs')
    .select(`${PACK_COLUMNS}, ${OWNER}, versions:pack_versions!pack_versions_pack_id_fkey(${VERSION_SUMMARY})`)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    ;
  if (error) {
    console.error('listPacksByOwner:', error);
    return [];
  }
  return data.map((p) => {
    const versions = [...p.versions].sort((a, b) => b.number - a.number);
    const shown = versions.find((v) => v.id === p.current_version_id) ?? versions[0];
    // Only owners and moderators can see versions that aren't public.
    const newest = versions[0]?.status;
    const review = newest === 'rejected' && p.removed_at && !p.current_version_id ? 'declined'
      : newest === 'pending' || newest === 'rejected' ? newest : undefined;
    return { ...toCard(p, shown), ...(review ? { review } : {}) };
  });
}

/** The signed-in user's favourites (private to them by RLS). */
export async function listMyFavourites(): Promise<PackCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('favourites')
    .select(
      `created_at, pack:packs(${PACK_COLUMNS}, ${OWNER}, version:pack_versions!packs_current_version_fkey(${VERSION_SUMMARY}))`,
    )
    .order('created_at', { ascending: false })
    ;
  if (error) {
    console.error('listMyFavourites:', error);
    return [];
  }
  return data.flatMap((f) => (f.pack?.version ? [toCard(f.pack, f.pack.version)] : []));
}

/**
 * Full pack page data. Visitors get the current approved version; the owner
 * and moderators get the newest version (it may be a draft or pending).
 */
export async function getPackBySlug(slug: string): Promise<PackDetail | null> {
  const supabase = await createClient();
  const { data: pack, error } = await supabase
    .from('packs')
    .select(`${PACK_COLUMNS}, owner_id, removed_reason, ${OWNER}`)
    .eq('slug', slug)
    .maybeSingle()
    ;
  if (error) console.error('getPackBySlug:', error);
  if (!pack) return null;

  let versionQuery = supabase
    .from('pack_versions')
    .select(`${VERSION_SUMMARY}, description, schedule, license, license_notes, created_at, cover_file_id,
             preview:blobs!pack_versions_preview_sha256_fkey(sha256, blurhash),
             files:version_files!version_files_version_id_fkey(id, path, sort_order, thumb_sha256, preview_sha256,
               blob:blobs!version_files_sha256_fkey(sha256, size, width, height, blurhash))`)
    .eq('pack_id', pack.id);
  versionQuery = pack.current_version_id
    ? versionQuery.eq('id', pack.current_version_id)
    : versionQuery.order('number', { ascending: false }).limit(1);
  const { data: version, error: vError } = await versionQuery
    .maybeSingle()
    ;
  if (vError) console.error('getPackBySlug version:', vError);
  if (!version) return null;

  const files: PackFile[] = [...version.files]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((f) =>
      f.blob
        ? [{
            id: f.id,
            path: f.path,
            sha256: f.blob.sha256,
            size: f.blob.size,
            width: f.blob.width,
            height: f.blob.height,
            blurhash: f.blob.blurhash,
            url: blobUrl(f.blob.sha256)!,
            thumbUrl: blobUrl(f.thumb_sha256) ?? blobUrl(f.blob.sha256)!,
            previewUrl: blobUrl(f.preview_sha256) ?? blobUrl(f.blob.sha256)!,
          }]
        : [],
    );
  const cover = files.find((f) => f.id === version.cover_file_id) ?? files[0];

  return {
    ...toCard(pack, version),
    ownerId: pack.owner_id,
    owner: pack.owner,
    removedAt: pack.removed_at,
    removedReason: pack.removed_reason,
    version: {
      id: version.id,
      number: version.number,
      status: version.status,
      title: version.title,
      description: version.description,
      tags: version.tags,
      kind: version.kind ?? 'timeblocks',
      // jsonb in the database; its shape is enforced on write by the
      // schedule_shape_ok() check constraint and spec/schedule.schema.json.
      schedule: version.schedule as Schedule,
      license: version.license,
      aiUse: version.ai_use,
      licenseNotes: version.license_notes,
      createdAt: version.created_at,
    },
    credit: credit(version, pack.owner),
    previewUrl: blobUrl(version.preview?.sha256) ?? cover?.url ?? null,
    previewBlurhash: version.preview?.blurhash ?? cover?.blurhash ?? null,
    cover,
    files,
  };
}
