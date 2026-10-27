import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OG_SIZE, OG_TYPE, ogFonts, ogJpeg, ogLogo } from '@/lib/og';

// The site's share card: the homepage's island at dawn, day, dusk and night,
// one strip each, so the card itself shows what "dynamic" means. Pages
// without their own card use this one.

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'Wallpy: the same island at dawn, day, dusk and night';

const LABELS = ['Dawn', 'Day', 'Dusk', 'Night'];

/** The four hero images, each cropped to its own quarter of the same frame, as one JPEG. */
async function timeSlice(): Promise<string> {
  const files = await Promise.all([
    readFile(join(process.cwd(), 'public/wallpapers/hero/dawn.webp')),
    readFile(join(process.cwd(), 'public/wallpapers/hero/day.webp')),
    readFile(join(process.cwd(), 'public/wallpapers/hero/dusk.webp')),
    readFile(join(process.cwd(), 'public/wallpapers/hero/night.webp')),
  ]);
  const strip = size.width / files.length;
  const strips = await Promise.all(
    files.map(async (file, i) => {
      const input = await sharp(file)
        .resize(size.width, size.height, { fit: 'cover' })
        .extract({ left: i * strip, top: 0, width: strip, height: size.height })
        .toBuffer();
      return { input, left: i * strip, top: 0 };
    }),
  );
  const jpeg = await sharp({ create: { width: size.width, height: size.height, channels: 3, background: '#000' } })
    .composite(strips)
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

export default async function Image() {
  const [fonts, logo, background] = await Promise.all([ogFonts(), ogLogo(), timeSlice()]);
  const strip = size.width / LABELS.length;

  const card = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: 'Inter', color: 'white' }}>
        <img src={background} alt="" width={size.width} height={size.height} style={{ position: 'absolute', top: 0, left: 0 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'radial-gradient(70% 60% at 50% 48%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 100%)' }} />
        {/* Hairlines between the times of day */}
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: i * strip, width: 1, height: '100%', background: 'rgba(255,255,255,0.25)' }} />
        ))}

        <div style={{ position: 'absolute', top: 48, left: 64, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={logo} alt="" width={44} height={44} />
          <span style={{ fontSize: 30, fontWeight: 700 }}>Wallpy</span>
        </div>

        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Instrument Serif', fontStyle: 'italic', fontSize: 104, lineHeight: 1 }}>Dynamic Wallpapers</span>
          <span style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.15 }}>for your desktop.</span>
        </div>

        <div style={{ position: 'absolute', left: 0, bottom: 40, width: '100%', display: 'flex' }}>
          {LABELS.map((label) => (
            <div key={label} style={{ width: strip, display: 'flex', justifyContent: 'center', fontSize: 24, color: 'rgba(255,255,255,0.85)' }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
  return ogJpeg(card);
}
