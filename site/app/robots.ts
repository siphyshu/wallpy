import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Private pages (sign-in, upload, moderation, notices, editing) carry
// `robots: noindex` in their own metadata instead of being blocked here, so
// crawlers can read that and drop them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
