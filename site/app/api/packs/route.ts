import { NextResponse } from 'next/server';
import { listPublicPacks, type PackSort } from '@/lib/data/packs';
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

// Uploading is being rebuilt for content-addressed storage (docs/schema-design.md).
export async function POST() {
  return NextResponse.json({ error: 'Uploading is temporarily unavailable while it is rebuilt.' }, { status: 503 });
}
