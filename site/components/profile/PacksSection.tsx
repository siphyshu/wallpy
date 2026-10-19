import Image from 'next/image';
import Link from 'next/link';
import type { PackCard } from '@/lib/types';
import PackOwnerControls from '@/components/packs/PackOwnerControls';
import { Pill, type PillTone } from '@/components/ui/pill';
import { SectionTitle } from '@/components/ui/page';
import { buttonVariants } from '@/components/ui/button';

const STATUS = {
  public: { label: 'Published', tone: 'green' },
  approved: { label: 'Published', tone: 'green' },
  pending: { label: 'In review', tone: 'amber' },
  draft: { label: 'Draft', tone: 'outline' },
  rejected: { label: 'Changes requested', tone: 'amber' },
  declined: { label: 'Declined', tone: 'red' },
  removed: { label: 'Taken down', tone: 'red' },
  updatePending: { label: 'Update in review', tone: 'amber' },
  updateRejected: { label: 'Update sent back', tone: 'amber' },
  updateDraft: { label: 'Update withdrawn', tone: 'outline' },
  unlisted: { label: 'Unlisted', tone: 'outline' },
} satisfies Record<string, { label: string; tone: PillTone }>;

/** The badge on an uploaded pack: its state, and any newer version's (owners only see those). */
function statusOf(pack: PackCard) {
  if (pack.review === 'declined') return STATUS.declined;
  if (pack.isPublic) {
    if (pack.review === 'pending') return STATUS.updatePending;
    if (pack.review === 'rejected') return STATUS.updateRejected;
    if (pack.review === 'draft') return STATUS.updateDraft;
    return pack.isListed ? STATUS.public : STATUS.unlisted;
  }
  if (pack.status === 'approved') return STATUS.removed; // published, then taken down
  return STATUS[(pack.review ?? pack.status ?? 'draft') as keyof typeof STATUS] ?? STATUS.draft;
}

export default function PacksSection({ type, packs = [], canManage = false }: { type: 'uploaded' | 'favourited'; packs: PackCard[]; canManage?: boolean }) {
  const title = type === 'uploaded' ? 'Uploaded Packs' : 'Favourited Packs';
  
  return (
    <div className="space-y-6">
      <SectionTitle count={packs.length}>{title}</SectionTitle>
      
      {packs.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          {type === 'uploaded' ? (
            canManage ? (
              <p className="text-white/70 text-sm">No uploaded packs to display.{' '}
                <Link href="/upload" className={buttonVariants({ variant: 'link' })}>Upload your first pack</Link>.
              </p>
            ) : (
              <p className="text-white/70 text-sm">No packs yet.</p>
            )
          ) : (
            <p className="text-white/70 text-sm">No favourited packs yet.{' '}
              <Link href="/gallery" className={buttonVariants({ variant: 'link' })}>Explore the gallery</Link>.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map(pack => {
            const status = canManage ? statusOf(pack) : null;
            return (
              <div
                key={pack.id}
                className="group block bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-4 hover:bg-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-white/5 hover:-translate-y-1"
              >
                <Link href={pack.url} className="block">
                  <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-white/5">
                    <Image
                      src={pack.preview}
                      alt={pack.name}
                      fill
                      sizes="(min-width: 1024px) 20vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="font-semibold text-white text-sm truncate">{pack.name}</h3>
                </Link>
                <div className="flex items-center justify-between mt-3">
                  {/* Review status is the owner's business; visitors only see published packs anyway. */}
                  {type === 'uploaded' ? (
                    status ? <Pill tone={status.tone}>{status.label}</Pill> : <span />
                  ) : (
                    <span className="text-xs text-white/60">{pack.author}</span>
                  )}
                  {pack.downloads > 0 && (
                    <span className="text-xs text-white/60">{pack.downloads} {pack.downloads === 1 ? 'download' : 'downloads'}</span>
                  )}
                </div>
                {/* Owners manage their packs here too: unlist, withdraw from review, delete. */}
                {canManage && type === 'uploaded' && (
                  <div className="flex justify-end mt-3 pt-3 border-t border-white/10">
                    <PackOwnerControls
                      variant="card"
                      packId={pack.id}
                      slug={pack.slug}
                      name={pack.name}
                      published={pack.isPublic}
                      listed={pack.isListed}
                      pendingVersionId={pack.pendingVersionId}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 