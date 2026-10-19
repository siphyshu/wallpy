import { Page, PageHeader } from '@/components/ui/page';
import { LinkTabs } from '@/components/ui/tabs';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/footer';
import AiUseLabel from '@/components/packs/AiUseLabel';
import ReviewActions from '@/components/moderation/ReviewActions';
import PackModActions from '@/components/moderation/PackModActions';
import ModerationHistory from '@/components/moderation/ModerationHistory';
import { getCurrentProfile } from '@/lib/data/profiles';
import { listHistory, listOpenReports, listPendingVersions, searchPublishedPacks, type PendingVersion } from '@/lib/data/moderation';
import { categoryName } from '@/lib/packs/categories';
import { reportReasonLabel } from '@/lib/moderation/review';

export const metadata = { title: 'Moderation | Wallpy' };

const LICENSES: Record<string, string> = {
  'personal-use': 'Personal use only', 'cc-by-4.0': 'CC BY 4.0', 'cc-by-nc-4.0': 'CC BY-NC 4.0', cc0: 'CC0', other: 'Other',
};

const TABS = [
  { id: 'queue', label: 'Queue' },
  { id: 'reports', label: 'Reports' },
  { id: 'published', label: 'Published' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const CARD = 'bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6';
const date = (iso: string) => new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

function Thumb({ href, url, alt }: { href: string; url: string | null; alt: string }) {
  // self-start: in a flex row the cover would otherwise stretch past 16:9.
  return (
    <Link href={href} className="relative w-full md:w-72 self-start aspect-video rounded-lg overflow-hidden bg-white/5 shrink-0">
      {url && <Image src={url} alt={alt} fill sizes="288px" className="object-cover" />}
    </Link>
  );
}

function Strip({ images, dim = false }: { images: PendingVersion['images']; dim?: boolean }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {images.slice(0, 8).map((img) => (
        <div key={img.path} className={`relative h-14 aspect-video rounded overflow-hidden bg-white/5 shrink-0 ${dim ? 'opacity-50' : ''}`} title={img.path}>
          <Image src={img.url} alt={img.path} fill sizes="100px" unoptimized={img.small} className="object-cover" />
        </div>
      ))}
      {images.length > 8 && (
        <div className="h-14 aspect-video rounded bg-white/5 flex items-center justify-center text-xs text-white/60 shrink-0">
          +{images.length - 8}
        </div>
      )}
    </div>
  );
}

function UpdateDiff({ v }: { v: PendingVersion }) {
  const d = v.diff!;
  const added = v.images.filter((i) => d.added.includes(i.path));
  const empty = !d.fields.length && !added.length && !d.removedImages.length && !d.schedule;
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 flex flex-col gap-3 text-sm" data-testid="update-diff">
      <p className="text-xs uppercase tracking-wide text-white/50">Changes from the live version</p>
      {empty && <p className="text-white/60">No changes to details, images or schedule.</p>}
      {d.fields.map((f) => (
        <div key={f.field}>
          <span className="text-white/50">{f.field}: </span>
          <span className="text-white/50 line-through">{f.before}</span>
          <span className="text-white/40"> → </span>
          <span>{f.after}</span>
        </div>
      ))}
      {added.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-white/50">Images added or replaced ({added.length})</span>
          <Strip images={added} />
        </div>
      )}
      {d.removedImages.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-white/50">Images removed or replaced ({d.removedImages.length})</span>
          <Strip images={d.removedImages} dim />
        </div>
      )}
      {d.schedule && (
        <div className="grid md:grid-cols-2 gap-3">
          {(['before', 'after'] as const).map((side) => (
            <div key={side}>
              <span className="text-white/50">Schedule {side === 'before' ? 'now' : 'in this update'}</span>
              <ul className="mt-1 font-mono text-xs text-white/70 flex flex-col gap-0.5">
                {d.schedule![side].map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueCard({ v }: { v: PendingVersion }) {
  return (
    <article className={CARD}>
      <div className="flex flex-col md:flex-row gap-6">
        <Thumb href={`/packs/${v.slug}`} url={v.thumbUrl} alt={v.title} />

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/packs/${v.slug}`} className="text-2xl font-serif hover:underline truncate">{v.title}</Link>
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">{v.kindLabel}</span>
            {v.isUpdate && (
              <span className="px-2 py-1 bg-white/10 text-white/70 rounded text-xs font-medium">Update · v{v.number}</span>
            )}
            <AiUseLabel aiUse={v.aiUse} />
          </div>

          <div className="flex items-center gap-2 text-sm text-white/70">
            <div className="relative w-5 h-5 rounded-full overflow-hidden border border-white/20">
              <Image src={v.uploader.avatar} alt="" fill sizes="20px" className="object-cover" />
            </div>
            <Link href={`/profile/${v.uploader.username}`} className="hover:text-white">@{v.uploader.username}</Link>
            <span className="text-white/40">·</span>
            <span>credit: {v.credit}</span>
          </div>

          {v.description && <p className="text-sm text-white/70 line-clamp-2">{v.description}</p>}

          {(v.categories.length > 0 || v.tags.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {v.categories.map((c) => (
                <span key={c} className="px-2.5 py-0.5 border border-white/20 bg-white/5 rounded-full text-xs">{categoryName(c)}</span>
              ))}
              {v.tags.map((t) => <span key={t} className="px-2 py-0.5 bg-white/10 rounded-full text-xs">#{t}</span>)}
            </div>
          )}

          <p className="text-xs text-white/50">
            {v.images.length} images · {v.slotCount} {v.slotCount === 1 ? 'slot' : 'slots'} · {LICENSES[v.license]}
            {!v.aiUse && ' · AI use not disclosed'}
            {v.submittedAt && ` · submitted ${date(v.submittedAt)}`}
          </p>

          <ul className="font-mono text-xs text-white/60 flex flex-col gap-0.5" data-testid="schedule-summary">
            {v.schedule.map((line, i) => <li key={i}>{line}</li>)}
          </ul>

          <Strip images={v.images} />

          {v.diff && <UpdateDiff v={v} />}

          <div className="mt-2">
            <ReviewActions versionId={v.versionId} slug={v.slug} isUpdate={v.isUpdate} />
          </div>
          <ModerationHistory entries={v.history} />
        </div>
      </div>
    </article>
  );
}

async function QueueTab() {
  const pending = await listPendingVersions();
  return (
    <>
      <p className="text-white/70 text-center mb-8">
        {pending.length === 0
          ? 'Nothing waiting for review.'
          : `${pending.length} ${pending.length === 1 ? 'pack is' : 'packs are'} waiting, oldest first.`}
      </p>
      <div className="flex flex-col gap-6">
        {pending.map((v) => <QueueCard key={v.versionId} v={v} />)}
      </div>
    </>
  );
}

async function ReportsTab() {
  const reported = await listOpenReports();
  const history = await listHistory(reported.map((r) => r.packId));
  return (
    <>
      <p className="text-white/70 text-center mb-8">
        {reported.length === 0
          ? 'No open reports.'
          : `${reported.length} ${reported.length === 1 ? 'pack has' : 'packs have'} open reports, most reported first.`}
      </p>
      <div className="flex flex-col gap-6">
        {reported.map((p) => (
          <article key={p.packId} className={CARD} data-testid="report-card">
            <div className="flex flex-col md:flex-row gap-6">
              <Thumb href={`/packs/${p.slug}`} url={p.thumbUrl} alt={p.title} />
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/packs/${p.slug}`} className="text-2xl font-serif hover:underline truncate">{p.title}</Link>
                  <span className="px-2 py-1 bg-amber-400/10 text-amber-200 border border-amber-400/30 rounded-full text-xs font-medium">
                    {p.reports.length} {p.reports.length === 1 ? 'report' : 'reports'}
                  </span>
                  {p.removed && <span className="px-2 py-1 bg-white/10 text-white/70 rounded-full text-xs">Taken down</span>}
                </div>
                <p className="text-sm text-white/60">
                  {p.owner ? <Link href={`/profile/${p.owner}`} className="hover:text-white">@{p.owner}</Link> : 'deleted user'}
                </p>
                <ul className="flex flex-col gap-2">
                  {p.reports.map((r) => (
                    <li key={r.id} className="text-sm">
                      <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs mr-2">{reportReasonLabel(r.reason)}</span>
                      <span className="text-white/50 text-xs">{r.reporter ? `@${r.reporter}` : 'deleted user'} · {date(r.at)}</span>
                      {r.note && <p className="text-white/70 mt-1">{r.note}</p>}
                    </li>
                  ))}
                </ul>
                {p.versionId && (
                  <PackModActions versionId={p.versionId} packId={p.packId} slug={p.slug} removed={p.removed} openReports={p.reports.length} />
                )}
                <ModerationHistory entries={history.get(p.packId) ?? []} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

async function PublishedTab({ q }: { q: string }) {
  const packs = await searchPublishedPacks(q);
  return (
    <>
      <form className="flex gap-2 mb-8 max-w-xl mx-auto" action="/moderation">
        <input type="hidden" name="tab" value="published" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search published packs by title"
          className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 text-sm"
        />
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors">Search</button>
      </form>
      {packs.length === 0 && <p className="text-white/70 text-center">No published packs match.</p>}
      <div className="flex flex-col gap-4">
        {packs.map((p) => (
          <article key={p.packId} className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-4" data-testid="published-card">
            <div className="flex flex-col md:flex-row gap-4">
              <Link href={`/packs/${p.slug}`} className="relative w-full md:w-40 self-start aspect-video rounded overflow-hidden bg-white/5 shrink-0">
                {p.thumbUrl && <Image src={p.thumbUrl} alt={p.title} fill sizes="160px" className="object-cover" />}
              </Link>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/packs/${p.slug}`} className="text-lg font-serif hover:underline truncate">{p.title}</Link>
                  {p.removedAt && <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full text-xs">Taken down</span>}
                  {!p.isListed && <span className="px-2 py-0.5 bg-white/10 text-white/70 rounded-full text-xs">Unlisted</span>}
                </div>
                <p className="text-sm text-white/60">
                  {p.owner ? <Link href={`/profile/${p.owner}`} className="hover:text-white">@{p.owner}</Link> : 'deleted user'}
                  {p.removedAt && ` · taken down ${date(p.removedAt)}: ${p.removedReason ?? 'no reason given'}`}
                </p>
                <PackModActions versionId={p.versionId} packId={p.packId} slug={p.slug} removed={Boolean(p.removedAt)} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default async function ModerationPage({ searchParams }: PageProps<'/moderation'>) {
  const me = await getCurrentProfile();
  // Not found (rather than forbidden) for everyone else: no need to advertise it.
  if (!me || (me.role !== 'moderator' && me.role !== 'admin')) notFound();
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : 'queue';
  const q = typeof params.q === 'string' ? params.q : '';

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background">
      <Page width="browse">
        <div>
          <PageHeader
            title="Moderation"
            description="New packs and updates to review, reports from visitors, and every published pack."
            actions={
              <LinkTabs
                label="Moderation sections"
                current={tab}
                tabs={TABS.map((t) => ({ id: t.id, label: t.label, href: t.id === 'queue' ? '/moderation' : `/moderation?tab=${t.id}` }))}
              />
            }
          />

          {tab === 'queue' && <QueueTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'published' && <PublishedTab q={q} />}
        </div>
      </Page>
      <Footer />
    </div>
  );
}
