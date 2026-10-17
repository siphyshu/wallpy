import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteObject, presignPut, type ImageMime } from '@/lib/r2';

const EXT: Record<ImageMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const isImageMime = (m: unknown): m is ImageMime => typeof m === 'string' && m in EXT;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Sign an upload of the caller's avatar or cover. The key is derived from the
 * caller's id and the file's SHA-256, never from client input, so nobody can
 * write into another user's folder or overwrite an existing file.
 *
 * Body: { sha256, size, mime }  ->  { key, url, headers }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to upload.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { sha256, size, mime } = body;
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
    return NextResponse.json({ error: 'Invalid checksum.' }, { status: 400 });
  }
  if (!isImageMime(mime)) {
    return NextResponse.json({ error: 'Use a JPEG, PNG or WebP image.' }, { status: 400 });
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: 'Images must be under 5 MB.' }, { status: 400 });
  }

  const key = `profiles/${user.id}/${sha256}.${EXT[mime]}`;
  const { url, headers } = await presignPut({ key, sha256, mime, size });
  return NextResponse.json({ key, url, headers });
}

/**
 * Delete avatar/cover files the caller no longer uses (after removing or
 * replacing one). Only keys in the caller's own folder that their profile
 * doesn't point at are deleted.
 *
 * Body: { keys: string[] }  ->  { deleted: string[] }
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const keys: unknown = body.keys;
  if (!Array.isArray(keys) || keys.length > 4) {
    return NextResponse.json({ error: 'Invalid keys.' }, { status: 400 });
  }
  const own = new RegExp(`^profiles/${user.id}/[0-9a-f]{64}\\.(jpg|png|webp)$`);
  const { data: profile } = await supabase.from('profiles').select('avatar_key, cover_key').eq('id', user.id).single();
  const inUse = new Set([profile?.avatar_key, profile?.cover_key]);
  const doomed = keys.filter((k): k is string => typeof k === 'string' && own.test(k) && !inUse.has(k));
  await Promise.all(doomed.map((k) => deleteObject(k)));
  return NextResponse.json({ deleted: doomed });
}
