import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2, PUBLIC_BUCKET } from '@/lib/r2';
import { PUBLIC_KEY_PATTERN } from '@/lib/storage';

// Development stand-in for the wallpy-public custom domain (see lib/storage.js).
// Only serves well-formed public keys, and never in production.
export async function GET(_request, { params }) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }
  const key = (await params).key.join('/');
  if (!PUBLIC_KEY_PATTERN.test(key)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const object = await r2().send(new GetObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }));
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        'Content-Type': object.ContentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    if (error.name === 'NoSuchKey') return new Response('Not found', { status: 404 });
    throw error;
  }
}
