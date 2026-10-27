import { ImageResponse } from 'next/og';
import { Ground, Headline, Logo, OG_SIZE, OG_TYPE, Systems, at, heroImages, ogFonts, ogJpeg, ogLogo, timeSlice } from '@/lib/og';

// The site's share card, used by every page without its own: the homepage's
// island at dawn, day, dusk and night as one framed time slice, the logo, the
// headline, and the systems it runs on.

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'Wallpy: dynamic wallpapers for your desktop, on macOS, Windows and Linux';

const MARGIN = 40;

export default async function Image() {
  const fw = size.width - MARGIN * 2, fh = size.height - MARGIN * 2;
  const [fonts, logo, slice] = await Promise.all([ogFonts(), ogLogo(), heroImages().then((imgs) => timeSlice(imgs, fw * 2, fh * 2))]);

  const card = new ImageResponse(
    (
      <Ground>
        <div style={at({ top: MARGIN, left: MARGIN, width: fw, height: fh, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)' })}>
          <img src={slice} alt="" width={fw} height={fh} />
          <div style={at({ top: 0, left: 0, width: fw, height: fh, backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.42) 62%, rgba(0,0,0,0.58) 100%)' })} />
          {[1, 2, 3].map((i) => <div key={i} style={at({ top: 0, left: (i * fw) / 4, width: 1, height: fh, background: 'rgba(255,255,255,0.2)' })} />)}
        </div>
        <div style={at({ top: MARGIN + 36, left: 0, width: '100%', justifyContent: 'center' })}><Logo src={logo} size={36} /></div>
        <div style={at({ top: 0, left: 0, width: '100%', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, paddingTop: 24 })}>
          <Headline size={100} />
          <Systems size={22} />
        </div>
      </Ground>
    ),
    { ...size, fonts },
  );
  return ogJpeg(card);
}
