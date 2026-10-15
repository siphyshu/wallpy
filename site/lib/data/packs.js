import { createClient } from '@/lib/supabase/server';
import { blobUrl, fileUrl } from '@/lib/storage';
import { DEFAULT_AVATAR } from '@/lib/data/profile-shape';

// Read side of the pack data model (docs/schema-design.md). Row level security
// decides what each viewer may see; these helpers only shape the results.

const OWNER = 'owner:profiles!packs_owner_id_fkey(username, display_name, avatar_key)';
const VERSION_SUMMARY = `
  id, number, status, title, kind, tags, uploader_is_artist,
  artist:artists(name, url, avatar_key),
  thumb:blobs!pack_versions_thumb_sha256_fkey(sha256, blurhash)`;

const SORTS = {
  newest: { column: 'created_at' },
  popular: { column: 'download_count' },
  rating: { column: 'favourite_count' },
};

export const KIND_LABELS = { timeblocks: 'Daypack', days: 'Weekpack', album: 'Album' };

/** Who gets the credit: the uploader if they made it, else the credited artist. */
function credit(version, owner) {
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
function toCard(pack, version) {
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
    kindLabel: KIND_LABELS[version?.kind] ?? 'Pack',
    status: version?.status ?? null,
    isPublic: Boolean(pack.current_version_id && pack.is_listed && !pack.removed_at),
  };
}

function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Gallery: public packs only, filtered and paginated in the database. */
export async function listPublicPacks({ search, tag, kind, sort = 'newest', limit = 9, offset = 0 } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from('packs')
    .select(
      `id, slug, current_version_id, is_listed, removed_at, download_count, favourite_count, created_at, ${OWNER},
       version:pack_versions!packs_current_version_fkey!inner(${VERSION_SUMMARY})`,
      { count: 'exact' },
    )
    .not('current_version_id', 'is', null)
    .eq('is_listed', true)
    .is('removed_at', null);

  if (search) query = query.ilike('version.title', `%${escapeLike(search.slice(0, 80))}%`);
  if (tag) query = query.contains('version.tags', [tag]);
  if (kind) query = query.eq('version.kind', kind);

  const { column } = SORTS[sort] ?? SORTS.newest;
  query = query.order(column, { ascending: false }).order('created_at', { ascending: false });

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
export async function listPacksByOwner(ownerId) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('packs')
    .select(
      `id, slug, current_version_id, is_listed, removed_at, download_count, favourite_count, created_at, ${OWNER},
       versions:pack_versions!pack_versions_pack_id_fkey(${VERSION_SUMMARY})`,
    )
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('listPacksByOwner:', error);
    return [];
  }
  return data.map((p) => {
    const versions = [...(p.versions ?? [])].sort((a, b) => b.number - a.number);
    const shown = versions.find((v) => v.id === p.current_version_id) ?? versions[0];
    return toCard(p, shown);
  });
}

/** The signed-in user's favourites (private to them by RLS). */
export async function listMyFavourites() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('favourites')
    .select(
      `created_at, pack:packs(id, slug, current_version_id, is_listed, removed_at, download_count, favourite_count, created_at, ${OWNER},
       version:pack_versions!packs_current_version_fkey(${VERSION_SUMMARY}))`,
    )
    .order('created_at', { ascending: false });
  if (error) {
    console.error('listMyFavourites:', error);
    return [];
  }
  return data.filter((f) => f.pack?.version).map((f) => toCard(f.pack, f.pack.version));
}

/**
 * Full pack page data. Visitors get the current approved version; the owner
 * and moderators get the newest version (it may be a draft or pending).
 */
export async function getPackBySlug(slug) {
  const supabase = await createClient();
  const { data: pack, error } = await supabase
    .from('packs')
    .select(`id, slug, owner_id, current_version_id, is_listed, removed_at, removed_reason,
             download_count, favourite_count, created_at, ${OWNER}`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) console.error('getPackBySlug:', error);
  if (!pack) return null;

  let versionQuery = supabase
    .from('pack_versions')
    .select(`id, number, status, title, description, tags, kind, schedule, license, license_notes,
             uploader_is_artist, created_at, submitted_at, cover_file_id,
             artist:artists(name, url, avatar_key),
             preview:blobs!pack_versions_preview_sha256_fkey(sha256, blurhash, width, height),
             thumb:blobs!pack_versions_thumb_sha256_fkey(sha256, blurhash),
             files:version_files!version_files_version_id_fkey(id, path, sort_order, blob:blobs(sha256, size, mime, width, height, blurhash))`)
    .eq('pack_id', pack.id);
  versionQuery = pack.current_version_id
    ? versionQuery.eq('id', pack.current_version_id)
    : versionQuery.order('number', { ascending: false }).limit(1);
  const { data: version, error: vError } = await versionQuery.maybeSingle();
  if (vError) console.error('getPackBySlug version:', vError);
  if (!version) return null;

  const files = [...(version.files ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => ({
      id: f.id,
      path: f.path,
      sha256: f.blob?.sha256,
      size: f.blob?.size,
      width: f.blob?.width,
      height: f.blob?.height,
      blurhash: f.blob?.blurhash,
      url: blobUrl(f.blob?.sha256),
    }));
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
      tags: version.tags ?? [],
      kind: version.kind,
      schedule: version.schedule,
      license: version.license,
      licenseNotes: version.license_notes,
      createdAt: version.created_at,
    },
    credit: credit(version, pack.owner),
    previewUrl: blobUrl(version.preview?.sha256) || cover?.url,
    previewBlurhash: version.preview?.blurhash ?? cover?.blurhash ?? null,
    cover,
    files,
  };
}
