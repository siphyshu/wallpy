import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

const SCENES = {
  dusk: { src: '/wallpapers/hero/dusk.webp', alt: 'An island at dusk' },
  night: { src: '/wallpapers/hero/night.webp', alt: 'An island at night' },
  dawn: { src: '/wallpapers/hero/dawn.webp', alt: 'An island at dawn' },
};

/**
 * The sign-in, sign-up and password pages: one card on a full-screen wallpaper
 * (the homepage's island), dimmed so the glass card reads clearly.
 */
export default function AuthShell({ scene = 'dusk', children }: { scene?: keyof typeof SCENES; children: ReactNode }) {
  const { src, alt } = SCENES[scene];
  return (
    <div className="relative min-h-screen overflow-hidden text-white bg-background">
      <Image src={src} alt={alt} fill priority sizes="100vw" className="object-cover" />
      <div aria-hidden className="absolute inset-0 bg-black/55" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 pt-36 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <p className="absolute z-10 bottom-4 inset-x-0 text-center text-xs text-white/50 px-4">
        <Link href="/packs/zelda-wind-waker" className="hover:text-white">Zelda Wind Waker</Link> by{' '}
        <a href="https://mattvince.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">Matt Vince</a>
      </p>
    </div>
  );
}
