// Seed packs into production as siphyshu, through the site's real API (same
// calls as the upload wizard), then approve them with moderate().
//   cd site && node --env-file=.env.local scripts/seed-packs.mjs --dir <folder of pack folders> [--only slug,slug] [--no-approve]
// Each pack folder holds schedule.toml (spec 2, with name/author/description) and images/.
// PACKS below is the 2026-10-20 seeding; edit it for the next batch.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(new URL('../package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const { encode } = require('blurhash');
const TOML = require('@iarna/toml');

const E = process.env;
const BASE = 'https://wallpy.siphyshu.me';
const args = process.argv.slice(2);
const UPLOAD = args.includes('--dir') ? path.resolve(args[args.indexOf('--dir') + 1]) : null;
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const approve = !args.includes('--no-approve');

const DISNEY = { name: 'Disney Television Animation', url: '' };
const PACKS = [
  { dir: 'deku-tree', cover: 'day.jpg', tags: ['zelda', 'ocarina-of-time', 'fan-art'], categories: ['games', 'illustration'],
    artist: { name: 'Matt Vince', url: 'https://mattvince.com' } },
  { dir: 'a-day-in-the-village', cover: 'night.jpg', tags: ['village', 'waterfall', '3d'], categories: ['landscapes', 'illustration'],
    artist: { name: 'lsr CG', url: '' }, license_notes: 'Original title 村庄的一天. Source: dynamicwallpaper.club/wallpaper/50no7ur8dnk' },
  { dir: 'desert-sands', cover: 'golden.jpg', tags: ['desert', 'aurora', '3d'], categories: ['landscapes'],
    artist: { name: 'Louis Coyle', url: 'https://dribbble.com/shots/16805445-Desert-Sands-Dynamic-Wallpaper' } },
  { dir: 'watchmaker-house', cover: 'day.jpg', tags: ['interior', 'clocks', 'visual-novel'], categories: ['anime', 'illustration'],
    artist: { name: 'ArseniXC', url: 'https://www.deviantart.com/arsenixc' } },
  { dir: 'mystery-shack-porch', cover: 'day.jpg', tags: ['gravity-falls', 'forest', 'cartoon'], categories: ['illustration'], artist: DISNEY },
  // New versions of live packs.
  { dir: 'tokyo-street', slug: 'tokyo-street', cover: 'golden-hour.jpg', tags: ['street', 'digital-art', 'japan'], categories: ['anime', 'cities'],
    artist: { name: 'ArseniXC', url: 'https://www.deviantart.com/arsenixc' } },
  { slug: 'greasy-diner', title: 'Greasy Diner', reuse: true, tags: ['gravity-falls', 'diner', 'cartoon'], categories: ['illustration', 'landscapes'],
    description: "Greasy's Diner from Gravity Falls, from a misty night to a sunny afternoon.", artist: DISNEY },
];

const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const REF = new URL(E.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

// A session for siphyshu without a password or an email: a magic-link token, verified directly.
const { data: prof } = await admin.from('profiles').select('id').eq('username', 'siphyshu').single();
const { data: { user } } = await admin.auth.admin.getUserById(prof.id);
const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
if (le) throw le;
const me = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: auth, error: ve } = await me.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
if (ve) throw ve;
const cookie = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;
console.log('signed in as siphyshu');

const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) })
  .then(async (r) => { const b = await r.json().catch(() => null); if (!r.ok) throw new Error(`${p} ${r.status} ${JSON.stringify(b)}`); return b; });

