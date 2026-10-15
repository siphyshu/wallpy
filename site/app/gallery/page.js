import GalleryBrowser from '@/components/gallery/GalleryBrowser';

export const metadata = { title: 'Gallery | Wallpy' };

// Tag links (/gallery?tag=gaming) preselect a category, read on the server so
// the first render is already filtered.
export default async function GalleryPage({ searchParams }) {
  const { tag } = await searchParams;
  return <GalleryBrowser initialTag={typeof tag === 'string' ? tag : 'all'} />;
}
