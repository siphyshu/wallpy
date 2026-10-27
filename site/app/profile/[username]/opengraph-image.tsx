import { ImageResponse } from 'next/og';
import { getProfileShare } from '@/lib/data/profiles';
import { Ground, Logo, OG_CACHE, OG_SIZE, OG_TYPE, SERIF, at, framed, ogDefaultAvatar, ogFonts, ogJpeg, ogLogo, ogRemoteImage } from '@/lib/og';

// A profile's share card, laid out like the profile page: their cover as a
// banner, the avatar over its edge, name and pack count, then up to four of
// their packs.

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'A Wallpy profile';

const { width: W } = OG_SIZE;
const BANNER = 290, TW = 254, TH = 143;

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const profile = await getProfileShare((await params).username);
  const [fonts, logo, banner, avatar, thumbs] = await Promise.all([
    ogFonts(),
    ogLogo(),
    ogRemoteImage(profile?.cover, W * 2, BANNER * 2),
    ogRemoteImage(profile?.avatar, 280, 280).then((a) => a ?? ogDefaultAvatar()),
    Promise.all((profile?.packs ?? []).map((p) => ogRemoteImage(p.cover, TW * 2, TH * 2))),
  ]);
  const count = profile?.packCount ?? 0;

  const card = new ImageResponse(
    (
      <Ground>
        {banner
          ? <img src={banner} alt="" width={W} height={BANNER} style={{ position: 'absolute', top: 0, left: 0 }} />
          // The profile page's empty cover: a dusk gradient.
          : <div style={at({ top: 0, left: 0, width: W, height: BANNER, backgroundImage: 'linear-gradient(160deg, #2a2440 0%, #7a4a5a 55%, #d38a5c 100%)' })} />}
        <div style={at({ top: 0, left: 0, width: W, height: BANNER, backgroundImage: 'linear-gradient(to bottom, rgba(17,17,17,0) 40%, rgba(17,17,17,1) 100%)' })} />
        <div style={at({ top: 36, right: 56 })}>
          <div style={{ display: 'flex', padding: '9px 16px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)' }}><Logo src={logo} size={28} /></div>
        </div>
        <div style={at({ top: BANNER - 80, left: 64, alignItems: 'flex-end', gap: 28 })}>
          <img src={avatar} alt="" width={140} height={140} style={{ borderRadius: 999, border: '5px solid #111111' }} />
          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 6 }}>
            <span style={{ fontFamily: SERIF, fontSize: 68, lineHeight: 1, lineClamp: 1, maxWidth: 860 }}>{profile?.name ?? 'Wallpy'}</span>
            <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.65)' }}>
              {profile ? `@${profile.username}${count ? ` · ${count} ${count === 1 ? 'pack' : 'packs'} on Wallpy` : ' on Wallpy'}` : ''}
            </span>
          </div>
        </div>
        <div style={at({ left: 64, bottom: 44, gap: 18 })}>
          {(profile?.packs ?? []).map((p, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: TW }}>
              {thumbs[i] ? <img src={thumbs[i]!} alt="" width={TW} height={TH} style={{ ...framed, borderRadius: 12 }} /> : <div style={{ width: TW, height: TH, borderRadius: 12, background: '#1a1a1a' }} />}
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.title}</span>
            </div>
          ))}
        </div>
      </Ground>
    ),
    { ...size, fonts },
  );
  return ogJpeg(card, { 'Cache-Control': OG_CACHE });
}
