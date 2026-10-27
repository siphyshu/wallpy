// Satori draws these elements into an image; next/image doesn't apply here.
/* eslint-disable @next/next/no-img-element */
import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { CSSProperties, ReactNode } from 'react';
import { faApple, faLinux, faWindows, type IconDefinition } from '@fortawesome/free-brands-svg-icons';

// Shared pieces of the share cards (the opengraph-image.tsx files): size,
// fonts, the logo, image conversions and a few drawn parts. The renderer
// (Satori) can't read WebP, which is what pack previews are, so sharp converts
// them to JPEG first; the finished card goes out as a JPEG too (~100 KB
// instead of ~1.5 MB as PNG; WhatsApp skips previews over ~300 KB).
//
// Every card sits on the site's dark ground (#111111) with framed images,
// Instrument Serif titles and Inter for the rest. Satori lays out with flexbox
// only, so every element with more than one child sets display: flex.
//
// File paths are written out in full so the build traces only these files.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/jpeg';
export const GROUND = '#111111';
export const SERIF = 'Instrument Serif';

/** CDN caching for cards drawn from data (packs, gallery, profiles). */
export const OG_CACHE = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

/** The site's fonts: Instrument Serif for titles, Inter for the rest (assets/fonts, OFL). */
export async function ogFonts() {
  const [serif, serifItalic, inter, interBold] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/InstrumentSerif-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/InstrumentSerif-Italic.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Inter-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Inter-Bold.ttf')),
  ]);
  return [
    { name: SERIF, data: serif, weight: 400 as const, style: 'normal' as const },
    { name: SERIF, data: serifItalic, weight: 400 as const, style: 'italic' as const },
    { name: 'Inter', data: inter, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: interBold, weight: 700 as const, style: 'normal' as const },
  ];
}

/** The navbar's logo as a small PNG data URI. */
export async function ogLogo(): Promise<string> {
  const png = await sharp(await readFile(join(process.cwd(), 'public/waves.png'))).resize(96, 96).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** The default avatar (public/avatar_placeholder.png) as a data URI. */
export async function ogDefaultAvatar(): Promise<string> {
  return ogImage(await readFile(join(process.cwd(), 'public/avatar_placeholder.png')), 280, 280);
}

/** The homepage hero's four times of day, dawn to night. */
export async function heroImages(): Promise<Buffer[]> {
  return Promise.all([
    readFile(join(process.cwd(), 'public/wallpapers/hero/dawn.webp')),
    readFile(join(process.cwd(), 'public/wallpapers/hero/day.webp')),
    readFile(join(process.cwd(), 'public/wallpapers/hero/dusk.webp')),
    readFile(join(process.cwd(), 'public/wallpapers/hero/night.webp')),
  ]);
}

/** An image cropped to `width` × `height` as a JPEG data URI. */
export async function ogImage(input: Buffer, width: number, height: number): Promise<string> {
  const jpeg = await sharp(input).resize(width, height, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** A file from a URL (the CDN), or null if it can't be fetched. */
export async function ogFetch(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** An image from a URL, cropped as above; null if it can't be fetched. */
export async function ogRemoteImage(url: string | null | undefined, width: number, height: number): Promise<string | null> {
  const buf = url ? await ogFetch(url) : null;
  return buf ? ogImage(buf, width, height) : null;
}

/** Strips of several images, each its own slice of one frame (they share a composition). */
export async function timeSlice(images: Buffer[], width: number, height: number): Promise<string> {
  const strip = width / images.length;
  const parts = await Promise.all(images.map(async (img, i) => {
    const left = Math.round(i * strip);
    const w = Math.round((i + 1) * strip) - left;
    const input = await sharp(img).resize(width, height, { fit: 'cover' }).extract({ left, top: 0, width: w, height }).toBuffer();
    return { input, left, top: 0 };
  }));
  const jpeg = await sharp({ create: { width, height, channels: 3, background: '#000' } }).composite(parts).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** The colour of an image's sky: the mean of its top third, a touch brighter. */
export async function skyColour(input: Buffer): Promise<string> {
  const { channels } = await sharp(input).resize(64, 36, { fit: 'cover' }).extract({ left: 0, top: 0, width: 64, height: 12 }).stats();
  const [r, g, b] = channels.map((c) => Math.min(255, Math.round(c.mean * 1.15)));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The rendered card (an ImageResponse, PNG) as a JPEG response. */
export async function ogJpeg(card: Response, headers: Record<string, string> = {}): Promise<Response> {
  const jpeg = await sharp(Buffer.from(await card.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': OG_TYPE, ...headers } });
}

/** Sizes as the CLI prints them (cli/internal/ui/transfer.go Bytes). */
export function formatBytes(n: number): string {
  if (n < 1e3) return `${n} B`;
  if (n < 1e6) return `${Math.round(n / 1e3)} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e9).toFixed(2)} GB`;
}

// ---- drawn parts -------------------------------------------------------------

/** Absolutely placed flex box. */
export const at = (style: CSSProperties): CSSProperties => ({ position: 'absolute', display: 'flex', ...style });

export function Ground({ children, background = GROUND }: { children: ReactNode; background?: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background, color: 'white', fontFamily: 'Inter' }}>
      {children}
    </div>
  );
}

export function Logo({ src, size = 40 }: { src: string; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.3) }}>
      <img src={src} alt="" width={size} height={size} />
      <span style={{ fontSize: Math.round(size * 0.7), fontWeight: 700 }}>Wallpy</span>
    </div>
  );
}

function Brand({ icon, size }: { icon: IconDefinition; size: number }) {
  const [w, h, , , path] = icon.icon;
  return <svg width={size} height={size} viewBox={`0 0 ${w} ${h}`} fill="currentColor"><path d={Array.isArray(path) ? path.join(' ') : path} /></svg>;
}

/** macOS, Windows and Linux with their logos. */
export function Systems({ size = 20, colour = 'rgba(255,255,255,0.85)' }: { size?: number; colour?: string }) {
  const systems = [['macOS', faApple], ['Windows', faWindows], ['Linux', faLinux]] as const;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 1.1), fontSize: size, color: colour }}>
      {systems.map(([name, icon]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.45) }}>
          <Brand icon={icon} size={size} />
          {name}
        </div>
      ))}
    </div>
  );
}

