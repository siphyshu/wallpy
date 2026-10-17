// Give every pack image a thumbnail (640px) and a preview (1920px) WebP, for
// files stored before uploads made them (migration 20261019120000).
//
//   cd site && node --env-file=.env.local ../supabase/seed/backfill_file_renditions.mjs           # dry run
//   cd site && node --env-file=.env.local ../supabase/seed/backfill_file_renditions.mjs --apply
//
// Idempotent: only files without renditions are touched; renditions already in
// R2 or in `blobs` are reused. Renditions are recorded as blobs uploaded by the
// pack's owner (so they can reuse them in a new version), and the file rows are
// updated with the service role (the API can't change a submitted version).
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(new URL('../../site/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { encode } = require('blurhash');

const E = process.env;
const APPLY = process.argv.includes('--apply');
// --only: just these packs (e.g. to leave e2e tests' packs on the shared database alone).
const ONLY = process.argv.includes('--only') ? new Set(process.argv[process.argv.indexOf('--only') + 1].split(',')) : null;
const BUCKET = 'wallpy-public';
const WIDTHS = { thumb: 640, preview: 1920 }; // as lib/packs/client-upload.ts

const db = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const r2 = new S3Client({
  region: 'auto', endpoint: E.R2_ENDPOINT,
  credentials: { accessKeyId: E.R2_ACCESS_KEY_ID, secretAccessKey: E.R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const exists = (key) => r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).then(() => true, () => false);

/** The original's bytes, or null if it's gone from R2 (e.g. a test pack being cleaned up). */
async function original(sha) {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: `blobs/${sha}` }));
    return Buffer.from(await res.Body.transformToByteArray());
  } catch (e) {
    if (e.name === 'NoSuchKey') return null;
    throw e;
  }
}

/** A WebP rendition, measured: what /api/uploads/blobs/confirm would record. */
async function rendition(source, width) {
  const data = await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const meta = await sharp(data).metadata();
  const { data: px } = await sharp(data).resize(32, 32, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, sha256: sha256(data), width: meta.width, height: meta.height, blurhash: encode(new Uint8ClampedArray(px), 32, 32, 4, 3) };
}

async function store(r, owner) {
  if (!(await exists(`blobs/${r.sha256}`))) {
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET, Key: `blobs/${r.sha256}`, Body: r.data, ContentType: 'image/webp',
      ChecksumSHA256: Buffer.from(r.sha256, 'hex').toString('base64'),
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  }
  const { error: e1 } = await db.from('blobs').upsert(
    { sha256: r.sha256, size: r.data.length, mime: 'image/webp', width: r.width, height: r.height, blurhash: r.blurhash, uploaded_by: owner },
    { onConflict: 'sha256', ignoreDuplicates: true });
  const { error: e2 } = await db.from('blob_uploads').upsert(
    { sha256: r.sha256, profile_id: owner }, { onConflict: 'sha256,profile_id', ignoreDuplicates: true });
  if (e1 || e2) throw e1 ?? e2;
}

const { data: rows, error } = await db
  .from('version_files')
  .select('id, path, sha256, version:pack_versions!version_files_version_id_fkey(number, pack:packs!pack_versions_pack_id_fkey(slug, owner_id))')
  .or('thumb_sha256.is.null,preview_sha256.is.null');
if (error) throw error;
const files = rows.filter((f) => !ONLY || ONLY.has(f.version.pack.slug));
console.log(`${files.length} files without renditions${APPLY ? '' : ' (dry run: add --apply to write)'}`);

let done = 0;
for (const f of files) {
  const label = `${f.version.pack.slug} v${f.version.number} ${f.path}`;
  if (!APPLY) { console.log(`  would render ${label}`); continue; }
  const source = await original(f.sha256);
  if (!source) { console.log(`  skipped ${label}: original not in R2`); continue; }
  const thumb = await rendition(source, WIDTHS.thumb);
  const preview = await rendition(source, WIDTHS.preview);
  await store(thumb, f.version.pack.owner_id);
  await store(preview, f.version.pack.owner_id);
  const { error: e } = await db.from('version_files')
    .update({ thumb_sha256: thumb.sha256, preview_sha256: preview.sha256 }).eq('id', f.id);
  if (e) throw e;
  done += 1;
  console.log(`  ${label}: ${(source.length / 1e6).toFixed(1)} MB -> ${(thumb.data.length / 1e3).toFixed(0)} KB / ${(preview.data.length / 1e3).toFixed(0)} KB`);
}
if (APPLY) console.log(`rendered ${done} files`);
