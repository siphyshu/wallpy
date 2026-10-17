import { createClient } from '@/lib/supabase/server';
import { blobUrl, fileUrl } from '@/lib/storage';
import { DEFAULT_AVATAR } from '@/lib/data/profile-shape';
import { KIND_LABELS, escapeLike } from '@/lib/data/packs';
import { diffVersions, scheduleSummary, type ReportReason, type VersionDiff } from '@/lib/moderation/review';
import type { AiUse, PackCategory, PackLicense, Schedule } from '@/lib/types';

/** One line of a pack's moderation log. */
export type HistoryEntry = {
  at: string;
  /** username; null when the account is gone */
  actor: string | null;
  action: string;
  version: number | null;
  note: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  submit: 'submitted', approve: 'approved', reject: 'requested changes', decline: 'declined',
  takedown: 'took the pack down', restore: 'restored the pack', withdraw: 'withdrew from review',
};

type Image = { path: string; url: string; small: boolean };

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
  images: Image[];
  slotCount: number;
  packId: string;
  categories: PackCategory[];
  tags: string[];
  /** one line per slot */
  schedule: string[];
  /** for updates: what changes against the live version, with thumbnails of dropped images */
  diff: (VersionDiff & { removedImages: Image[] }) | null;
  history: HistoryEntry[];
};

type FileRow = { path: string; sort_order: number; sha256: string; thumb_sha256: string | null };

function imagesOf(files: FileRow[]): Image[] {
  return [...files].sort((a, b) => a.sort_order - b.sort_order).map((f) => ({
    path: f.path,
    url: blobUrl(f.thumb_sha256 ?? f.sha256)!,
    // Renditions are small WebPs: shown as they are, not through the image optimizer.
    small: Boolean(f.thumb_sha256),
  }));
}

/**
 * Moderation log for packs, newest first: moderation_events (moderators read
 * them all; RLS) plus report dismissals.
 */
export async function listHistory(packIds: string[]): Promise<Map<string, HistoryEntry[]>> {
  const out = new Map<string, HistoryEntry[]>(packIds.map((id) => [id, []]));
  if (!packIds.length) return out;
  const supabase = await createClient();
  const [events, dismissed] = await Promise.all([
    supabase
      .from('moderation_events')
      .select('action, notes, created_at, actor:profiles(username), version:pack_versions!inner(number, pack_id)')
      .in('version.pack_id', packIds)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('pack_reports')
      .select('pack_id, resolved_at, resolver:profiles!pack_reports_resolved_by_fkey(username)')
      .in('pack_id', packIds)
      .eq('status', 'dismissed')
      .limit(500),
  ]);
  if (events.error) console.error('listHistory:', events.error);
  for (const e of events.data ?? []) {
    out.get(e.version.pack_id)?.push({
      at: e.created_at, actor: e.actor?.username ?? null, action: ACTION_LABELS[e.action] ?? e.action,
      version: e.version.number, note: e.notes,
    });
  }
  // Dismissing closes every open report at once: one line per dismissal.
  const groups = new Map<string, { packId: string; at: string; actor: string | null; n: number }>();
  for (const r of dismissed.data ?? []) {
    if (!r.resolved_at) continue;
    const key = `${r.pack_id}|${r.resolved_at}`;
    const g = groups.get(key) ?? { packId: r.pack_id, at: r.resolved_at, actor: r.resolver?.username ?? null, n: 0 };
    g.n++;
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    out.get(g.packId)?.push({
      at: g.at, actor: g.actor, action: `dismissed ${g.n} ${g.n === 1 ? 'report' : 'reports'}`, version: null, note: null,
    });
  }
  for (const list of out.values()) list.sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

/** Versions waiting for review, oldest first. RLS lets only moderators see others' pending versions. */
export async function listPendingVersions(): Promise<PendingVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pack_versions')
    .select(`id, number, title, description, kind, ai_use, license, license_notes, submitted_at, uploader_is_artist, schedule,
             tags, categories,
             artist:artists(name),
             thumb:blobs!pack_versions_thumb_sha256_fkey(sha256),
             files:version_files!version_files_version_id_fkey(path, sort_order, sha256, thumb_sha256),
             pack:packs!pack_versions_pack_id_fkey(id, slug, current_version_id,
               owner:profiles!packs_owner_id_fkey(username, display_name, avatar_key))`)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });
  if (error) {
    console.error('listPendingVersions:', error);
    return [];
  }

  // Live versions of the packs being updated, to diff against.
  const liveIds = data.map((v) => v.pack?.current_version_id).filter((id): id is string => Boolean(id));
  const { data: liveRows } = liveIds.length
    ? await supabase
        .from('pack_versions')
        .select(`id, title, description, tags, categories, license, license_notes, ai_use, schedule,
                 files:version_files!version_files_version_id_fkey(path, sort_order, sha256, thumb_sha256)`)
        .in('id', liveIds)
    : { data: [] };
  const live = new Map((liveRows ?? []).map((l) => [l.id, l]));
  const history = await listHistory([...new Set(data.map((v) => v.pack?.id).filter((id): id is string => Boolean(id)))]);

  return data.map((v) => {
    const owner = v.pack?.owner;
    const ownerName = owner?.display_name || owner?.username || 'unknown';
    const schedule = v.schedule as Schedule | null;
    const images = imagesOf(v.files);
    const before = v.pack?.current_version_id ? live.get(v.pack.current_version_id) : undefined;
    let diff: PendingVersion['diff'] = null;
    if (before) {
      const d = diffVersions(
        {
          title: before.title, description: before.description, categories: before.categories, tags: before.tags,
          license: before.license, licenseNotes: before.license_notes, aiUse: before.ai_use,
          schedule: before.schedule as Schedule | null, files: before.files,
        },
        {
          title: v.title, description: v.description, categories: v.categories, tags: v.tags,
          license: v.license, licenseNotes: v.license_notes, aiUse: v.ai_use, schedule, files: v.files,
        },
      );
      diff = { ...d, removedImages: imagesOf(before.files).filter((i) => d.removed.includes(i.path)) };
    }
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
      packId: v.pack?.id ?? '',
      categories: v.categories,
      tags: v.tags,
      schedule: scheduleSummary(schedule),
      diff,
      history: (v.pack && history.get(v.pack.id)) || [],
    };
  });
}

