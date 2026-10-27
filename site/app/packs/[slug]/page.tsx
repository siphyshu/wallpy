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
import ReportPackButton from '@/components/packs/ReportPackButton';
import PackModActions from '@/components/moderation/PackModActions';
import ModerationHistory from '@/components/moderation/ModerationHistory';
import { listHistory } from '@/lib/data/moderation';
import { getPackBySlug } from '@/lib/data/packs';
import { categoryName } from '@/lib/packs/categories';
import { latestVersion } from '@/lib/data/editing';
import { createClient } from '@/lib/supabase/server';
import { Page } from '@/components/ui/page';
import { Notice } from '@/components/ui/notice';
import { Pill, pillClasses } from '@/components/ui/pill';
import { buttonVariants } from '@/components/ui/button';
import type { PackKind, PackLicense, VersionStatus } from '@/lib/types';

const LICENSES: Record<PackLicense, string> = {
  'personal-use': 'Personal use only',
  'cc-by-4.0': 'CC BY 4.0',
  'cc-by-nc-4.0': 'CC BY-NC 4.0',
  cc0: 'CC0 (public domain)',
  other: 'Other',
};

/** How each kind of pack changes, for the meta description. */
const CHANGES: Record<PackKind, string> = {
  timeblocks: 'change with the time of day',
  days: 'change with the day of the week',
  album: 'take turns on a timer',
};

/** What happens after a version is submitted; owners see it while they wait. */
const REVIEW_NEXT = "A moderator will check it, and you'll get a notice when it's approved or sent back with a note.";

const STATUS_NOTES: Partial<Record<VersionStatus, string>> = {
  draft: 'This is a draft. Only you can see it until you submit it for review.',
  pending: 'Waiting for review. Only you and moderators can see it for now.',
  rejected: 'This version was rejected. Submit a new version to try again.',
};

/** Takedowns are final; the owner can still ask why. */
const TAKEDOWN_HELP = (
  <>
    {' '}Takedowns are final. Questions?{' '}
    <a href="https://github.com/siphyshu/wallpy/issues" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">Open an issue</a>
    {' '}or email <a href="mailto:siphyshu@gmail.com" className="underline underline-offset-2 hover:text-white">siphyshu@gmail.com</a>.
  </>
);

