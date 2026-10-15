"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import GalleryCard from "@/components/gallery/GalleryCard";
import type { PackCard } from "@/lib/types";

/** Homepage showcase: the most downloaded public packs. */
export default function Gallery() {
  const [packs, setPacks] = useState<PackCard[] | null>(null);

  useEffect(() => {
    fetch("/api/packs?sort=popular&limit=6")
      .then((r) => (r.ok ? r.json() : { packs: [] }))
      .then((d) => setPacks(d.packs))
      .catch(() => setPacks([]));
  }, []);

  return (
    <section id="gallery" className="relative py-12 px-6 bg-black/80 text-white h-full">
      <div className="max-w-5xl mx-auto text-center mb-40">
        <h2 className="text-3xl md:text-5xl font-serif mb-6">Wallpy Gallery</h2>
        <p className="text-white/80 mb-12">
          Pick a wallpack made by the community, and install it with a single command.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-left">
          {packs === null
            ? Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-64 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
              ))
            : packs.map((pack) => <GalleryCard key={pack.id} wallpaper={pack} />)}
        </div>

        <Link href="/gallery" className="inline-block mt-10 px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
          Browse the gallery
        </Link>
      </div>
    </section>
  );
}
