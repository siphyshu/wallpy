// End-to-end test of the upload API: a running site (BASE, default
// http://localhost:3000) against the Supabase project and R2 bucket in
// .env.local. Creates two throwaway users and two small images, and deletes
// them afterwards. Run on purpose only:  npm run test:e2e:api
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const E = process.env;
const BASE = E.BASE || 'http://localhost:3000';
const REF = new URL(E.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const results = [];
const check = (label, ok, extra = '') => { results.push([ok, label]); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); };

// @supabase/ssr's cookie format: "base64-" + base64url(session JSON), chunked at 3180 chars.
function authCookie(session) {
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
  const name = `sb-${REF}-auth-token`;
  if (value.length <= 3180) return `${name}=${value}`;
  const chunks = value.match(/.{1,3180}/g);
  return chunks.map((c, i) => `${name}.${i}=${c}`).join('; ');
}

async function makeUser(tag) {
  const email = `e2e-${tag}-${randomBytes(3).toString('hex')}@example.com`;
  const password = 'E2e-' + randomBytes(9).toString('hex');
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username: `e2e_${tag}_${randomBytes(2).toString('hex')}` },
  });
  if (error) throw error;
  const anon = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, cookie: authCookie(s.session) };
}

const api = (user, path, body) => fetch(BASE + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Cookie: user.cookie } : {}) }, body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

