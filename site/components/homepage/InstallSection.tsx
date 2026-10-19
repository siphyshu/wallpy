import Link from 'next/link';
import CopyCommand from '@/components/CopyCommand';
import InstallOptions from '@/components/install/InstallOptions';
import { buttonVariants } from '@/components/ui/button';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6 flex gap-5">
      <span className="shrink-0 w-8 h-8 rounded-full bg-white text-black text-sm font-semibold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <h3 className="text-xl font-medium">{title}</h3>
        {children}
      </div>
    </li>
  );
}

const InstallSection = () => {
  return (
    <section id="install" className="relative py-24 px-6 bg-black/80 text-white scroll-mt-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-serif mb-6">Install Wallpy in 3 steps</h2>
          <p className="text-white/80">One small program, no runtime. Works on macOS, Windows and Linux.</p>
        </div>

        <ol className="flex flex-col gap-4 text-left">
          <Step n={1} title="Install the CLI">
            <InstallOptions />
          </Step>
          <Step n={2} title="Pick a pack">
            <p className="text-white/70 text-sm">
              The first time you run it, Wallpy asks roughly where you are (for your real sunrise and
              sunset), then opens the gallery in your terminal. Or copy a pack&apos;s command from
              its <Link href="/gallery" className="underline underline-offset-4 hover:text-white">page here</Link>.
            </p>
            <CopyCommand command="wallpy" />
          </Step>
          <Step n={3} title="That's it">
            <p className="text-white/70 text-sm">
              Your wallpaper changes with the sun, the day of the week or the pack&apos;s own schedule,
              even after a restart. Run <code className="font-mono text-white">wallpy</code> to see
              what&apos;s showing and what&apos;s next.
            </p>
          </Step>
        </ol>

        <p className="text-center mt-10">
          <Link href="/docs" className={buttonVariants({ variant: 'secondary' })}>
            Read the docs
          </Link>
        </p>
      </div>
    </section>
  );
};

export default InstallSection;