/** A pack with open reports. */
export type ReportedPack = {
  packId: string;
  slug: string;
  title: string;
  versionId: string | null;
  thumbUrl: string | null;
  owner: string | null;
  removed: boolean;
  reports: { id: number; reason: ReportReason; note: string | null; at: string; reporter: string | null }[];
};

/** Open reports grouped by pack, the most reported first. Moderators only (RLS). */
export async function listOpenReports(): Promise<ReportedPack[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pack_reports')
    .select(`id, reason, note, created_at,
             reporter:profiles!pack_reports_reporter_id_fkey(username),
             pack:packs!pack_reports_pack_id_fkey(id, slug, current_version_id, removed_at,
               owner:profiles!packs_owner_id_fkey(username),
               version:pack_versions!packs_current_version_fkey(title, thumb:blobs!pack_versions_thumb_sha256_fkey(sha256)))`)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) {
    console.error('listOpenReports:', error);
    return [];
  }
  const packs = new Map<string, ReportedPack>();
  for (const r of data) {
    if (!r.pack) continue;
    let entry = packs.get(r.pack.id);
    if (!entry) {
      entry = {
        packId: r.pack.id, slug: r.pack.slug, title: r.pack.version?.title ?? r.pack.slug,
        versionId: r.pack.current_version_id, thumbUrl: blobUrl(r.pack.version?.thumb?.sha256),
        owner: r.pack.owner?.username ?? null, removed: Boolean(r.pack.removed_at), reports: [],
      };
      packs.set(r.pack.id, entry);
    }
    entry.reports.push({ id: r.id, reason: r.reason, note: r.note, at: r.created_at, reporter: r.reporter?.username ?? null });
  }
  return [...packs.values()].sort((a, b) => b.reports.length - a.reports.length);
}

/** A published pack (listed or not, live or taken down, owned or not), for moderators. */
export type PublishedPack = {
  packId: string;
  slug: string;
  title: string;
  versionId: string;
  thumbUrl: string | null;
  owner: string | null;
  isListed: boolean;
  removedAt: string | null;
  removedReason: string | null;
};

export async function searchPublishedPacks(search: string, limit = 30): Promise<PublishedPack[]> {
  const supabase = await createClient();
  let query = supabase
    .from('packs')
    .select(`id, slug, current_version_id, is_listed, removed_at, removed_reason, created_at,
             owner:profiles!packs_owner_id_fkey(username),
             version:pack_versions!packs_current_version_fkey!inner(title, thumb:blobs!pack_versions_thumb_sha256_fkey(sha256))`)
    .not('current_version_id', 'is', null);
  const q = search.trim().slice(0, 80);
  if (q) query = query.ilike('version.title', `%${escapeLike(q)}%`);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) {
    console.error('searchPublishedPacks:', error);
    return [];
  }
  return data.map((p) => ({
    packId: p.id, slug: p.slug, title: p.version.title, versionId: p.current_version_id!,
    thumbUrl: blobUrl(p.version.thumb?.sha256), owner: p.owner?.username ?? null,
    isListed: p.is_listed, removedAt: p.removed_at, removedReason: p.removed_reason,
  }));
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
