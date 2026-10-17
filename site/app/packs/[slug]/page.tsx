import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/footer';
import PackView from '@/components/packs/PackView';
import DownloadZipButton from '@/components/packs/DownloadZipButton';
import InstallCommand from '@/components/packs/InstallCommand';
import FavouriteButton from '@/components/packs/FavouriteButton';
import AiUseLabel from '@/components/packs/AiUseLabel';
import PackOwnerControls from '@/components/packs/PackOwnerControls';
import { getPackBySlug } from '@/lib/data/packs';
import { categoryName } from '@/lib/packs/categories';
import { latestVersion } from '@/lib/data/editing';
import { createClient } from '@/lib/supabase/server';
import type { PackLicense, VersionStatus } from '@/lib/types';

const LICENSES: Record<PackLicense, string> = {
  'personal-use': 'Personal use only',
  'cc-by-4.0': 'CC BY 4.0',
  'cc-by-nc-4.0': 'CC BY-NC 4.0',
  cc0: 'CC0 (public domain)',
  other: 'Other',
};

const STATUS_NOTES: Partial<Record<VersionStatus, string>> = {
  draft: 'This is a draft. Only you can see it until you submit it for review.',
  pending: 'Waiting for review. Only you and moderators can see it for now.',
  rejected: 'This version was rejected. Submit a new version to try again.',
};

/** What the owner is told about their pack, and what they can do next. */
function ownerNotice(
  pack: { isPublic: boolean; isListed: boolean; removedAt: string | null; removedReason: string | null; version: { id: string; number: number; status: VersionStatus } },
  latest: { id: string; number: number; status: VersionStatus; notes: string | null } | null,
): { text: string; action?: 'edit'; actionLabel?: string } | null {
  if (pack.removedAt) {
    // Closed before it was ever published: declined in review.
    return pack.version.status === 'rejected'
      ? { text: `Declined by a moderator: "${pack.removedReason || 'no reason given'}" This pack can't be resubmitted.` }
      : { text: `Taken down by a moderator: ${pack.removedReason || 'no reason given'}.` };
  }
  if (!latest) return null;
  const isUpdate = latest.id !== pack.version.id;
  if (latest.status === 'rejected') {
    const why = latest.notes ? ` "${latest.notes}"` : '';
    return {
      text: isUpdate
        ? `Changes requested on version ${latest.number}:${why} Version ${pack.version.number} is still live.`
        : `Changes requested:${why}`,
      action: 'edit',
    };
  }
  if (latest.status === 'pending' && isUpdate) {
    return { text: `Version ${latest.number} is waiting for review. Version ${pack.version.number} stays live until it's approved.` };
  }
  if (latest.status === 'draft') {
    return {
      text: isUpdate
        ? `Version ${latest.number} is a draft (withdrawn from review). Version ${pack.version.number} is still live.`
        : STATUS_NOTES.draft!,
      action: 'edit',
      actionLabel: 'Edit and submit',
    };
  }
  if (!pack.isPublic) return STATUS_NOTES[latest.status] ? { text: STATUS_NOTES[latest.status]! } : null;
  if (!pack.isListed) {
    return { text: 'Unlisted: hidden from the gallery, search and your profile. Anyone with the link can still see and install it.' };
  }
  return null;
}

export async function generateMetadata({ params }: PageProps<'/packs/[slug]'>) {
  const pack = await getPackBySlug((await params).slug);
  if (!pack) return { title: 'Pack not found | Wallpy' };
  return {
    title: `${pack.name} by ${pack.credit.name} | Wallpy`,
    description: pack.version.description || `A ${pack.kindLabel.toLowerCase()} for Wallpy.`,
    // Unlisted packs work by link but stay out of search engines too.
    ...(pack.isListed ? {} : { robots: { index: false } }),
  };
}

