import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

/** The creator's way in: make a pack and share it. */
export default function CreateSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
      <div className="flex flex-wrap items-center gap-8 p-8 md:p-10 rounded-xl border border-white/10 bg-white/5">
        <div className="flex-[999_1_420px] min-w-0 flex flex-col gap-3">
          <h2 className="text-3xl md:text-4xl font-serif">Make your own wallpack</h2>
          <p className="max-w-lg text-white/70 leading-relaxed">
            Drop in your images, set when each one shows in the browser, and share it. Moderators check every pack before it goes public.
          </p>
        </div>
        <Link href="/upload" className={buttonVariants({ size: 'lg', className: 'flex-auto' })}>
          Create wallpack
        </Link>
      </div>
    </section>
  );
}
