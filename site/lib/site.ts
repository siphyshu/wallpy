// The site's public address and name, for canonical links, the sitemap and
// share cards. NEXT_PUBLIC_SITE_URL overrides it (e.g. a preview deploy).

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wallpy.siphyshu.me').replace(/\/$/, '');
export const SITE_NAME = 'Wallpy';
