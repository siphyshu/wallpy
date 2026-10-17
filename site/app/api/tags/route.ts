import { NextResponse } from 'next/server';
import { listPublicTags } from '@/lib/data/packs';

/** Tags already used on public packs, most used first (the upload form's autocomplete). */
export async function GET() {
  const tags = await listPublicTags();
  return NextResponse.json({ tags }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
