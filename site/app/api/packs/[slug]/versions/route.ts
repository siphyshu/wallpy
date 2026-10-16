import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseSubmission, toRpcPayload } from '@/lib/packs/submission';

/**
 * Submit a new version of one of your packs: changes after a rejection, or an
 * update to a published pack (it replaces the current version once approved).
 * Same body and checks as POST /api/packs; create_version() checks ownership.
 */
export async function POST(request: Request, { params }: RouteContext<'/api/packs/[slug]/versions'>) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to upload.' }, { status: 401 });

  const result = parseSubmission(await request.json().catch(() => null));
  if (!result.ok) return NextResponse.json({ error: result.error, issues: result.issues }, { status: 400 });

  const { data, error } = await supabase.rpc('create_version', { p_slug: slug, p: toRpcPayload(result.submission) });
  if (error) {
    // P0002: not the caller's pack. 23505: pack_versions_one_open, a version is already in review.
    if (error.code === 'P0002') return NextResponse.json({ error: 'Pack not found.' }, { status: 404 });
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A version of this pack is already waiting for review.' }, { status: 409 });
    }
    console.error('create_version:', error);
    const status = error.code === '42501' ? 403 : error.code === '23514' ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? 'Could not save the new version.' : error.message }, { status });
  }
  return NextResponse.json(data, { status: 201 });
}
