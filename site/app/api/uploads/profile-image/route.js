import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { presignPut } from '@/lib/r2';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Sign an upload of the caller's avatar or cover. The key is derived from the
 * caller's id and the file's SHA-256, never from client input, so nobody can
 * write into another user's folder or overwrite an existing file.
 *
 * Body: { sha256, size, mime }  ->  { key, url, headers }
 */
export async function POST(request) {
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
  if (!EXT[mime]) {
    return NextResponse.json({ error: 'Use a JPEG, PNG or WebP image.' }, { status: 400 });
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: 'Images must be under 5 MB.' }, { status: 400 });
  }

  const key = `profiles/${user.id}/${sha256}.${EXT[mime]}`;
  const { url, headers } = await presignPut({ key, sha256, mime, size });
  return NextResponse.json({ key, url, headers });
}
