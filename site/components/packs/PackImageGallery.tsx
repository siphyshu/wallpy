"use client"

import { forwardRef, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Blurhash } from 'react-blurhash';
import type { PackFile } from '@/lib/types';

/**
 * Large viewer plus a filmstrip. `files` come from getPackBySlug; `selected`
 * is owned by the parent (PackView), so the schedule can pick images too.
 * Both show renditions (1920px preview, 640px thumbnails) as they are: they're
 * already small, so the image optimizer only adds a wait on first view.
 */
const PackImageGallery = forwardRef<HTMLDivElement, {
  files: PackFile[];
  selected: PackFile | null;
  onSelect: (file: PackFile) => void;
}>(function PackImageGallery({ files, selected, onSelect }, ref) {
  const strip = useRef<HTMLDivElement>(null);

  // Keep the selected thumbnail in view when it's chosen from elsewhere.
  useEffect(() => {
    if (!selected) return;
    const thumb = strip.current?.querySelector<HTMLElement>(`[data-file="${CSS.escape(selected.id)}"]`);
    const box = strip.current;
    if (thumb && box) box.scrollTo({ left: thumb.offsetLeft - (box.clientWidth - thumb.clientWidth) / 2, behavior: 'smooth' });
  }, [selected]);

  if (!selected) return null;

  return (
    <div ref={ref} className="md:w-2/3 scroll-mt-28">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-white/5">
        {selected.blurhash && (
          <Blurhash hash={selected.blurhash} width="100%" height="100%" resolutionX={32} resolutionY={32} punch={1}
                    style={{ position: 'absolute', inset: 0 }} />
        )}
        <Image key={selected.sha256} src={selected.previewUrl} alt={selected.path} fill priority
               sizes="(min-width: 768px) 66vw, 100vw" unoptimized={selected.previewUrl !== selected.url}
               className="object-cover relative" />
      </div>
      {files.length > 1 && (
        <div ref={strip} className="relative mt-4 flex overflow-x-auto gap-2 no-scrollbar">
          {files.map((file) => (
            <button
              key={file.id}
              type="button"
              data-file={file.id}
              onClick={() => onSelect(file)}
              aria-label={`Show ${file.path}`}
              aria-pressed={selected.id === file.id}
              className={`relative h-24 md:h-32 flex-shrink-0 rounded-lg overflow-hidden aspect-video bg-white/5 border-2 transition-all ${
                selected.id === file.id ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Image src={file.thumbUrl} alt="" fill sizes="240px" unoptimized={file.thumbUrl !== file.url} className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default PackImageGallery;
