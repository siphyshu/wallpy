import type { ReactNode } from 'react';

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.9em] text-white bg-white/10 rounded px-1.5 py-0.5">{children}</code>;
}

// Each answer is checked against the CLI (cli/internal/geo, state, wallpaper,
// service) and the LICENSE; keep them in step when that changes.
const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'Is it free?',
    a: 'Yes. Wallpy and every pack in the gallery are free, and Wallpy is open source under the MIT licence.',
  },
  {
    q: 'Why does it ask where I am?',
    a: (
      <>
        To work out your real sunrise and sunset. A city is enough, or <Code>auto</Code>, which goes by your
        computer&apos;s time zone. Your location stays on your computer: cities are looked up in a list built into
        Wallpy, and only a search for a small place goes online (to Open-Meteo). Change it any time with{' '}
        <Code>wallpy location</Code>.
      </>
    ),
  },
  {
    q: 'Will it slow my computer down?',
    a: 'No. A small background agent sleeps until the next scheduled change, sets the wallpaper, and goes back to sleep. It starts again when you log in.',
  },
  {
    q: 'Does it work with more than one monitor?',
    a: 'Yes. On Windows it sets every monitor, on macOS the current Space on each display, and on Linux whatever your desktop supports.',
  },
  {
    q: 'Can I use my own images?',
    a: (
      <>
        Yes. Make a pack here with <a href="/upload" className="underline underline-offset-2 decoration-white/30 hover:text-white">Create wallpack</a>{' '}
        and share it, or keep it to yourself: <Code>wallpy use ./my-folder</Code> sets a pack straight from a folder.
      </>
    ),
  },
  {
    q: 'How do I remove it?',
    a: (
      <>
        Run <Code>wallpy uninstall</Code>. It removes the background agent (and your packs, if you like) and shows the
        command that removes Wallpy itself.
      </>
    ),
  },
];

/** The questions people ask before installing a command-line tool. */
export default function FaqSection() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16 flex flex-col gap-10">
      <h2 className="text-3xl md:text-5xl font-serif text-center">Questions</h2>
      <div className="flex flex-col border-t border-white/10">
        {FAQS.map((f) => (
          <details key={f.q} className="group border-b border-white/10">
            <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none text-lg font-medium hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded [&::-webkit-details-marker]:hidden">
              {f.q}
              <span aria-hidden className="shrink-0 text-white/50 text-2xl leading-none transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="pb-5 pr-8 text-white/70 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
