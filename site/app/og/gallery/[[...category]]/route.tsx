// Satori draws these elements into an image; next/image doesn't apply here.
/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { listPublicPacks } from '@/lib/data/packs';
import { isCategory, type PackCategory } from '@/lib/packs/categories';
import { categoryTitle } from '@/lib/gallery';
import { Ground, Logo, OG_CACHE, OG_SIZE, SERIF, at, eyebrow, ogFonts, ogJpeg, ogLogo, ogRemoteImage } from '@/lib/og';
import type { PackCard } from '@/lib/types';

// The gallery's share card (/og/gallery, /og/gallery/<category>): the text on
// the left, a bento of the six most downloaded covers on the right. A
// category gets a wall of its own covers, edge to edge, under its title; one
// with no packs yet gets the gallery's.
//
// A route handler rather than an opengraph-image file: Next doesn't allow
// those under an optional catch-all like /gallery/[[...category]]. The
// gallery page's metadata points here (galleryCardUrl).

const { width: W, height: H } = OG_SIZE;

export async function GET(_request: Request, { params }: { params: Promise<{ category?: string[] }> }) {
  const segment = (await params).category?.[0];
  const category = isCategory(segment) ? segment : null;
  const [fonts, logo, inCategory] = await Promise.all([
    ogFonts(),
    ogLogo(),
    category ? listPublicPacks({ category, sort: 'popular', limit: 6 }).catch(() => null) : null,
  ]);
  const card = category && inCategory?.packs.length
    ? await wall(category, inCategory.packs, inCategory.total, logo)
    : await grid(logo);
  return ogJpeg(new ImageResponse(card, { ...OG_SIZE, fonts }), { 'Cache-Control': OG_CACHE });
}

// The bento: a 3 × 3 grid right of the text, the most downloaded cover over
// 2 × 2 cells, five more around it. Every tile stays landscape.
const BENTO = { left: 440, margin: 40, gap: 12 };
function bentoCells() {
  const { left, margin, gap } = BENTO;
  const w = W - left - margin, h = H - margin * 2;
  const cw = (w - gap * 2) / 3, ch = (h - gap * 2) / 3;
  const cell = (col: number, row: number, span = 1) => ({
    x: left + col * (cw + gap), y: margin + row * (ch + gap),
    w: span * cw + (span - 1) * gap, h: span * ch + (span - 1) * gap,
  });
  return [cell(0, 0, 2), cell(2, 0), cell(2, 1), cell(0, 2), cell(1, 2), cell(2, 2)];
}

async function grid(logo: string) {
  const cells = bentoCells();
  const { packs, total } = await listPublicPacks({ sort: 'popular', limit: cells.length }).catch(() => ({ packs: [] as PackCard[], total: 0 }));
  const tiles = await Promise.all(cells.map((c, i) => (packs[i] ? ogRemoteImage(packs[i].preview, Math.round(c.w * 2), Math.round(c.h * 2)) : null)));
  return (
    <Ground>
      <div style={at({ top: 0, left: 56, width: BENTO.left - 56 - 36, height: H, flexDirection: 'column', justifyContent: 'center', gap: 16 })}>
        <div style={{ display: 'flex', marginBottom: 24 }}><Logo src={logo} /></div>
        {total > 0 && <span style={eyebrow}>{`${total} ${total === 1 ? 'wallpack' : 'wallpacks'}`.toUpperCase()}</span>}
        <span style={{ fontFamily: SERIF, fontSize: 96, lineHeight: 1 }}>Gallery</span>
        <span style={{ fontSize: 26, color: 'rgba(255,255,255,0.75)', lineHeight: 1.35 }}>Dynamic wallpaper packs made by the community.</span>
      </div>
      {cells.map((c, i) => (
        // An empty slot (fewer packs than tiles) stays a dark tile.
        <div key={i} style={at({ top: c.y, left: c.x, width: c.w, height: c.h, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', background: '#1a1a1a' })}>
          {tiles[i] && <img src={tiles[i]!} alt="" width={c.w} height={c.h} />}
        </div>
      ))}
    </Ground>
  );
}

async function wall(category: PackCategory, packs: PackCard[], total: number, logo: string) {
  // 1–3 packs: one row; 4–5: 2 × 2; 6: 3 × 2.
  const cols = packs.length >= 6 ? 3 : packs.length >= 4 ? 2 : packs.length;
  const rows = packs.length >= 4 ? 2 : 1;
  const gap = 6;
  const cw = Math.floor((W - gap * (cols - 1)) / cols), ch = Math.floor((H - gap * (rows - 1)) / rows);
  const tiles = await Promise.all(packs.slice(0, cols * rows).map((p) => ogRemoteImage(p.preview, cw, ch)));
  return (
    <Ground background="#000">
      <div style={at({ top: 0, left: 0, width: W, height: H, flexWrap: 'wrap', gap })}>
        {tiles.map((t, i) => (t ? <img key={i} src={t} alt="" width={cw} height={ch} /> : <div key={i} style={{ width: cw, height: ch, background: '#1a1a1a' }} />))}
      </div>
      <div style={at({ top: 0, left: 0, width: W, height: H, backgroundImage: 'linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.7) 32%, rgba(10,10,10,0) 62%, rgba(10,10,10,0) 78%, rgba(10,10,10,0.55) 100%)' })} />
      <div style={at({ top: 44, left: 64 })}><Logo src={logo} size={34} /></div>
      <div style={at({ left: 64, right: 64, bottom: 52, flexDirection: 'column', gap: 8 })}>
        <span style={{ ...eyebrow, color: 'rgba(255,255,255,0.65)' }}>{`Gallery · ${total} ${total === 1 ? 'wallpack' : 'wallpacks'}`.toUpperCase()}</span>
        <span style={{ fontFamily: SERIF, fontSize: 80, lineHeight: 1, maxWidth: 1000, lineClamp: 2 }}>{categoryTitle(category)}</span>
        <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>Free for macOS, Windows and Linux</span>
      </div>
    </Ground>
  );
}
