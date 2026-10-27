// The gallery's view as a value: which category (from the path,
// /gallery/<category>), and the search, tag, sort, AI filter and page (from
// the query string). The server page and the browser both parse it here, so
// the first page rendered on the server is the one the browser would fetch.
import { isCategory, type PackCategory } from '@/lib/packs/categories';
import { normalizeTag } from '@/lib/packs/limits';
import type { PackSort } from '@/lib/data/packs';
import type { PackCard } from '@/lib/types';

export const GALLERY_PAGE_SIZE = 9;
const SORTS: readonly PackSort[] = ['newest', 'popular', 'rating'];

export type GalleryQuery = {
  search: string;
  category: PackCategory | null;
  tag: string;
  sort: PackSort;
  hideAi: boolean;
  page: number;
};

export function parseGalleryQuery(category: string | null | undefined, get: (key: string) => string | null | undefined): GalleryQuery {
  return {
    search: get('q')?.trim() ?? '',
    category: isCategory(category) ? category : null,
    tag: normalizeTag(get('tag') ?? ''),
    sort: SORTS.find((s) => s === get('sort')) ?? 'newest',
    hideAi: get('ai') === 'hide',
    page: Math.max(1, parseInt(get('page') ?? '1', 10) || 1),
  };
}

/** How each category reads in a title ("Landscape dynamic wallpapers"). */
const TITLE_NOUN: Record<PackCategory, string> = {
  landscapes: 'Landscape',
  cities: 'City',
  space: 'Space',
  anime: 'Anime',
  games: 'Video game',
  illustration: 'Illustrated',
  photography: 'Photographic',
  'pixel-art': 'Pixel art',
  minimal: 'Minimal',
  abstract: 'Abstract',
};

/** The category page's title, e.g. "Video game dynamic wallpapers". */
export function categoryTitle(category: PackCategory): string {
  return `${TITLE_NOUN[category]} dynamic wallpapers`;
}

/** The category's address: /gallery or /gallery/<category>. */
export function galleryPath(category: PackCategory | null): string {
  return category ? `/gallery/${category}` : '/gallery';
}

/** The gallery's share card: /og/gallery or /og/gallery/<category>. */
export function galleryCardUrl(category: PackCategory | null): string {
  return category ? `/og/gallery/${category}` : '/og/gallery';
}

/** The category in a gallery path, or null. */
export function categoryFromPath(pathname: string): PackCategory | null {
  const segment = pathname.split('/')[2];
  return isCategory(segment) ? segment : null;
}

/** The /api/packs query for this view. It also keys the server-rendered first page. */
export function galleryApiParams(q: GalleryQuery): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(GALLERY_PAGE_SIZE),
    offset: String((q.page - 1) * GALLERY_PAGE_SIZE),
    sort: q.sort,
  });
  if (q.search) params.append('search', q.search);
  if (q.category) params.append('category', q.category);
  if (q.tag) params.append('tag', q.tag);
  if (q.hideAi) params.append('ai', 'hide');
  return params;
}

/** One server-rendered page of results, and the query it answers. */
export type GalleryInitial = { key: string; packs: PackCard[]; total: number };
