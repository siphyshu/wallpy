import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { headObject, presignPut } from '@/lib/r2';
import { IMAGE_MIMES, PACK_LIMITS } from '@/lib/packs/limits';
import { issueTicket } from '@/lib/packs/tickets';

const Body = z.object({
  files: z
    .array(z.object({
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      size: z.number().int().positive().max(PACK_LIMITS.maxFileBytes),
      mime: z.enum(IMAGE_MIMES),
    }))
    .min(1)
    .max(PACK_LIMITS.maxFiles + 2), // + thumbnail and preview renditions
});

/**
 * Step 1 of uploading pack images. For each file (by SHA-256): if it's stored
 * and the user may already use it (public, or they uploaded it before), skip
 * it. Otherwise return a PUT URL that only accepts exactly that file (hash,
 * type and size are signed, see lib/r2.ts) plus a ticket for /confirm, even
 * when someone else already stored it: uploading the bytes is how a user
 * proves they have the file (lib/packs/tickets.ts).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to upload.' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });

  const files = await Promise.all(
    parsed.data.files.map(async (f) => {
      const key = `blobs/${f.sha256}`;
      const [stored, usable] = await Promise.all([headObject(key), supabase.rpc('can_use_blob', { s: f.sha256 })]);
      if (stored && usable.data === true) return { sha256: f.sha256, exists: true as const };
      return {
        sha256: f.sha256,
        exists: false as const,
        ticket: issueTicket(f.sha256, user.id, stored?.lastModified?.getTime() ?? 0),
        ...(await presignPut({ key, sha256: f.sha256, mime: f.mime, size: f.size })),
      };
    }),
  );
  return NextResponse.json({ files });
}
