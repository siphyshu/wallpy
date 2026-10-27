import { ImageResponse } from 'next/og';
import { getPackShare } from '@/lib/data/packs';
import { OG_CACHE, OG_SIZE, OG_TYPE, PLACARD_IMAGE, Placard, ogFetch, ogFonts, ogJpeg, ogLogo, ogRemoteImage, skyColour } from '@/lib/og';

// The pack's share card, a placard (lib/og.tsx): kind and image count, title,
// credit and the install command beside the cover, with a sky strip of up to
// six of its images in schedule order.

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'A Wallpy wallpaper pack';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const pack = await getPackShare((await params).slug);
  const [fonts, logo, cover, strip] = await Promise.all([
    ogFonts(),
    ogLogo(),
    ogRemoteImage(pack?.cover, PLACARD_IMAGE.width * 2, PLACARD_IMAGE.height * 2),
    Promise.all((pack?.stops ?? []).map(async (s) => {
      const b = await ogFetch(s.image);
      return b ? { label: s.label, colour: await skyColour(b) } : null;
    })).then((stops) => stops.filter((s) => s !== null)),
  ]);

  const card = new ImageResponse(
    (
      <Placard
        logo={logo}
        eyebrow={pack ? `${pack.kindLabel} · ${pack.imageCount} ${pack.imageCount === 1 ? 'image' : 'images'}` : 'Wallpaper pack'}
        title={pack?.title ?? 'Dynamic wallpapers for your desktop'}
        byline={pack ? `by ${pack.credit}` : undefined}
        command={pack ? `wallpy use ${pack.slug}` : undefined}
        image={cover}
        strip={strip}
        caption={pack?.caption}
      />
    ),
    { ...size, fonts },
  );
  return ogJpeg(card, { 'Cache-Control': OG_CACHE });
}
