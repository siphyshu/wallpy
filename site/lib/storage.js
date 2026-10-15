// Public URLs for files in the wallpy-public R2 bucket.
//
// Keys are content-addressed (see docs/schema-design.md):
//   blobs/<sha256>                      pack images and renditions
//   profiles/<user_id>/<sha256>.<ext>   avatars and covers
//   artists/<sha256>.<ext>              artist avatars
//
// NEXT_PUBLIC_FILES_BASE_URL is the bucket's custom domain. Until it is set,
// development falls back to /api/dev-files, which streams from R2.

const BASE = (process.env.NEXT_PUBLIC_FILES_BASE_URL || '/api/dev-files').replace(/\/$/, '');

export const PUBLIC_KEY_PATTERN =
  /^(blobs\/[0-9a-f]{64}|profiles\/[0-9a-f-]{36}\/[0-9a-f]{64}\.(jpg|png|webp)|artists\/[0-9a-f]{64}\.(jpg|png|webp))$/;

export function fileUrl(key) {
  return key ? `${BASE}/${key}` : null;
}

export function blobUrl(sha256) {
  return sha256 ? fileUrl(`blobs/${sha256}`) : null;
}
