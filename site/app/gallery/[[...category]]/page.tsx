import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import GalleryBrowser from '@/components/gallery/GalleryBrowser';
import { listPublicPacks } from '@/lib/data/packs';
import { categoryName, isCategory, type PackCategory } from '@/lib/packs/categories';
import { GALLERY_PAGE_SIZE, categoryTitle, galleryCardUrl, galleryApiParams, galleryPath, parseGalleryQuery, type GalleryInitial, type GalleryQuery } from '@/lib/gallery';

// /gallery and /gallery/<category> are one page, so switching category in the
// browser only changes the URL. Search, tag, sort, the AI filter and the page
// stay in the query string. The first page of results renders here, so
// visitors and search engines get packs in the HTML; GalleryBrowser fetches
// from /api/packs after that.

type Params = { category?: string[] };
type Search = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The category in the path; a path that isn't one is a 404. */
function pathCategory(segments: string[] | undefined): PackCategory | null {
  if (!segments?.length) return null;
  if (segments.length > 1 || !isCategory(segments[0])) notFound();
  return segments[0];
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const [category, sp] = [pathCategory((await params).category), await searchParams];
  return metadataFor(parseGalleryQuery(category, (k) => first(sp[k])));
}

function metadataFor(query: GalleryQuery): Metadata {
  const { category, tag, page, search } = query;
  const title = category
    ? categoryTitle(category)
    : tag ? `Dynamic wallpapers tagged #${tag}` : 'Gallery';
  const description = category
    ? `${categoryName(category)} wallpaper packs for macOS, Windows and Linux that change with the time of day, the day of the week or on a timer. Free on Wallpy.`
    : 'Discover and install beautiful wallpaper packs created by our community. Browse through our collection and find your perfect desktop background.';
  // Sort and the AI filter only reorder or narrow a listing, so they share its canonical.
  const canonical = new URLSearchParams();
  if (tag) canonical.set('tag', tag);
  if (page > 1) canonical.set('page', String(page));
  const qs = canonical.toString();
  return {
    title: `${title}${page > 1 ? ` (page ${page})` : ''} | Wallpy`,
    description,
    alternates: { canonical: `${galleryPath(category)}${qs ? `?${qs}` : ''}` },
    // The card is a route (app/og/gallery): Next allows no opengraph-image file here.
    openGraph: { images: [{ url: galleryCardUrl(category), width: 1200, height: 630, alt: description }] },
    twitter: { card: 'summary_large_image', images: [galleryCardUrl(category)] },
    // Search results are endless and thin; keep them out of the index.
    ...(search ? { robots: { index: false } } : {}),
  };
}

export default async function GalleryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const category = pathCategory((await params).category);

  // Links from before categories had their own address: /gallery?category=games.
  const legacy = first(sp.category);
  if (!category && isCategory(legacy)) {
    const rest = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const value = first(v);
      if (k !== 'category' && value) rest.set(k, value);
    }
    const qs = rest.toString();
    redirect(`${galleryPath(legacy)}${qs ? `?${qs}` : ''}`);
  }

  const query = parseGalleryQuery(category, (k) => first(sp[k]));
  let initial: GalleryInitial | null = null;
  try {
    const { packs, total } = await listPublicPacks({
      search: query.search || undefined,
      category: query.category ?? undefined,
      tag: query.tag || undefined,
      hideAi: query.hideAi,
      sort: query.sort,
      limit: GALLERY_PAGE_SIZE,
      offset: (query.page - 1) * GALLERY_PAGE_SIZE,
    });
    initial = { key: galleryApiParams(query).toString(), packs, total };
  } catch {
    // The browser fetches it instead, and shows the error and Retry if that fails too.
  }

  return (
    <Suspense>
      <GalleryBrowser initial={initial} />
    </Suspense>
  );
}
