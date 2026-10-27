import { ImageResponse } from 'next/og';
import { getPackShare } from '@/lib/data/packs';
import { INSTALL } from '@/lib/install';
import { Ground, Logo, OG_SIZE, OG_TYPE, SERIF, at, formatBytes, ogFonts, ogJpeg, ogLogo } from '@/lib/og';

// The docs' share card: the terminal is the card. Installing, then using a
// pack, printed the way the CLI prints it (cli/internal/app/use.go): a green
// check, "Downloaded <pack>  N images · size · verified", "Now using <pack>",
// then what's on screen until when. The pack's numbers are real; the time
// is an example.

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = 'Wallpy docs: install Wallpy and use a pack from the terminal';
// Rebuilt daily, so the example pack's numbers stay true.
export const revalidate = 86400;

const EXAMPLE = 'deku-tree';
const MUTED = 'rgba(255,255,255,0.6)', FAINT = 'rgba(255,255,255,0.4)', TEXT = 'rgba(255,255,255,0.92)';

type Part = { t: string; c?: string; b?: boolean };
function Row({ parts }: { parts: Part[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {/* Satori drops spaces between elements, so each part keeps its own gap. */}
      {parts.map((p, i) => <span key={i} style={{ color: p.c ?? TEXT, fontWeight: p.b ? 700 : 400, marginRight: 12 }}>{p.t}</span>)}
    </div>
  );
}
function Done({ parts }: { parts: Part[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      <Row parts={parts} />
    </div>
  );
}

export default async function Image() {
  const [fonts, logo, pack] = await Promise.all([ogFonts(), ogLogo(), getPackShare(EXAMPLE).catch(() => null)]);
  const title = pack?.title ?? 'Deku Tree';
  const install = INSTALL.macos.methods[0].command!;

  const card = new ImageResponse(
    (
      <Ground>
        <div style={at({ top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'radial-gradient(60% 60% at 50% 100%, rgba(211,138,92,0.22) 0%, rgba(17,17,17,0) 100%)' })} />
        <div style={at({ top: 52, left: 64, right: 64, alignItems: 'center', justifyContent: 'space-between' })}>
          <Logo src={logo} size={36} />
          <span style={{ fontFamily: SERIF, fontSize: 48 }}>Docs</span>
        </div>
        <div style={at({ top: 150, left: 64, right: 64, flexDirection: 'column', borderRadius: 20, border: '1px solid rgba(255,255,255,0.14)', background: '#0a0a0a', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' })}>
          <div style={{ display: 'flex', gap: 9, padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 999, background: c }} />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '30px 36px 36px', fontSize: 30 }}>
            <Row parts={[{ t: '$', c: FAINT }, { t: install }]} />
            <Row parts={[{ t: '$', c: FAINT }, { t: `wallpy use ${EXAMPLE}` }]} />
            <Done parts={[{ t: 'Downloaded', c: MUTED }, { t: title }, ...(pack ? [{ t: `${pack.imageCount} images · ${formatBytes(pack.bytes)} · verified`, c: FAINT }] : [])]} />
            <Done parts={[{ t: 'Now using', c: MUTED }, { t: title, b: true }]} />
            <div style={{ display: 'flex', paddingLeft: 34, color: MUTED }}>morning.jpg until 09:41, then day</div>
          </div>
        </div>
      </Ground>
    ),
    { ...size, fonts },
  );
  return ogJpeg(card);
}
