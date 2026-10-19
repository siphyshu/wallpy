import Link from 'next/link';
import Footer from '@/components/footer';
import { buttonVariants } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';

export const metadata = { title: 'Not found | Wallpy' };

// Every notFound() lands here too: unknown packs, profiles and pages.
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col text-white">
      <main className="flex-1 flex items-center justify-center px-4 pt-36 pb-12">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-lg p-8 text-center flex flex-col items-center gap-4">
          <Pill>404</Pill>
          <h1 className="text-4xl md:text-5xl font-serif">Nothing here</h1>
          <p className="text-white/70">
            This page doesn&apos;t exist, or the pack or profile it pointed to has gone.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            <Link href="/gallery" className={buttonVariants()}>
              Browse the gallery
            </Link>
            <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
              Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
