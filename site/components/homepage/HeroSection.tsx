"use client"

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// One pack, four times of day: the hero shows what "dynamic" means. It steps
// through on its own until the visitor picks a time (or prefers less motion).
const TIMES = [
  { label: 'Dawn', at: '05:00', src: '/wallpapers/hero/dawn.webp', alt: 'An island at dawn' },
  { label: 'Day', at: '06:30', src: '/wallpapers/hero/day.webp', alt: 'An island in daylight' },
  { label: 'Dusk', at: '18:30', src: '/wallpapers/hero/dusk.webp', alt: 'An island at dusk' },
  { label: 'Night', at: '19:30', src: '/wallpapers/hero/night.webp', alt: 'An island at night' },
];
const STEP_MS = 6000;

const HeroSection = () => {
  const [current, setCurrent] = useState(1);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setCurrent((i) => (i + 1) % TIMES.length), STEP_MS);
    return () => clearInterval(timer);
  }, [auto]);

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden text-center">
      {TIMES.map((t, i) => (
        <Image
          key={t.src}
          src={t.src}
          alt={i === current ? t.alt : ''}
          aria-hidden={i !== current}
          fill
          priority={i === 1}
          sizes="100vw"
          className={`object-cover transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}

      {/* Grid background */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: 'url("/grid-large.svg")',
          backgroundRepeat: 'repeat-x',
          backgroundSize: 'auto 100%',
          opacity: 0.1,
          mask: 'radial-gradient(70% 46% at 50% 50%, rgba(0,0,0,0.73) 0%, rgba(0,0,0,0.01643) 100%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 from-20% via-black/35 via-55% to-background" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-5 px-4 pt-40 pb-12">
        <h1 className="text-4xl md:text-7xl font-light leading-tight">
          <span className="italic font-serif">Dynamic Wallpapers</span><br />
          <span className="font-bold">for your desktop.</span>
        </h1>
        <p className="max-w-xl text-base md:text-lg text-white/85 text-pretty">
          Wallpapers that follow the sun, the days of the week, or a schedule of their own. A small
          command-line app for macOS, Windows and Linux.
        </p>
        <div className="mt-2 flex justify-center gap-4 flex-wrap">
          <Link href="/gallery" className="px-6 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-200">
            Browse the gallery
          </Link>
          <a href="#install" className="px-6 py-2 rounded-full border border-white text-white text-sm hover:bg-white/10">
            Install Wallpy →
          </a>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2.5 px-4 pb-14">
        <div role="group" aria-label="Time of day" className="flex justify-center gap-1 p-1 rounded-full border border-white/15 bg-black/35 backdrop-blur-md">
          {TIMES.map((t, i) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={i === current}
              onClick={() => { setAuto(false); setCurrent(i); }}
              className={`min-h-9 px-3 sm:px-4 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                i === current ? 'bg-white text-black' : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              {t.label}<span className="hidden sm:inline font-mono text-xs opacity-70"> {t.at}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-white/70">
          <Link href="/packs/zelda-wind-waker" className="underline underline-offset-2 decoration-white/30 hover:text-white">Zelda Wind Waker</Link>{' '}
          by <a href="https://mattvince.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-white/30 hover:text-white">Matt Vince</a>,
          a Daypack: one island, four times of day. Wallpy switches at your real sunrise and sunset.
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
