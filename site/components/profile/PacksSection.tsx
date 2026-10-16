import Image from 'next/image';
import Link from 'next/link';
import type { PackCard } from '@/lib/types';

const STATUS: Record<string, { label: string; className: string }> = {
  public: { label: 'Published', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  approved: { label: 'Published', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  pending: { label: 'In review', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  draft: { label: 'Draft', className: 'bg-white/10 text-white/70 border-white/20' },
  rejected: { label: 'Changes requested', className: 'bg-amber-400/10 text-amber-200 border-amber-400/30' },
  declined: { label: 'Declined', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
  removed: { label: 'Taken down', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
  updatePending: { label: 'Update in review', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  updateRejected: { label: 'Update sent back', className: 'bg-amber-400/10 text-amber-200 border-amber-400/30' },
};

/** The badge on an uploaded pack: its state, and any newer version's (owners only see those). */
function statusOf(pack: PackCard) {
  if (pack.review === 'declined') return STATUS.declined;
  if (pack.isPublic) {
    if (pack.review === 'pending') return STATUS.updatePending;
    if (pack.review === 'rejected') return STATUS.updateRejected;
    return STATUS.public;
  }
  if (pack.status === 'approved') return STATUS.removed; // published, then taken down or unlisted
  return STATUS[pack.review ?? pack.status ?? 'draft'] ?? STATUS.draft;
}

export default function PacksSection({ type, packs = [] }: { type: 'uploaded' | 'favourited'; packs: PackCard[] }) {
  const title = type === 'uploaded' ? 'Uploaded Packs' : 'Favourited Packs';
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-serif text-white">{title}</h2>
        <span className="px-3 py-1 bg-white/10 rounded-full text-sm text-white/70 border border-white/20">
          {packs.length}
        </span>
      </div>
      
      {packs.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          {type === 'uploaded' ? (
            <p className="text-white/70 text-sm">No uploaded packs to display.{' '}
              <Link href="/upload" className="text-blue-400 hover:underline">Upload your first pack</Link>.
            </p>
          ) : (
            <p className="text-white/70 text-sm">No favourited packs yet.{' '}
              <Link href="/gallery" className="text-blue-400 hover:underline">Explore the gallery</Link>.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map(pack => {
            const status = statusOf(pack);
            return (
              <Link
                key={pack.id}
                href={pack.url}
                className="group block bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-4 hover:bg-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-white/5 hover:-translate-y-1"
              >
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
                <div className="flex items-center justify-between mt-3">
                  {type === 'uploaded' ? (
                    <span className={`text-xs px-2 py-1 rounded-full border ${status.className}`}>{status.label}</span>
                  ) : (
                    <span className="text-xs text-white/60">{pack.author}</span>
                  )}
                  <span className="text-xs text-white/60">{pack.downloads} downloads</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
} 