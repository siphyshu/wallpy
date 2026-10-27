// Builds the site's icons from the logo (public/waves.png).
// Run from site/: node scripts/icons.mjs
//
//   app/favicon.ico      16, 32 and 48px, for browser tabs (Google wants a multiple of 48)
//   app/icon.png         512px, transparent
//   app/apple-icon.png   180px on the site's dark ground (iOS fills transparency with black)
//   public/icon-192.png  for the web manifest
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const LOGO = 'public/waves.png';
const GROUND = '#111111';

const png = (size) => sharp(LOGO).resize(size, size).png({ palette: true, quality: 90, effort: 10 }).toBuffer();

/** Pads the logo onto an opaque square, so home-screen icons don't touch the edges. */
async function onGround(size, inset) {
  const inner = Math.round(size * (1 - 2 * inset));
  return sharp({ create: { width: size, height: size, channels: 4, background: GROUND } })
    .composite([{ input: await png(inner), gravity: 'center' }])
    .png()
    .toBuffer();
}

/** An .ico holding PNG images (supported by every browser since Vista-era IE). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size % 256, entry); // 0 means 256
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })));
await writeFile('app/favicon.ico', ico(images));
await writeFile('app/icon.png', await png(512));
await writeFile('app/apple-icon.png', await onGround(180, 0.1));
await writeFile('public/icon-192.png', await png(192));
console.log('Wrote app/favicon.ico, app/icon.png, app/apple-icon.png, public/icon-192.png');
