import Image from 'next/image';
import type { ReactNode } from 'react';
import { Pill } from '@/components/ui/pill';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function Kind({ kind, title, visual, children }: { kind: string; title: string; visual: ReactNode; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-3.5 p-6 rounded-lg border border-white/10 bg-white/5">
      {visual}
      <Pill className="self-start">{kind}</Pill>
      <h3 className="text-xl font-medium">{title}</h3>
      <p className="text-sm leading-relaxed text-white/70">{children}</p>
    </article>
  );
}

/** What a pack can do: the three kinds, each with a small picture of how it changes. */
export default function PackKindsSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16 flex flex-col gap-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-3xl md:text-5xl font-serif">Three ways a pack changes</h2>
        <p className="max-w-xl text-white/70 text-pretty">
          Every pack is a folder of images and a schedule. Pick one and Wallpy keeps it changing, even after a restart.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Kind
          kind="Daypack"
          title="Follows the sun"
          visual={
            <div className="grid grid-cols-4 gap-1 rounded-md overflow-hidden">
              {['dawn', 'day', 'dusk', 'night'].map((t) => (
                <div key={t} className="relative aspect-square">
                  <Image src={`/wallpapers/hero/${t}.webp`} alt="" fill sizes="120px" className="object-cover" />
                </div>
              ))}
            </div>
          }
        >
          Dawn, day, dusk and night at your real sunrise and sunset, wherever you are.
        </Kind>
        <Kind
          kind="Weekpack"
          title="A look for each day"
          visual={
            <div className="grid grid-cols-7 gap-1" aria-hidden>
              {DAYS.map((d, i) => (
                <span
                  key={i}
                  className={`aspect-square rounded flex items-center justify-center text-[11px] ${
                    i === 3 ? 'bg-white text-black font-semibold' : 'bg-white/10 text-white/60'
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>
          }
        >
          Monday gets one wallpaper, Friday another. Each day can also change through the day.
        </Kind>
        <Kind
          kind="Album"
          title="A slideshow on a timer"
          visual={
            <div className="grid grid-cols-3 gap-1 rounded-md overflow-hidden">
              {['greasy-diner.jpg', 'mystery-shack-porch.jpg', 'deku-tree.jpg'].map((f) => (
                <div key={f} className="relative aspect-[4/3]">
                  <Image src={`/wallpapers/${f}`} alt="" fill sizes="160px" className="object-cover" />
                </div>
              ))}
            </div>
          }
        >
          A new wallpaper every half hour, every hour, or as often as the pack says.
        </Kind>
      </div>
    </section>
  );
}
