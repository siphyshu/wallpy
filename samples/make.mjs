import { createRequire } from 'node:module';
// Makes the sample packs in this folder (images + spec 2 schedule.toml).
//   node samples/make.mjs        (uses sharp from site/node_modules)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = dirname(fileURLToPath(import.meta.url));
const require = createRequire(`${OUT}/../site/package.json`);
const sharp = require('sharp');
const W = 1920, H = 1080;

// A harbour scene: sky gradient, sun or moon, hills, water with a reflection, boats.
function harbour({ sky, sunY, sunColor, moon, water, hill, light, stars, label }) {
  const starDots = stars ? Array.from({ length: 140 }, (_, i) => {
    const x = (i * 7919) % W, y = (i * 104729) % 520, r = (i % 3) * 0.7 + 0.6;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${0.35 + (i % 5) / 10}"/>`;
  }).join('') : '';
  const windows = light ? Array.from({ length: 18 }, (_, i) =>
    `<rect x="${300 + i * 72}" y="${640 + (i % 3) * 14}" width="10" height="14" fill="#ffd27a" opacity="0.9"/>`).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${sky.map((c, i) => `<stop offset="${i / (sky.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${water[0]}"/><stop offset="1" stop-color="${water[1]}"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${sunColor}" stop-opacity="0.55"/><stop offset="1" stop-color="${sunColor}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sky)"/>
  ${starDots}
  <circle cx="1320" cy="${sunY}" r="260" fill="url(#glow)"/>
  <circle cx="1320" cy="${sunY}" r="${moon ? 54 : 78}" fill="${sunColor}"/>
  ${moon ? `<circle cx="1342" cy="${sunY - 14}" r="50" fill="${sky[0]}"/>` : ''}
  <path d="M0 640 Q240 520 520 600 T1060 580 T1520 610 T1920 560 V700 H0Z" fill="${hill[0]}"/>
  <path d="M0 680 Q300 600 640 660 T1300 650 T1920 640 V720 H0Z" fill="${hill[1]}"/>
  ${windows}
  <rect y="700" width="100%" height="380" fill="url(#sea)"/>
  ${Array.from({ length: 12 }, (_, i) => `<rect x="${1320 - (110 - i * 7)}" y="${716 + i * 22}" width="${2 * (110 - i * 7)}" height="5" rx="2.5" fill="${sunColor}" opacity="${(0.32 - i * 0.025).toFixed(2)}"/>`).join('')}
  ${[0, 1, 2].map((i) => `<g transform="translate(${420 + i * 380} ${780 + i * 40})"><path d="M0 0 H150 L125 30 H25Z" fill="${hill[1]}"/><path d="M70 0 V-90 L120 -10Z" fill="${hill[0]}" opacity="0.9"/></g>`).join('')}
  <text x="60" y="${H - 60}" font-family="Helvetica, Arial" font-size="34" fill="white" opacity="0.55">${label}</text>
</svg>`;
}

const daypack = {
  'dawn.jpg': { sky: ['#2a2f5e', '#b0637a', '#f4b183'], sunY: 690, sunColor: '#ffd1a1', water: ['#5b5a7e', '#262a4a'], hill: ['#3b3552', '#2a2540'], light: true, label: 'Harbour Lights · dawn' },
  'morning.jpg': { sky: ['#5fa8e8', '#a9d4f5', '#e7f4fb'], sunY: 330, sunColor: '#fff4c9', water: ['#3d8fc4', '#1d5b8a'], hill: ['#5f8a5a', '#4a7346'], label: 'Harbour Lights · morning' },
  'afternoon.jpg': { sky: ['#3f8fd8', '#8cc4ef', '#d2ebfa'], sunY: 180, sunColor: '#fffbe6', water: ['#2f84bd', '#165078'], hill: ['#56804f', '#40693d'], label: 'Harbour Lights · afternoon' },
  'sunset.jpg': { sky: ['#40306b', '#d0567a', '#ffa45c'], sunY: 640, sunColor: '#ffb070', water: ['#8a4a6a', '#2e2448'], hill: ['#4a2f4f', '#33223c'], light: true, label: 'Harbour Lights · sunset' },
  'night.jpg': { sky: ['#070b1e', '#131b3d', '#24305c'], sunY: 230, sunColor: '#e8ecff', moon: true, water: ['#15204a', '#060a1a'], hill: ['#101530', '#0a0e22'], light: true, stars: true, label: 'Harbour Lights · night' },
};
// For testing "upload a new version": a late-night image to add.
const extra = { 'midnight.jpg': { sky: ['#03040c', '#0a0f26', '#141c3c'], sunY: 140, sunColor: '#f2f4ff', moon: true, water: ['#0b1230', '#03050f'], hill: ['#080b1c', '#050714'], stars: true, label: 'Harbour Lights · midnight (extra)' } };

// Weekpack: one flat colour field per day, simple and easy to tell apart.
const days = [
  ['mon', 'Monday', ['#1f4e79', '#4a90c2']], ['tue', 'Tuesday', ['#5b2a86', '#a46bd6']], ['wed', 'Wednesday', ['#1d6b52', '#4fc08d']],
  ['thu', 'Thursday', ['#8a3b12', '#e0893f']], ['fri', 'Friday', ['#7a1f3d', '#e05a87']], ['sat', 'Saturday', ['#7a6a12', '#f0d64a']], ['sun', 'Sunday', ['#2d2d2d', '#8a8a8a']],
];
const weekSvg = (name, [a, b]) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${Array.from({ length: 9 }, (_, i) => `<circle cx="${200 + i * 210}" cy="${300 + ((i * 137) % 480)}" r="${60 + (i % 4) * 40}" fill="white" opacity="0.06"/>`).join('')}
  <text x="120" y="${H - 140}" font-family="Georgia, serif" font-size="150" fill="white" opacity="0.9">${name}</text>
  <text x="126" y="${H - 80}" font-family="Helvetica, Arial" font-size="34" fill="white" opacity="0.55">Colour Week</text>
</svg>`;

async function save(dir, name, svg) {
  mkdirSync(dir, { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toFile(`${dir}/${name}`);
}
for (const [name, o] of Object.entries(daypack)) await save(`${OUT}/harbour-lights/images`, name, harbour(o));
for (const [name, o] of Object.entries(extra)) await save(`${OUT}/harbour-lights/for-new-version`, name, harbour(o));
for (const [id, name, colours] of days) await save(`${OUT}/colour-week/images`, `${id}.jpg`, weekSvg(name, colours));

writeFileSync(`${OUT}/harbour-lights/schedule.toml`, `spec = 2
name = "Harbour Lights"
description = "A small harbour through the day: dawn, morning, afternoon, sunset and night."

[[slot]]
label = "dawn"
at = "dawn"
images = ["dawn.jpg"]

[[slot]]
label = "morning"
at = "sunrise+1h"
images = ["morning.jpg"]

[[slot]]
label = "afternoon"
at = "noon"
images = ["afternoon.jpg"]

[[slot]]
label = "sunset"
at = "sunset-45m"
images = ["sunset.jpg"]

[[slot]]
label = "night"
at = "dusk+30m"
images = ["night.jpg"]
`);
writeFileSync(`${OUT}/colour-week/schedule.toml`, `spec = 2
name = "Colour Week"
description = "A different colour for each day of the week."
${days.map(([id]) => `
[[slot]]
label = "${id}"
days = ["${id}"]
images = ["${id}.jpg"]
`).join('')}`);
console.log('done');
