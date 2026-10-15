"use client"

import { useState } from 'react';
import Image from 'next/image';
import { Blurhash } from 'react-blurhash';
import type { PackFile } from '@/lib/types';

/** Large viewer plus a filmstrip. `files` come from getPackBySlug. */
export default function PackImageGallery({ files = [] }: { files: PackFile[] }) {
  const [selected, setSelected] = useState(files[0] ?? null);
  if (!selected) return null;

  return (
    <div className="md:w-2/3">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-white/5">
        {selected.blurhash && (
          <Blurhash hash={selected.blurhash} width="100%" height="100%" resolutionX={32} resolutionY={32} punch={1}
                    style={{ position: 'absolute', inset: 0 }} />
        )}
        <Image key={selected.sha256} src={selected.url} alt={selected.path} fill priority
               sizes="(min-width: 768px) 66vw, 100vw" className="object-cover relative" />
      </div>
      {files.length > 1 && (
        <div className="mt-4 flex overflow-x-auto gap-2 no-scrollbar">
          {files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setSelected(file)}
              aria-label={`Show ${file.path}`}
              className={`relative h-24 md:h-32 flex-shrink-0 rounded-lg overflow-hidden aspect-video bg-white/5 border-2 transition-all ${
                selected.id === file.id ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Image src={file.url} alt="" fill sizes="240px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
