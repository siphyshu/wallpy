import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPackBySlug } from '@/lib/data/packs';
import { recordDownload } from '@/lib/downloads';
import type { Manifest } from '@/lib/types';

/**
 * Everything needed to install a pack: its schedule and every file with its
 * SHA-256, so clients can verify what they download. Used by the CLI (`wallpy use`, `get`, `show`)
 * and by the website's "Download ZIP" button (which zips in the browser).
 *
 *   GET /api/packs/<slug>/manifest              read only
 *   GET /api/packs/<slug>/manifest?download=cli count a download (cli | web)
 */
export async function GET(request: Request, { params }: RouteContext<'/api/packs/[slug]/manifest'>) {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const absolute = (url: string) => (url.startsWith('/') ? `${origin}${url}` : url);

  const client = new URL(request.url).searchParams.get('download');
  if ((client === 'cli' || client === 'web') && pack.isPublic) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await recordDownload(request, { packId: pack.id, versionId: pack.version.id, profileId: user?.id, client });
  }

  const manifest: Manifest = {
      manifest: 1,
      slug: pack.slug,
      version: pack.version.number,
      status: pack.version.status,
      title: pack.version.title,
      kind: pack.version.kind,
      credit: { name: pack.credit.name, url: pack.credit.internal ? `${origin}${pack.credit.url}` : pack.credit.url },
      license: pack.version.license,
      aiUse: pack.version.aiUse,
      schedule: pack.version.schedule,
      files: pack.files.map((f) => ({ path: f.path, sha256: f.sha256, size: f.size, url: absolute(f.url) })),
  };
  return NextResponse.json(
    manifest,
    // Public packs can be cached briefly; drafts are private to their owner.
    { headers: { 'Cache-Control': pack.isPublic ? 'public, max-age=60' : 'private, no-store' } },
  );
}