// Unique tiny JPEGs per run (via sharp, which Next.js already depends on).
const sharp = require('sharp');
const runId = randomBytes(4).toString('hex');
const images = {};
for (const [name, rgb] of [['sunrise', [250, 160, 80]], ['night', [20, 30, 70]]]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="rgb(${rgb})"/><text x="10" y="30" fill="white">e2e ${name} ${runId}</text></svg>`;
  images[name] = await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}
const file = (name) => {
  const bytes = images[name];
  return { name: `${name}.jpg`, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
};
const meta = (f) => ({ sha256: f.sha256, mime: 'image/jpeg', width: 320, height: 180, blurhash: null });

const users = [];
try {
  const alice = await makeUser('alice'); users.push(alice);
  const bob = await makeUser('bob'); users.push(bob);
  const sunrise = file('sunrise'), night = file('night');

  // --- anonymous ---
  check('anon cannot presign', (await api(null, '/api/uploads/blobs/presign', { files: [{ sha256: sunrise.sha256, size: 1, mime: 'image/jpeg' }] })).status === 401);
  check('rejects non-image types', (await api(alice, '/api/uploads/blobs/presign', { files: [{ sha256: sunrise.sha256, size: 10, mime: 'text/html' }] })).status === 400);
  check('rejects files over 30 MB', (await api(alice, '/api/uploads/blobs/presign', { files: [{ sha256: sunrise.sha256, size: 31 * 1024 * 1024, mime: 'image/jpeg' }] })).status === 400);

  // --- alice uploads two images ---
  const pre = await api(alice, '/api/uploads/blobs/presign', {
    files: [sunrise, night].map((f) => ({ sha256: f.sha256, size: f.bytes.length, mime: 'image/jpeg' })),
  });
  check('presign returns upload URLs + tickets', pre.status === 200 && pre.body.files.every((f) => f.url && f.ticket));
  check('confirm before uploading is refused', (await api(alice, '/api/uploads/blobs/confirm', {
    files: pre.body.files.map((p) => ({ ...meta(p.sha256 === sunrise.sha256 ? sunrise : night), ticket: p.ticket })),
  })).status === 409);
  for (const p of pre.body.files) {
    const f = p.sha256 === sunrise.sha256 ? sunrise : night;
    const put = await fetch(p.url, { method: 'PUT', body: f.bytes, headers: p.headers });
    check(`PUT ${f.name} to R2`, put.ok, String(put.status));
  }
  const conf = await api(alice, '/api/uploads/blobs/confirm', {
    files: pre.body.files.map((p) => ({ ...meta(p.sha256 === sunrise.sha256 ? sunrise : night), ticket: p.ticket })),
  });
  check('confirm after uploading', conf.status === 200, JSON.stringify(conf.body).slice(0, 80));
  const again = await api(alice, '/api/uploads/blobs/presign', { files: [{ sha256: sunrise.sha256, size: sunrise.bytes.length, mime: 'image/jpeg' }] });
  check('re-uploading a file you own is skipped', again.body.files[0].exists === true);

  // --- bob tries to claim alice's private image by hash ---
  check('claiming by hash alone is refused (no ticket)', (await api(bob, '/api/uploads/blobs/confirm', { files: [meta(sunrise)] })).status === 409);
  const bobPre = await api(bob, '/api/uploads/blobs/presign', { files: [{ sha256: sunrise.sha256, size: sunrise.bytes.length, mime: 'image/jpeg' }] });
  check('someone else\'s private blob is not skipped for bob', bobPre.body.files[0].exists === false);
  check('a ticket without a fresh upload is refused', (await api(bob, '/api/uploads/blobs/confirm', {
    files: [{ ...meta(sunrise), ticket: bobPre.body.files[0].ticket }],
  })).status === 409);
  const forged = `${Date.now()}.0.${'0'.repeat(64)}`;
  check('a forged ticket is refused', (await api(bob, '/api/uploads/blobs/confirm', { files: [{ ...meta(sunrise), ticket: forged }] })).status === 409);
  await new Promise((r) => setTimeout(r, 1100));
  const bobPut = await fetch(bobPre.body.files[0].url, { method: 'PUT', body: sunrise.bytes, headers: bobPre.body.files[0].headers });
  const bobConf = await api(bob, '/api/uploads/blobs/confirm', { files: [{ ...meta(sunrise), ticket: bobPre.body.files[0].ticket }] });
  check('bob CAN claim it by actually uploading the same bytes', bobPut.ok && bobConf.status === 200);

  // --- alice submits a pack ---
  const schedule = { spec: 2, name: 'E2E Test Pack', slot: [
    { label: 'day', at: 'sunrise', images: ['sunrise.jpg'] }, { label: 'night', at: 'sunset', images: ['night.jpg'] }] };
  const base = {
    title: 'E2E Test Pack', description: 'Automated test, deleted afterwards.', tags: ['Test Tag'], ai_use: 'none',
    uploader_is_artist: true, schedule, files: [{ path: 'sunrise.jpg', sha256: sunrise.sha256 }, { path: 'night.jpg', sha256: night.sha256 }],
  };
  check('missing AI answer is refused', (await api(alice, '/api/packs', { ...base, ai_use: undefined })).status === 400);
  const bad = await api(alice, '/api/packs', { ...base, schedule: { ...schedule, slot: [...schedule.slot].reverse() } });
  check('out-of-order schedule is refused by the spec validator', bad.status === 400, bad.body?.error);
  const unused = await api(alice, '/api/packs', { ...base, files: [...base.files, { path: 'extra.jpg', sha256: night.sha256 }] });
  check('a file the schedule doesn\'t use is refused', unused.status === 400, unused.body?.error);
  const created = await api(alice, '/api/packs', base);
  check('valid submission is created and pending', created.status === 201 && created.body.status === 'pending', JSON.stringify(created.body));
  const { data: row } = await admin.from('packs').select('slug, owner_id, versions:pack_versions!pack_versions_pack_id_fkey(status, kind, ai_use, tags)').eq('slug', created.body.slug).single();
  check('stored as pending, kind derived, tag normalised', row?.versions?.[0]?.status === 'pending' && row.versions[0].kind === 'timeblocks' && row.versions[0].tags[0] === 'test-tag', JSON.stringify(row?.versions));
  const pub = await fetch(`${BASE}/api/packs/${created.body.slug}/manifest`);
  check('pending pack is not public', pub.status === 404);
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  // Clean up: deleting the users cascades to profiles, packs, versions, files, blob_uploads.
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
  const shas = ['sunrise', 'night'].map((n) => file(n).sha256);
  await admin.from('blobs').delete().in('sha256', shas);
  const r2 = new S3Client({ region: 'auto', endpoint: E.R2_ENDPOINT, credentials: { accessKeyId: E.R2_ACCESS_KEY_ID, secretAccessKey: E.R2_SECRET_ACCESS_KEY } });
  for (const s of shas) await r2.send(new DeleteObjectCommand({ Bucket: 'wallpy-public', Key: `blobs/${s}` }));
  console.log(`\ncleaned up ${users.length} users, ${shas.length} blobs`);
  const failed = results.filter(([ok]) => !ok).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
