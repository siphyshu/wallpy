import 'server-only';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { serverEnv } from '@/lib/env';

// Cloudflare R2 through its S3-compatible API. Server only: the credentials
// can write to the buckets.
let client: S3Client | undefined;

export function r2(): S3Client {
  client ??= new S3Client({
    region: 'auto',
    endpoint: serverEnv.r2Endpoint(),
    credentials: {
      accessKeyId: serverEnv.r2AccessKeyId(),
      secretAccessKey: serverEnv.r2SecretAccessKey(),
    },
    // The SDK otherwise adds its own CRC32 checksum, and R2 accepts only one
    // checksum per upload: ours is the SHA-256 the key is named after.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  return client;
}

export const PUBLIC_BUCKET = 'wallpy-public';

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * A presigned PUT for exactly one object. The SHA-256, content type and length
 * are signed as headers, so R2 rejects any upload whose bytes, type or size
 * differ from what the server approved.
 */
export async function presignPut({ key, sha256, mime, size, expiresIn = 300 }: {
  key: string;
  sha256: string;
  mime: ImageMime;
  size: number;
  expiresIn?: number;
}): Promise<{ url: string; headers: Record<string, string> }> {
  const checksum = Buffer.from(sha256, 'hex').toString('base64');
  const cacheControl = 'public, max-age=31536000, immutable';
  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: PUBLIC_BUCKET,
      Key: key,
      ContentType: mime,
      ContentLength: size,
      ChecksumSHA256: checksum,
      CacheControl: cacheControl,
    }),
    {
      expiresIn,
      // The JS presigner leaves content-type out of the signature by default,
      // which would let a client upload text/html (stored XSS on the CDN domain).
      // Sign it explicitly, and keep these as headers (not query params) so the
      // client must send exactly the approved values. Covered by
      // tests/presign.integration.test.ts.
      signableHeaders: new Set(['content-type', 'cache-control']),
      unhoistableHeaders: new Set(['x-amz-checksum-sha256', 'content-type', 'cache-control']),
    },
  );
  return {
    url,
    headers: { 'Content-Type': mime, 'x-amz-checksum-sha256': checksum, 'Cache-Control': cacheControl },
  };
}

/** Size and type of an object, or null if it doesn't exist. */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | undefined; lastModified: Date | undefined } | null> {
  try {
    const head = await r2().send(new HeadObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }));
    return { size: head.ContentLength ?? 0, contentType: head.ContentType, lastModified: head.LastModified };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (error instanceof Error && error.name === 'NotFound')) return null;
    throw error;
  }
}