/** A moderator's note as a sentence: adds a full stop unless it already ends in one. */
const sentence = (text: string) => (/[.!?]["')\]]?$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** What the owner is told about their pack, and what they can do next. */
function ownerNotice(
  pack: { isPublic: boolean; isListed: boolean; removedAt: string | null; removedReason: string | null; version: { id: string; number: number; status: VersionStatus } },
  latest: { id: string; number: number; status: VersionStatus; notes: string | null } | null,
): { text: string; action?: 'edit'; actionLabel?: string; takedown?: boolean } | null {
  if (pack.removedAt) {
    // Closed before it was ever published: declined in review.
    return pack.version.status === 'rejected'
      ? { text: `Declined by a moderator: "${pack.removedReason || 'no reason given'}" This pack can't be resubmitted.` }
      : { text: `Taken down by a moderator: ${sentence(pack.removedReason || 'no reason given')}`, takedown: true };
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
    return { text: `Version ${latest.number} is waiting for review. ${REVIEW_NEXT} Version ${pack.version.number} stays live until then.` };
  }
  if (latest.status === 'pending') {
    return { text: `Waiting for review. ${REVIEW_NEXT} Until it's approved, only you and moderators can see it.` };
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
  const title = `${pack.name} by ${pack.credit.name}`;
  const n = pack.files.length;
  const description = pack.version.description?.trim() ||
    `${pack.kindLabel} by ${pack.credit.name}: ${n} ${n === 1 ? 'wallpaper' : 'wallpapers'} that ${CHANGES[pack.version.kind]}. Free for macOS, Windows and Linux with Wallpy.`;
  return {
    title: `${title} | Wallpy`,
    description,
    alternates: { canonical: `/packs/${pack.slug}` },
    // The image comes from opengraph-image.tsx next to this page.
    openGraph: { title, description, url: `/packs/${pack.slug}` },
    // Unlisted packs work by link but stay out of search engines too; so do
    // drafts and packs in review, which only their owner and moderators see.
    ...(pack.isListed && pack.isPublic ? {} : { robots: { index: false } }),
  };
}

export default async function PackPage({ params }: PageProps<'/packs/[slug]'>) {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let favourited = false;
  let reported = false;
  let isModerator = false;
  if (user) {
    const [fav, report, me] = await Promise.all([
      supabase.from('favourites').select('pack_id').eq('pack_id', pack.id).maybeSingle(),
      // RLS: a visitor reads only their own reports.
      supabase.from('pack_reports').select('id').eq('pack_id', pack.id).eq('reporter_id', user.id).eq('status', 'open').limit(1),
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    ]);
    favourited = Boolean(fav.data);
    reported = Boolean(report.data?.length);
    isModerator = me.data?.role === 'moderator' || me.data?.role === 'admin';
  }
  const history = isModerator ? (await listHistory([pack.id])).get(pack.id) ?? [] : [];

  const { version, credit } = pack;
  const isOwner = user?.id === pack.ownerId;
  const latest = isOwner ? await latestVersion(pack.id) : null;
  const notice = isOwner
    ? ownerNotice(pack, latest)
    : !pack.isPublic && pack.removedAt
      ? { text: `Taken down by a moderator: ${sentence(pack.removedReason || 'no reason given')}` }
      : !pack.isPublic ? { text: STATUS_NOTES[version.status] ?? '' } : null;
  // Owners can send a new version unless one is already in review.
  const canUpdate = isOwner && !pack.removedAt && latest?.status === 'approved';

  return (
    <div className="min-h-screen bg-background/80 text-white">
      <Page width="wide">
        {notice?.text && (
          <Notice
            tone={pack.removedAt ? 'red' : 'amber'}
            className="mb-6"
            action={notice.action === 'edit' && (
              <Link href={`/packs/${pack.slug}/edit`} className={buttonVariants({ size: 'sm' })}>
                {notice.actionLabel ?? 'Make changes'}
              </Link>
            )}
          >
            <p>{notice.text}{'takedown' in notice && notice.takedown && TAKEDOWN_HELP}</p>
          </Notice>
        )}
        <PackView files={pack.files} schedule={version.schedule} kind={version.kind} details={
          <div className="md:w-1/3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
              <h1 className="text-4xl font-serif text-balance">{version.title}</h1>
              <Pill>{pack.kindLabel}</Pill>
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
                  <Link key={c} href={`/gallery/${c}`} className={pillClasses({ tone: 'outline', className: 'hover:bg-white/10 hover:text-white transition-colors' })}>
                    {categoryName(c)}
                  </Link>
                ))}
                {version.tags.map((tag) => (
                  <Link key={tag} href={`/gallery?tag=${tag}`} className={pillClasses({ className: 'hover:bg-white/20 hover:text-white transition-colors' })}>
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
                <Link href="/docs#install" className="text-xs text-white/50 hover:text-white mt-1">
                  Don&apos;t have Wallpy yet? Install it first.
                </Link>
              </div>
            )}

            {user && !isOwner && pack.isPublic && (
              <div className="mt-6 flex flex-col">
                <ReportPackButton packId={pack.id} alreadyReported={reported} />
              </div>
            )}
            {/* Reporting needs an account; like favouriting, sign in and come back. */}
            {!user && pack.isPublic && (
              <div className="mt-6 flex flex-col">
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(`/packs/${pack.slug}`)}`}
                  className="self-start text-xs text-white/50 hover:text-white transition-colors"
                >
                  Report this pack
                </Link>
              </div>
            )}

            {isModerator && (pack.isPublic || (pack.removedAt && version.status === 'approved')) && (
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3" data-testid="moderate-pack">
                <p className="text-xs uppercase tracking-wider text-white/50">Moderator</p>
                <PackModActions versionId={version.id} packId={pack.id} slug={pack.slug} removed={Boolean(pack.removedAt)} />
                <ModerationHistory entries={history} />
              </div>
            )}

            {isOwner && (
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-4" data-testid="manage-pack">
                <p className="text-xs uppercase tracking-wider text-white/50">Your pack</p>
                {canUpdate && (
                  <div className="flex flex-col gap-2">
                    <Link href={`/packs/${pack.slug}/edit`} className={buttonVariants({ variant: 'secondary' })}>
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
      </Page>
      <Footer />
    </div>
  );
}
