"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import GalleryCard from "@/components/gallery/GalleryCard";
import type { PackCard } from "@/lib/types";
import { buttonVariants } from '@/components/ui/button';

/** Homepage showcase: the most downloaded public packs. */
export default function Gallery() {
  const [packs, setPacks] = useState<PackCard[] | null>(null);

  useEffect(() => {
    fetch("/api/packs?sort=popular&limit=3")
      .then((r) => (r.ok ? r.json() : { packs: [] }))
      .then((d) => setPacks(d.packs))
      .catch(() => setPacks([]));
  }, []);

  return (
    <section id="gallery" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16 flex flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl md:text-5xl font-serif">From the gallery</h2>
            <p className="text-white/70">Made by the community. Each one installs with a single command.</p>
          </div>
          <Link href="/gallery" className={buttonVariants({ variant: 'secondary' })}>
            Browse the gallery
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-left">
          {packs === null
            ? Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-64 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
              ))
            : packs.map((pack) => <GalleryCard key={pack.id} wallpaper={pack} />)}
        </div>
    </section>
  );
}
