import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { headObject } from '@/lib/r2';
import { IMAGE_MIMES, PACK_LIMITS } from '@/lib/packs/limits';
import { ticketProvesUpload } from '@/lib/packs/tickets';

const Body = z.object({
  files: z
    .array(z.object({
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      mime: z.enum(IMAGE_MIMES),
      width: z.number().int().min(1).max(20000),
      height: z.number().int().min(1).max(20000),
      blurhash: z.string().max(100).nullable(),
      /** from /presign; omitted for files the user could already use */
      ticket: z.string().max(200).optional(),
    }))
    .min(1)
    .max(PACK_LIMITS.maxUploadBlobs),
});

/**
 * Step 2: after uploading, record the files. Each object must exist in R2
 * with the declared type (its bytes match its key: uploads are hash-pinned),
 * and the user must have proved they uploaded it (a valid ticket and a fresh
 * write, lib/packs/tickets.ts) unless they could already use it. Records the
 * blob (once) and this user as an uploader, which lets them put it in a pack.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to upload.' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid confirm request.' }, { status: 400 });

  const checked = await Promise.all(
    parsed.data.files.map(async (f) => {
      const [head, usable] = await Promise.all([
        headObject(`blobs/${f.sha256}`),
        supabase.rpc('can_use_blob', { s: f.sha256 }),
      ]);
      const proven = usable.data === true || (f.ticket !== undefined && ticketProvesUpload(f.ticket, f.sha256, user.id, head?.lastModified));
      return { f, head, ok: Boolean(head && head.contentType === f.mime && proven) };
    }),
  );
  const missing = checked.filter((c) => !c.ok).map((c) => c.f.sha256);
  if (missing.length) {
    return NextResponse.json({ error: 'Some files did not finish uploading.', missing }, { status: 409 });
  }

  const admin = createAdminClient();
  const { error: blobError } = await admin.from('blobs').upsert(
    checked.map(({ f, head }) => ({
      sha256: f.sha256, size: head!.size, mime: f.mime, width: f.width, height: f.height,
      blurhash: f.blurhash, uploaded_by: user.id,
    })),
    { onConflict: 'sha256', ignoreDuplicates: true },
  );
  const { error: uploadError } = await admin.from('blob_uploads').upsert(
    checked.map(({ f }) => ({ sha256: f.sha256, profile_id: user.id })),
    { onConflict: 'sha256,profile_id', ignoreDuplicates: true },
  );
  if (blobError || uploadError) {
    console.error('confirm uploads:', blobError ?? uploadError);
    return NextResponse.json({ error: 'Could not record the upload.' }, { status: 500 });
  }
  return NextResponse.json({ confirmed: checked.map(({ f }) => f.sha256) });
}
