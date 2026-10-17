"use client"

import { useRef, useState, type ReactNode } from 'react';
import PackImageGallery from '@/components/packs/PackImageGallery';
import PackSchedule from '@/components/packs/PackSchedule';
import type { PackFile, PackKind, Schedule } from '@/lib/types';

/**
 * The pack page's images: the viewer (with the details beside it) and the
 * schedule below. Picking an image in either shows it in the viewer.
 */
export default function PackView({ files, schedule, kind, details }: {
  files: PackFile[];
  schedule: Schedule;
  kind: PackKind;
  /** the pack's details, shown beside the viewer */
  details: ReactNode;
}) {
  const [selected, setSelected] = useState<PackFile | null>(files[0] ?? null);
  const viewer = useRef<HTMLDivElement>(null);

  const showFromSchedule = (file: PackFile) => {
    setSelected(file);
    const box = viewer.current?.getBoundingClientRect();
    // Bring the viewer back into view if the schedule has scrolled it away.
    if (box && (box.top < 0 || box.top > window.innerHeight * 0.5)) {
      viewer.current!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row gap-8">
        <PackImageGallery ref={viewer} files={files} selected={selected} onSelect={setSelected} />
        {details}
      </div>
      <PackSchedule schedule={schedule} kind={kind} files={files} selected={selected} onSelect={showFromSchedule} />
    </>
  );
}
