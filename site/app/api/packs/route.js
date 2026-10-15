import { NextResponse } from 'next/server';
import { listPublicPacks } from '@/lib/data/packs';

const KINDS = new Set(['timeblocks', 'days', 'album']);
const SORTS = new Set(['newest', 'popular', 'rating']);

/** Gallery listing. Filtering, sorting and pagination happen in the database. */
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(parseInt(params.get('limit') || '9', 10) || 9, 1), 48);
  const offset = Math.max(parseInt(params.get('offset') || '0', 10) || 0, 0);
  const kind = KINDS.has(params.get('kind')) ? params.get('kind') : undefined;
  const sort = SORTS.has(params.get('sort')) ? params.get('sort') : 'newest';
  const tag = params.get('tag')?.toLowerCase().replace(/\s+/g, '-') || undefined;
  const search = params.get('search')?.trim() || undefined;

  try {
    const { packs, total } = await listPublicPacks({ search, tag, kind, sort, limit, offset });
    return NextResponse.json({ packs, total, limit, offset });
  } catch {
    return NextResponse.json({ error: 'Failed to load packs' }, { status: 500 });
  }
}

// Uploading is being rebuilt for content-addressed storage (docs/schema-design.md).
export async function POST() {
  return NextResponse.json({ error: 'Uploading is temporarily unavailable while it is rebuilt.' }, { status: 503 });
}
