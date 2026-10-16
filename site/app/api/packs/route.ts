import { NextResponse } from 'next/server';
import { listPublicPacks, type PackSort } from '@/lib/data/packs';
import { createClient } from '@/lib/supabase/server';
import { Submission } from '@/lib/packs/submission';
import { normalizeTag, slugify } from '@/lib/packs/limits';
import { validateSchedule } from '@/lib/spec/validate';
import type { Json } from '@/lib/database.types';
import type { PackKind } from '@/lib/types';

const KINDS: readonly PackKind[] = ['timeblocks', 'days', 'album'];
const SORTS: readonly PackSort[] = ['newest', 'popular', 'rating'];
const oneOf = <T extends string>(allowed: readonly T[], value: string | null): T | undefined =>
  allowed.find((a) => a === value);

/** Gallery listing. Filtering, sorting and pagination happen in the database. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(parseInt(params.get('limit') || '9', 10) || 9, 1), 48);
  const offset = Math.max(parseInt(params.get('offset') || '0', 10) || 0, 0);
  const kind = oneOf(KINDS, params.get('kind'));
  const sort = oneOf(SORTS, params.get('sort')) ?? 'newest';
  const tag = params.get('tag')?.toLowerCase().replace(/\s+/g, '-') || undefined;
  const search = params.get('search')?.trim() || undefined;
  const hideAi = params.get('ai') === 'hide';

  try {
    const { packs, total } = await listPublicPacks({ search, tag, kind, hideAi, sort, limit, offset });
    return NextResponse.json({ packs, total, limit, offset });
  } catch {
    return NextResponse.json({ error: 'Failed to load packs' }, { status: 500 });
  }
}

/**
 * Submit a new pack for review. Images must already be uploaded and confirmed
 * (/api/uploads/blobs/*). Everything is re-validated here, including the full
 * pack spec; create_pack() then writes it atomically as the user (RLS applies).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to upload.' }, { status: 401 });

  const parsed = Submission.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid submission.', issues: parsed.error.issues }, { status: 400 });
  }
  const s = parsed.data;

  const scheduleErrors = validateSchedule(s.schedule, s.files.map((f) => f.path));
  if (scheduleErrors.length) {
    return NextResponse.json({ error: scheduleErrors[0], issues: scheduleErrors }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('create_pack', {
    p: {
      slug: slugify(s.title),
      title: s.title,
      description: s.description,
      tags: [...new Set(s.tags.map(normalizeTag).filter(Boolean))],
      license: s.license,
      license_notes: s.license_notes,
      ai_use: s.ai_use,
      uploader_is_artist: s.uploader_is_artist,
      artist: s.uploader_is_artist ? null : s.artist,
      schedule: s.schedule as Json,
      files: s.files,
      cover: s.cover,
      thumb_sha256: s.thumb_sha256,
      preview_sha256: s.preview_sha256,
      submit: true,
    },
  });
  if (error) {
    console.error('create_pack:', error);
    // Ownership and integrity failures come back from the database.
    const status = error.code === '42501' ? 403 : error.code === '23514' ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? 'Could not create the pack.' : error.message }, { status });
  }
  return NextResponse.json(data, { status: 201 });
}