const sha = (b) => createHash('sha256').update(b).digest('hex');
async function measure(bytes, mime) {
  const img = sharp(bytes);
  const { width, height } = await img.metadata();
  const { data } = await sharp(bytes).resize(32, 32, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { bytes, mime, sha256: sha(bytes), width, height, blurhash: encode(new Uint8ClampedArray(data), 32, 32, 4, 3) };
}
// As the wizard: a 640px thumbnail and a 1920px preview, WebP at 0.82.
const rendition = (bytes, w) => sharp(bytes).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();

async function uploadAll(blobs) {
  const unique = [...new Map(blobs.map((b) => [b.sha256, b])).values()];
  const { files } = await post('/api/uploads/blobs/presign', { files: unique.map((m) => ({ sha256: m.sha256, size: m.bytes.length, mime: m.mime })) });
  const todo = files.filter((f) => !f.exists);
  for (const p of todo) {
    const m = unique.find((u) => u.sha256 === p.sha256);
    const r = await fetch(p.url, { method: 'PUT', body: m.bytes, headers: p.headers });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
  }
  const tickets = new Map(todo.map((p) => [p.sha256, p.ticket]));
  await post('/api/uploads/blobs/confirm', { files: unique.map((m) => ({ sha256: m.sha256, mime: m.mime, width: m.width, height: m.height, blurhash: m.blurhash, ...(tickets.has(m.sha256) ? { ticket: tickets.get(m.sha256) } : {}) })) });
  return `${todo.length} uploaded, ${unique.length - todo.length} already stored`;
}

for (const p of PACKS) {
  const key = p.slug ?? p.dir;
  if (only && !only.includes(key)) continue;
  let body;
  if (p.reuse) {
    // Same images and schedule as the live version; only the details change.
    const { data: pk } = await admin.from('packs').select('current_version_id').eq('slug', p.slug).single();
    const { data: v } = await admin.from('pack_versions').select('schedule, license, ai_use, cover_file_id, thumb_sha256, preview_sha256').eq('id', pk.current_version_id).single();
    const { data: vf } = await admin.from('version_files').select('id, path, sha256, thumb_sha256, preview_sha256').eq('version_id', pk.current_version_id).order('sort_order');
    body = { title: p.title, description: p.description, tags: p.tags, categories: p.categories, license: v.license, ai_use: v.ai_use,
      uploader_is_artist: false, artist: p.artist, schedule: v.schedule,
      files: vf.map((f) => ({ path: f.path, sha256: f.sha256, ...(f.thumb_sha256 ? { thumb_sha256: f.thumb_sha256, preview_sha256: f.preview_sha256 } : {}) })),
      cover: vf.find((f) => f.id === v.cover_file_id)?.path, thumb_sha256: v.thumb_sha256 ?? undefined, preview_sha256: v.preview_sha256 ?? undefined };
    console.log(`\n${key}: reusing ${vf.length} images`);
  } else {
    if (!UPLOAD) throw new Error('--dir is required for new packs');
    const dir = path.join(UPLOAD, p.dir);
    const schedule = JSON.parse(JSON.stringify(TOML.parse(fs.readFileSync(path.join(dir, 'schedule.toml'), 'utf8'))));
    const names = fs.readdirSync(path.join(dir, 'images')).filter((n) => n.endsWith('.jpg')).sort();
    const blobs = [], files = [];
    for (const n of names) {
      const bytes = fs.readFileSync(path.join(dir, 'images', n));
      const [o, t, pr] = await Promise.all([measure(bytes, 'image/jpeg'), rendition(bytes, 640).then((b) => measure(b, 'image/webp')), rendition(bytes, 1920).then((b) => measure(b, 'image/webp'))]);
      blobs.push(o, t, pr);
      files.push({ path: n, sha256: o.sha256, thumb_sha256: t.sha256, preview_sha256: pr.sha256 });
    }
    // Files in schedule order, so the pack page lists them as they show.
    const order = schedule.slot.flatMap((s) => s.images);
    files.sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));
    console.log(`\n${key}: ${names.length} images, ${await uploadAll(blobs)}`);
    const c = files.find((f) => f.path === p.cover);
    body = { title: schedule.name, description: schedule.description, tags: p.tags, categories: p.categories, license: 'personal-use',
      license_notes: p.license_notes ?? '', ai_use: 'none', uploader_is_artist: false, artist: p.artist, schedule, files,
      cover: p.cover, thumb_sha256: c.thumb_sha256, preview_sha256: c.preview_sha256 };
  }
  const res = await post(p.slug ? `/api/packs/${p.slug}/versions` : '/api/packs', body);
  console.log(`  submitted: ${res.slug} (${res.status})`);
  if (!approve) continue;
  const { data: pk } = await admin.from('packs').select('id').eq('slug', res.slug).single();
  const { data: pend } = await admin.from('pack_versions').select('id, number').eq('pack_id', pk.id).eq('status', 'pending').single();
  const { error } = await me.rpc('moderate', { p_version: pend.id, p_action: 'approve' });
  if (error) throw error;
  console.log(`  approved v${pend.number}: ${BASE}/packs/${res.slug}`);
}
