import { Page, PageHeader } from '@/components/ui/page';
import { Pill } from '@/components/ui/pill';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/footer';
import { getCurrentProfile } from '@/lib/data/profiles';
import { listMyNotices, markNoticesSeen, NOTICE_LABELS, NOTICE_TONE } from '@/lib/data/notices';

export const metadata = { title: 'Notices | Wallpy' };

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Signed-in only; visiting marks every notice read (profiles.notices_seen_at).
export default async function NoticesPage() {
  const me = await getCurrentProfile();
  if (!me) redirect('/auth/login?redirect=/notices');

  const notices = await listMyNotices();
  await markNoticesSeen(me.id);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background">
      <Page width="reading">
        <div>
          <PageHeader title="Notices" description="What moderators decided about your packs." />

          {notices.length === 0 ? (
            <p className="text-white/60" data-testid="notices-empty">
              Nothing yet. You&apos;ll hear here when a moderator reviews one of your packs.
            </p>
          ) : (
            <ul className="flex flex-col gap-4" data-testid="notices-list">
              {notices.map((n) => (
                <li key={n.id} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-5 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/packs/${n.slug}`} className="text-base font-medium underline decoration-white/30 underline-offset-4 hover:decoration-white">
                      {n.title}
                    </Link>
                    <span className="text-xs text-white/40 shrink-0">{timeAgo(n.at)}</span>
                  </div>
                  <Pill tone={NOTICE_TONE[n.action]} className="self-start">{NOTICE_LABELS[n.action]}</Pill>
                  {n.notes && <p className="text-sm text-white/70">&ldquo;{n.notes}&rdquo;</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Page>
      <Footer />
    </div>
  );
}
