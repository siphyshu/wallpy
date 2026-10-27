import { ImageResponse } from 'next/og';
import { getPackShare } from '@/lib/data/packs';
import { OG_SIZE, OG_TYPE, ogFonts, ogJpeg, ogLogo, ogRemoteImage } from '@/lib/og';

// The pack's share card: its cover, title, kind and credit.

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'A Wallpy wallpaper pack';
// Cached by the CDN for an hour, so a new cover or title shows up soon after.
const CACHE = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const pack = await getPackShare((await params).slug);
  const [fonts, logo, cover] = await Promise.all([
    ogFonts(),
    ogLogo(),
    pack?.image ? ogRemoteImage(pack.image, size.width, size.height) : null,
  ]);

  const card = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#0a0a0a', fontFamily: 'Inter', color: 'white' }}>
        {cover && (
          <img src={cover} alt="" width={size.width} height={size.height} style={{ position: 'absolute', top: 0, left: 0 }} />
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)' }} />

        <div style={{ position: 'absolute', top: 48, left: 64, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={logo} alt="" width={44} height={44} />
          <span style={{ fontSize: 30, fontWeight: 700 }}>Wallpy</span>
        </div>

        <div style={{ position: 'absolute', left: 64, right: 64, bottom: 56, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pack && (
            <div style={{ display: 'flex' }}>
              <span style={{ fontSize: 22, padding: '6px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.35)' }}>
                {pack.kindLabel}
              </span>
            </div>
          )}
          <span style={{ fontFamily: 'Instrument Serif', fontSize: 88, lineHeight: 1.05, lineClamp: 2 }}>
            {pack?.title ?? 'Dynamic wallpapers for your desktop'}
          </span>
          {pack && <span style={{ fontSize: 30, color: 'rgba(255,255,255,0.8)' }}>by {pack.credit}</span>}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
  return ogJpeg(card, { 'Cache-Control': CACHE });
}
