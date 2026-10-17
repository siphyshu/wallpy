import { Suspense } from 'react';
import GalleryBrowser from '@/components/gallery/GalleryBrowser';

export const metadata = { title: 'Gallery | Wallpy' };

// Filters live in the URL (/gallery?category=games, /gallery?tag=japan, ...);
// GalleryBrowser reads them with useSearchParams.
export default function GalleryPage() {
  return (
    <Suspense>
      <GalleryBrowser />
    </Suspense>
  );
}
