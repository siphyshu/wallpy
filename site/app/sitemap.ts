import type { MetadataRoute } from 'next';
import { CATEGORIES } from '@/lib/packs/categories';
import { listSitemapPacks } from '@/lib/data/packs';
import { SITE_URL } from '@/lib/site';

// Rebuilt at most once an hour.
export const revalidate = 3600;

/** Public pages, the gallery's categories in use, every listed pack and the profiles behind them. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const packs = await listSitemapPacks();
  const url = (path: string) => `${SITE_URL}${path}`;
  const used = new Set(packs.flatMap((p) => p.categories));
  const owners = new Map<string, string>();
  for (const p of packs) {
    // Packs come newest first, so the first one seen is the owner's latest.
    if (p.owner && !owners.has(p.owner)) owners.set(p.owner, p.updatedAt);
  }

  return [
    { url: url('/'), changeFrequency: 'weekly', priority: 1 },
    { url: url('/gallery'), changeFrequency: 'daily', priority: 0.9 },
    ...CATEGORIES.filter((c) => used.has(c.id)).map((c) => ({ url: url(`/gallery/${c.id}`), changeFrequency: 'weekly' as const, priority: 0.7 })),
    { url: url('/docs'), changeFrequency: 'monthly', priority: 0.8 },
    ...packs.map((p) => ({ url: url(`/packs/${p.slug}`), lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...[...owners].map(([username, at]) => ({ url: url(`/profile/${username}`), lastModified: at, changeFrequency: 'monthly' as const, priority: 0.4 })),
    { url: url('/privacy'), changeFrequency: 'yearly', priority: 0.1 },
    { url: url('/terms'), changeFrequency: 'yearly', priority: 0.1 },
  ];
}