export default async function PackPage({ params }: PageProps<'/packs/[slug]'>) {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let favourited = false;
  if (user) {
    const { data } = await supabase.from('favourites').select('pack_id').eq('pack_id', pack.id).maybeSingle();
    favourited = Boolean(data);
  }

  const { version, credit } = pack;
  const isOwner = user?.id === pack.ownerId;
  const latest = isOwner ? await latestVersion(pack.id) : null;
  const notice = isOwner
    ? ownerNotice(pack, latest)
    : !pack.isPublic && pack.removedAt
      ? { text: `Taken down by a moderator: ${pack.removedReason || 'no reason given'}.` }
      : !pack.isPublic ? { text: STATUS_NOTES[version.status] ?? '' } : null;
  // Owners can send a new version unless one is already in review.
  const canUpdate = isOwner && !pack.removedAt && latest?.status === 'approved';

  return (
    <div className="min-h-screen bg-background/80 text-white mt-20">
      <div className="max-w-7xl mx-auto px-6 py-24">
        {notice?.text && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            <p className="flex-1">{notice.text}</p>
            {notice.action === 'edit' && (
              <Link
                href={`/packs/${pack.slug}/edit`}
                className="shrink-0 self-start sm:self-auto px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
              >
                {notice.actionLabel ?? 'Make changes'}
              </Link>
            )}
          </div>
        )}
        <PackView files={pack.files} schedule={version.schedule} kind={version.kind} details={
          <div className="md:w-1/3">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-4xl font-serif">{version.title}</h1>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                {pack.kindLabel}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-white/80 text-sm">by</span>
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/20">
                <Image src={credit.avatar} alt="" fill sizes="24px" className="object-cover" />
              </div>
              {credit.url ? (
                credit.internal ? (
                  <Link href={credit.url} className="text-white/80 hover:text-white transition-colors text-sm">
                    {credit.name}
                  </Link>
                ) : (
                  <a href={credit.url} target="_blank" rel="noopener noreferrer"
                     className="text-white/80 hover:text-white transition-colors text-sm">
                    {credit.name}
                  </a>
                )
              ) : (
                <span className="text-white/80 text-sm">{credit.name}</span>
              )}
              {!credit.internal && pack.owner && (
                <span className="text-white/50 text-sm">
                  · shared by <Link href={`/profile/${pack.owner.username}`} className="hover:text-white">@{pack.owner.username}</Link>
                </span>
              )}
            </div>

            {version.description && <p className="prose text-white/80 mb-4">{version.description}</p>}

            {(version.categories.length > 0 || version.tags.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {version.categories.map((c) => (
                  <Link key={c} href={`/gallery?category=${c}`} className="px-3 py-1 border border-white/20 bg-white/5 rounded-full text-sm hover:bg-white/10">
                    {categoryName(c)}
                  </Link>
                ))}
                {version.tags.map((tag) => (
                  <Link key={tag} href={`/gallery?tag=${tag}`} className="px-2 py-1 bg-white/10 rounded-full text-sm hover:bg-white/20">
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 mb-2 text-sm text-white/60">
              {pack.downloads > 0 && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  {pack.downloads} {pack.downloads === 1 ? 'download' : 'downloads'}
                </span>
              )}
              <FavouriteButton packId={pack.id} initialFavourited={favourited} initialCount={pack.favourites} signedIn={Boolean(user)} />
              <span>{pack.files.length} images</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-8">
              <AiUseLabel aiUse={version.aiUse} />
              <p className="text-xs text-white/50">
                {LICENSES[version.license]}{version.licenseNotes ? ` · ${version.licenseNotes}` : ''} · v{version.number}
              </p>
            </div>

            {pack.isPublic && (
              <div className="flex flex-col gap-2">
                <InstallCommand slug={pack.slug} />
                <DownloadZipButton slug={pack.slug} />
                <Link href="/#install" className="text-xs text-white/50 hover:text-white mt-1">
                  Don&apos;t have Wallpy yet? Install it first.
                </Link>
              </div>
            )}

            {isOwner && (
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-4" data-testid="manage-pack">
                {canUpdate && (
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/packs/${pack.slug}/edit`}
                      className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white/80 text-center"
                    >
                      Upload a new version
                    </Link>
                    <p className="text-xs text-white/50">
                      Change images, the schedule or details. Version {version.number} stays live until the new one is approved.
                    </p>
                  </div>
                )}
                <PackOwnerControls
                  variant="page"
                  packId={pack.id}
                  slug={pack.slug}
                  name={version.title}
                  published={pack.isPublic}
                  listed={pack.isListed}
                  pendingVersionId={latest?.status === 'pending' ? latest.id : undefined}
                  afterDelete={pack.owner ? `/profile/${pack.owner.username}` : '/'}
                />
              </div>
            )}
          </div>
        } />
      </div>
      <Footer />
    </div>
  );
}
