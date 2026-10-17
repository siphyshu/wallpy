// The curated category list. The database enum public.pack_category is the
// source of truth (supabase/migrations/20261019130000_categories.sql); this is
// its order and labels for the gallery chips and the upload picker.
import type { PackCategory } from '@/lib/types';
export type { PackCategory };

export const CATEGORIES: readonly { id: PackCategory; name: string }[] = [
  { id: 'nature', name: 'Nature' },
  { id: 'landscapes', name: 'Landscapes' },
  { id: 'cities', name: 'Cities' },
  { id: 'space', name: 'Space' },
  { id: 'anime', name: 'Anime' },
  { id: 'games', name: 'Games' },
  { id: 'art', name: 'Art' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'abstract', name: 'Abstract' },
  { id: 'seasons', name: 'Seasons' },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [PackCategory, ...PackCategory[]];
export const MAX_CATEGORIES = 2;

export function isCategory(value: unknown): value is PackCategory {
  return typeof value === 'string' && CATEGORY_IDS.includes(value as PackCategory);
}

export function categoryName(id: PackCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}
