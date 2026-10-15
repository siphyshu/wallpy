import { NextResponse } from 'next/server';

// The v1 presign route let any signed-in user write anywhere in the bucket.
// Replaced by content-addressed uploads (docs/schema-design.md); disabled until then.
export async function POST() {
  return NextResponse.json({ error: 'Uploading is temporarily unavailable while it is rebuilt.' }, { status: 503 });
}