/** The homepage's headline: "Dynamic Wallpapers" in serif italic over "for your desktop." */
export function Headline({ size = 100 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 1 }}>Dynamic Wallpapers</span>
      <span style={{ fontSize: Math.round(size * 0.68), fontWeight: 700, lineHeight: 1.15 }}>for your desktop.</span>
    </div>
  );
}

export const eyebrow: CSSProperties = { fontSize: 20, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 };
export const framed: CSSProperties = { borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' };

// ---- the pack placard ----------------------------------------------------------

// The text on the left, the cover inset on the right with a sky strip under it.
export const PLACARD_IMAGE = { width: 700, height: 394 };
const MARGIN = 56, GAP = 40;
export const PLACARD_COLUMN = OG_SIZE.width - MARGIN * 2 - GAP - PLACARD_IMAGE.width;

export function Placard({ logo, eyebrow: kicker, title, byline, command, image, strip, caption }: {
  logo: string;
  eyebrow: string;
  title: string;
  byline?: string;
  command?: string;
  /** JPEG data URI at 2× PLACARD_IMAGE */
  image: string | null;
  strip: { colour: string; label: string }[];
  caption?: string | null;
}) {
  const { width: iw, height: ih } = PLACARD_IMAGE;
  const muted = 'rgba(255,255,255,0.55)';
  return (
    <Ground>
      <div style={at({ top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'radial-gradient(60% 80% at 75% 50%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)' })} />

      <div style={at({ left: MARGIN, top: 0, width: PLACARD_COLUMN, height: '100%', flexDirection: 'column', justifyContent: 'center', gap: 14 })}>
        <div style={{ display: 'flex', marginBottom: 26 }}><Logo src={logo} /></div>
        <span style={eyebrow}>{kicker.toUpperCase()}</span>
        <span style={{ fontFamily: SERIF, fontSize: fitTitleSize(title), lineHeight: 1.02, lineClamp: 3 }}>{title}</span>
        {byline && <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.75)', lineClamp: 2 }}>{byline}</span>}
        {command && (
          <div style={{ display: 'flex', marginTop: 18 }}>
            <span style={{ fontSize: 18, padding: '10px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', maxWidth: PLACARD_COLUMN, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              $ {command}
            </span>
          </div>
        )}
      </div>

      <div style={at({ right: MARGIN, top: (OG_SIZE.height - ih - 50) / 2, flexDirection: 'column', gap: 14 })}>
        {image
          ? <img src={image} alt="" width={iw} height={ih} style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.12)' }} />
          : <div style={{ width: iw, height: ih, borderRadius: 18, border: '1px solid rgba(255,255,255,0.12)', background: 'linear-gradient(160deg, #2a2440 0%, #7a4a5a 55%, #d38a5c 100%)' }} />}
        {strip.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: iw }}>
            <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden' }}>
              {strip.map((s, i) => <div key={i} style={{ flex: 1, background: s.colour }} />)}
            </div>
            {caption
              ? <span style={{ fontSize: 15, color: muted }}>{caption}</span>
              : (
                <div style={{ display: 'flex' }}>
                  {strip.map((s, i) => (
                    <span key={i} style={{ flex: 1, fontSize: 15, color: muted, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: 6 }}>{s.label}</span>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>
    </Ground>
  );
}

/** Title size that keeps long titles inside three lines of the placard's text column. */
export function fitTitleSize(title: string): number {
  const base = title.length > 40 ? 54 : title.length > 22 ? 64 : 76;
  return Math.round(base * Math.min(1, PLACARD_COLUMN / 400));
}
