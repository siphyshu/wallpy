import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Footer from '@/components/footer';
import AiUseLabel from '@/components/packs/AiUseLabel';
import ReviewActions from '@/components/moderation/ReviewActions';
import { getCurrentProfile } from '@/lib/data/profiles';
import { listPendingVersions } from '@/lib/data/moderation';

export const metadata = { title: 'Review queue | Wallpy' };

const LICENSES: Record<string, string> = {
  'personal-use': 'Personal use only', 'cc-by-4.0': 'CC BY 4.0', 'cc-by-nc-4.0': 'CC BY-NC 4.0', cc0: 'CC0', other: 'Other',
};

export default async function ModerationPage() {
  const me = await getCurrentProfile();
  // Not found (rather than forbidden) for everyone else: no need to advertise it.
  if (!me || (me.role !== 'moderator' && me.role !== 'admin')) notFound();
  const pending = await listPendingVersions();

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
      <section className="relative mt-20 pt-24 px-6 min-h-screen">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-serif mb-6">Review queue</h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">
              {pending.length === 0
                ? 'Nothing waiting for review.'
                : `${pending.length} ${pending.length === 1 ? 'pack is' : 'packs are'} waiting, oldest first.`}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {pending.map((v) => (
              <article key={v.versionId} className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <Link href={`/packs/${v.slug}`} className="relative md:w-72 aspect-video rounded-lg overflow-hidden bg-white/5 shrink-0">
                    {v.thumbUrl && <Image src={v.thumbUrl} alt={v.title} fill sizes="288px" className="object-cover" />}
                  </Link>

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

                    <p className="text-xs text-white/50">
                      {v.images.length} images · {v.slotCount} {v.slotCount === 1 ? 'slot' : 'slots'} · {LICENSES[v.license]}
                      {!v.aiUse && ' · AI use not disclosed'}
                      {v.submittedAt && ` · submitted ${new Date(v.submittedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {v.images.slice(0, 8).map((img) => (
                        <div key={img.path} className="relative h-14 aspect-video rounded overflow-hidden bg-white/5 shrink-0" title={img.path}>
                          <Image src={img.url} alt={img.path} fill sizes="100px" unoptimized={img.small} className="object-cover" />
                        </div>
                      ))}
                      {v.images.length > 8 && (
                        <div className="h-14 aspect-video rounded bg-white/5 flex items-center justify-center text-xs text-white/60 shrink-0">
                          +{v.images.length - 8}
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <ReviewActions versionId={v.versionId} slug={v.slug} isUpdate={v.isUpdate} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
