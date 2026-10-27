import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/site';

/** The web manifest: the name and icon a phone uses when the site is added to a home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: 'Dynamic wallpapers for your desktop.',
    start_url: '/',
    display: 'browser',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
