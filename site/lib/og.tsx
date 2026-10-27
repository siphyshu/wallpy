import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// Shared pieces of the share images (opengraph-image.tsx files): size, fonts,
// the logo, and conversions. The renderer (Satori) can't read WebP, which is
// what pack previews are, so sharp converts them to JPEG first; the finished
// card goes out as a JPEG too (~150 KB instead of ~1.5 MB as PNG; WhatsApp
// skips previews over ~300 KB).
//
// File paths are written out in full so the build traces only these files.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/jpeg';

/** The site's fonts: Instrument Serif for titles, Inter for the rest (assets/fonts, OFL). */
export async function ogFonts() {
  const [serif, serifItalic, inter, interBold] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/InstrumentSerif-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/InstrumentSerif-Italic.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Inter-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Inter-Bold.ttf')),
  ]);
  return [
    { name: 'Instrument Serif', data: serif, weight: 400 as const, style: 'normal' as const },
    { name: 'Instrument Serif', data: serifItalic, weight: 400 as const, style: 'italic' as const },
    { name: 'Inter', data: inter, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: interBold, weight: 700 as const, style: 'normal' as const },
  ];
}

/** The navbar's logo as a small PNG data URI. */
export async function ogLogo(): Promise<string> {
  const png = await sharp(await readFile(join(process.cwd(), 'public/waves.png'))).resize(96, 96).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** An image cropped to `width` × `height` as a JPEG data URI. */
export async function ogImage(input: Buffer, width: number, height: number): Promise<string> {
  const jpeg = await sharp(input).resize(width, height, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** An image from a URL (the CDN), cropped as above; null if it can't be fetched. */
export async function ogRemoteImage(url: string, width: number, height: number): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ogImage(Buffer.from(await res.arrayBuffer()), width, height);
  } catch {
    return null;
  }
}

/** The rendered card (an ImageResponse, PNG) as a JPEG response. */
export async function ogJpeg(card: Response, headers: Record<string, string> = {}): Promise<Response> {
  const jpeg = await sharp(Buffer.from(await card.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': OG_TYPE, ...headers } });
}
