// Shared by the e2e scripts: throwaway users, test images, uploads, cleanup.
// Everything created here is deleted by cleanup().
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { S3Client, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

export const E = process.env;
export const BASE = E.BASE || 'http://localhost:3000';
export const runId = randomBytes(3).toString('hex');
const REF = new URL(E.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
export const COOKIE_NAME = `sb-${REF}-auth-token`;
export const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
export function check(label, ok, extra = '') {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`);
}
export function summary() {
  const failed = results.filter((ok) => !ok).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  return failed;
}

const created = [];

/** A confirmed user, signed in. `cookie` is @supabase/ssr's auth cookie value. */
export async function makeUser(tag, { role } = {}) {
  const email = `e2e-${tag}-${runId}@example.com`;
  const password = 'E2e-' + randomBytes(9).toString('hex');
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username: `e2e_${tag}_${runId}` },
  });
  if (error) throw error;
  created.push(data.user.id);
  if (role) await admin.from('profiles').update({ role }).eq('id', data.user.id);
  const anon = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const value = 'base64-' + Buffer.from(JSON.stringify(s.session)).toString('base64url');
  return { id: data.user.id, username: `e2e_${tag}_${runId}`, cookieValue: value, cookie: `${COOKIE_NAME}=${value}` };
}

/** A small unique JPEG. */
export async function makeImage(label, rgb = '90,120,200') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="rgb(${rgb})"/><text x="20" y="50" font-size="32" fill="white">${label} ${runId}</text></svg>`;
  const bytes = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export const api = (user, path, body) => fetch(BASE + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(user ? { Cookie: user.cookie } : {}) },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

/** Upload images through the real API (presign, PUT, confirm). */
export async function uploadImages(user, images) {
  const pre = await api(user, '/api/uploads/blobs/presign', {
    files: images.map((i) => ({ sha256: i.sha256, size: i.bytes.length, mime: 'image/jpeg' })),
  });
  for (const p of pre.body.files.filter((f) => !f.exists)) {
    const img = images.find((i) => i.sha256 === p.sha256);
    const put = await fetch(p.url, { method: 'PUT', body: img.bytes, headers: p.headers });
    if (!put.ok) throw new Error(`PUT failed ${put.status}`);
  }
  const tickets = Object.fromEntries(pre.body.files.map((f) => [f.sha256, f.ticket]));
  const conf = await api(user, '/api/uploads/blobs/confirm', {
    files: images.map((i) => ({ sha256: i.sha256, mime: 'image/jpeg', width: 640, height: 360, blurhash: null, ...(tickets[i.sha256] ? { ticket: tickets[i.sha256] } : {}) })),
  });
  if (conf.status !== 200) throw new Error(`confirm failed ${conf.status} ${JSON.stringify(conf.body)}`);
}

const r2 = () => new S3Client({ region: 'auto', endpoint: E.R2_ENDPOINT, credentials: { accessKeyId: E.R2_ACCESS_KEY_ID, secretAccessKey: E.R2_SECRET_ACCESS_KEY } });

/** Delete every user created here, their packs (cascade), blobs, avatars/covers and R2 objects. */
export async function cleanup() {
  const shas = new Set();
  for (const id of created) {
    const { data } = await admin.from('blob_uploads').select('sha256').eq('profile_id', id);
    (data ?? []).forEach((u) => shas.add(u.sha256));
  }
  // Avatars and covers live under profiles/<id>/, outside the blobs table.
  let profileFiles = 0;
  for (const id of created) {
    const listed = await r2().send(new ListObjectsV2Command({ Bucket: 'wallpy-public', Prefix: `profiles/${id}/` }));
    for (const o of listed.Contents ?? []) {
      await r2().send(new DeleteObjectCommand({ Bucket: 'wallpy-public', Key: o.Key }));
      profileFiles++;
    }
  }
  for (const id of created) await admin.auth.admin.deleteUser(id);
  if (shas.size) {
    // Only delete blobs no remaining pack uses (another test could share none, but be safe).
    const list = [...shas];
    const keep = new Set();
    for (const column of ['sha256', 'thumb_sha256', 'preview_sha256']) {
      const { data: inUse } = await admin.from('version_files').select(column).in(column, list);
      (inUse ?? []).forEach((r) => keep.add(r[column]));
    }
    const { data: covers } = await admin.from('pack_versions').select('thumb_sha256, preview_sha256')
      .or(`thumb_sha256.in.(${list}),preview_sha256.in.(${list})`);
    (covers ?? []).forEach((r) => { keep.add(r.thumb_sha256); keep.add(r.preview_sha256); });
    const doomed = list.filter((s) => !keep.has(s));
    await admin.from('blobs').delete().in('sha256', doomed);
    const client = r2();
    for (const s of doomed) await client.send(new DeleteObjectCommand({ Bucket: 'wallpy-public', Key: `blobs/${s}` }));
  }
  console.log(`\ncleaned up ${created.length} users, ${shas.size} blobs, ${profileFiles} profile images`);
}
